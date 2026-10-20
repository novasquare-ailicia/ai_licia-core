/*
 * SPDX-FileCopyrightText: 2026 NovaSquare Ltd
 *
 * SPDX-License-Identifier: MIT
 */
#include "ai_licia_audio.h"

#include <algorithm>
#include <board.h>
#include <audio/audio_codec.h>
#include <decoder/esp_audio_dec.h>
#include <decoder/impl/esp_opus_dec.h>
#include <hal/board/config.h>
#include <hal/hal.h>
#include <mbedtls/base64.h>
#include <mooncake_log.h>

namespace {
constexpr size_t kMaxQueuedSamples = AUDIO_OUTPUT_SAMPLE_RATE * 10;
constexpr size_t kStartupBufferSamples = AUDIO_OUTPUT_SAMPLE_RATE / 4;
constexpr TickType_t kIdleDelay = 1;
constexpr uint32_t kSupportedOpusFrameDurationMs = 60;
constexpr size_t kMaxOpusPacketBytes = 4096;
constexpr uint32_t kCodecTaskStackBytes = 2048 * 12;
constexpr uint32_t kOutputTaskStackBytes = 2048 * 2;
const std::string_view kTag = "AI-Licia-Audio";
}

AiLiciaAudioOutput::~AiLiciaAudioOutput()
{
    stop();
}

void AiLiciaAudioOutput::start()
{
    std::lock_guard<std::mutex> lock(_mutex);
    if (_running) return;
    auto codec = Board::GetInstance().GetAudioCodec();
    if (!codec) {
        mclog::tagError(kTag, "audio codec is unavailable");
        return;
    }
    codec->Start();
    _running = true;
    const auto outputResult = xTaskCreate(outputTaskEntry, "ai_licia_output",
                                          kOutputTaskStackBytes, this, 4, &_output_task);
    const auto codecResult = xTaskCreate(codecTaskEntry, "ai_licia_opus",
                                         kCodecTaskStackBytes, this, 2, &_codec_task);
    if (outputResult != pdPASS || codecResult != pdPASS) {
        _running = false;
        mclog::tagError(kTag, "failed to start audio pipeline: output={}, codec={}",
                        static_cast<int>(outputResult), static_cast<int>(codecResult));
    }
}

void AiLiciaAudioOutput::stop()
{
    {
        std::lock_guard<std::mutex> lock(_mutex);
        if (!_running && !_opus_decoder) return;
        _running = false;
        _playing = false;
        _drain_when_empty = false;
        ++_stream_generation;
        _decode_chunks.clear();
        _playback_chunks.clear();
        _queued_samples = 0;
        _utterance_id.clear();
        _audio_item_id.clear();
        _playback_started = false;
        _playback_clock_running = false;
        _waiting_for_audio = false;
        _playback_anchor_ms = 0;
        _playback_position_ms = 0;
    }
    for (int attempt = 0; attempt < 100 && (_codec_task || _output_task); ++attempt) {
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    {
        std::lock_guard<std::mutex> decoderLock(_decoder_mutex);
        if (_opus_decoder) {
            esp_opus_dec_close(_opus_decoder);
            _opus_decoder = nullptr;
        }
    }
    auto codec = Board::GetInstance().GetAudioCodec();
    if (codec && codec->output_enabled()) codec->EnableOutput(false);
}

void AiLiciaAudioOutput::resetStreamLocked(std::string utteranceId, std::string audioItemId,
                                            AiLiciaAudioEncoding encoding, uint32_t sampleRateHz,
                                            uint32_t frameDurationMs)
{
    _utterance_id = std::move(utteranceId);
    _audio_item_id = std::move(audioItemId);
    _encoding = encoding;
    _source_rate_hz = sampleRateHz;
    _frame_duration_ms = frameDurationMs;
    _next_chunk_index = 0;
    _next_sample_offset = 0;
    _next_source_position = 0.0;
    _decode_chunks.clear();
    _playback_chunks.clear();
    _queued_samples = 0;
    _maximum_queued_samples = 0;
    _received_chunks = 0;
    _played_chunks = 0;
    _underflow_count = 0;
    _decode_error_count = 0;
    _playing = false;
    _drain_when_empty = false;
    _playback_started = false;
    _playback_clock_running = false;
    _waiting_for_audio = false;
    _playback_anchor_ms = 0;
    _playback_position_ms = 0;
    ++_stream_generation;
}

void AiLiciaAudioOutput::preparePcm(std::string utteranceId, std::string audioItemId,
                                    uint32_t sampleRateHz)
{
    std::lock_guard<std::mutex> lock(_mutex);
    resetStreamLocked(std::move(utteranceId), std::move(audioItemId),
                      AiLiciaAudioEncoding::PcmS16Le, sampleRateHz, 0);
    mclog::tagInfo(kTag, "prepared PCM stream at {} Hz", sampleRateHz);
}

bool AiLiciaAudioOutput::configureOpusDecoder(uint32_t sampleRateHz, uint32_t frameDurationMs)
{
    if (sampleRateHz != AUDIO_OUTPUT_SAMPLE_RATE ||
        frameDurationMs != kSupportedOpusFrameDurationMs) {
        mclog::tagError(kTag, "unsupported Opus format: {} Hz, {} ms", sampleRateHz,
                        frameDurationMs);
        return false;
    }
    std::lock_guard<std::mutex> decoderLock(_decoder_mutex);
    if (_opus_decoder) {
        esp_opus_dec_reset(_opus_decoder);
        return true;
    }
    esp_opus_dec_cfg_t config = {
        .sample_rate = sampleRateHz,
        .channel = ESP_AUDIO_MONO,
        .frame_duration = ESP_OPUS_DEC_FRAME_DURATION_60_MS,
        .self_delimited = false,
    };
    const auto result = esp_opus_dec_open(&config, sizeof(config), &_opus_decoder);
    if (result != ESP_AUDIO_ERR_OK || !_opus_decoder) {
        mclog::tagError(kTag, "failed to create Opus decoder: {}", static_cast<int>(result));
        _opus_decoder = nullptr;
        return false;
    }
    return true;
}

bool AiLiciaAudioOutput::prepareOpus(std::string utteranceId, std::string audioItemId,
                                     uint32_t sampleRateHz, uint32_t frameDurationMs)
{
    if (!configureOpusDecoder(sampleRateHz, frameDurationMs)) return false;
    std::lock_guard<std::mutex> lock(_mutex);
    resetStreamLocked(std::move(utteranceId), std::move(audioItemId),
                      AiLiciaAudioEncoding::Opus, sampleRateHz, frameDurationMs);
    mclog::tagInfo(kTag, "prepared Opus stream at {} Hz with {} ms frames", sampleRateHz,
                   frameDurationMs);
    return true;
}

bool AiLiciaAudioOutput::pushPcmBase64(const std::string& audioItemId, uint32_t chunkIndex,
                                       uint64_t sampleOffset, const char* encoded, size_t encodedLength)
{
    if (!encoded || encodedLength == 0 || encodedLength > 131072) return false;
    size_t decodedLength = 0;
    const auto* encodedBytes = reinterpret_cast<const unsigned char*>(encoded);
    int result = mbedtls_base64_decode(nullptr, 0, &decodedLength, encodedBytes, encodedLength);
    if (result != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL || decodedLength == 0 || decodedLength % 2 != 0) {
        return false;
    }
    std::vector<int16_t> samples(decodedLength / sizeof(int16_t));
    auto* decodedBytes = reinterpret_cast<unsigned char*>(samples.data());
    result = mbedtls_base64_decode(decodedBytes, decodedLength, &decodedLength, encodedBytes, encodedLength);
    if (result != 0 || decodedLength % 2 != 0) return false;
    samples.resize(decodedLength / sizeof(int16_t));
    return pushPcmSamples(audioItemId, chunkIndex, sampleOffset, std::move(samples));
}

bool AiLiciaAudioOutput::pushPcmBytes(const std::string& audioItemId, uint32_t chunkIndex,
                                     uint64_t sampleOffset, const uint8_t* pcm, size_t byteLength)
{
    if (!pcm || byteLength == 0 || byteLength > 131072 || byteLength % 2 != 0) return false;
    std::vector<int16_t> samples(byteLength / sizeof(int16_t));
    for (size_t index = 0; index < samples.size(); ++index) {
        const uint16_t value = static_cast<uint16_t>(pcm[index * 2]) |
                               (static_cast<uint16_t>(pcm[index * 2 + 1]) << 8);
        samples[index] = static_cast<int16_t>(value);
    }
    return pushPcmSamples(audioItemId, chunkIndex, sampleOffset, std::move(samples));
}

bool AiLiciaAudioOutput::pushOpusBytes(const std::string& audioItemId, uint32_t chunkIndex,
                                      uint64_t sampleOffset, const uint8_t* opus, size_t byteLength)
{
    if (!opus || byteLength == 0 || byteLength > kMaxOpusPacketBytes) return false;
    std::lock_guard<std::mutex> lock(_mutex);
    const size_t frameSamples = static_cast<size_t>(_source_rate_hz) * _frame_duration_ms / 1000;
    if (_encoding != AiLiciaAudioEncoding::Opus || audioItemId != _audio_item_id ||
        chunkIndex != _next_chunk_index || sampleOffset != _next_sample_offset ||
        frameSamples == 0) {
        return false;
    }
    if (_queued_samples + frameSamples > kMaxQueuedSamples) {
        mclog::tagWarn(kTag, "audio buffer exceeded ten seconds; dropping utterance");
        _decode_chunks.clear();
        _playback_chunks.clear();
        _queued_samples = 0;
        _playing = false;
        return false;
    }
    EncodedChunk chunk;
    chunk.data.assign(opus, opus + byteLength);
    chunk.sampleCount = frameSamples;
    chunk.generation = _stream_generation;
    _next_chunk_index += 1;
    _next_sample_offset += frameSamples;
    _queued_samples += frameSamples;
    _maximum_queued_samples = std::max(_maximum_queued_samples, _queued_samples);
    ++_received_chunks;
    _decode_chunks.push_back(std::move(chunk));
    if (chunkIndex % 10 == 0) {
        mclog::tagInfo(kTag, "received Opus chunk {}; buffered {} ms",
                       chunkIndex,
                       static_cast<unsigned>(_queued_samples * 1000 /
                                             AUDIO_OUTPUT_SAMPLE_RATE));
    }
    return true;
}

bool AiLiciaAudioOutput::pushPcmSamples(const std::string& audioItemId, uint32_t chunkIndex,
                                        uint64_t sampleOffset, std::vector<int16_t> samples)
{
    if (samples.empty()) return false;
    std::lock_guard<std::mutex> lock(_mutex);
    if (_encoding != AiLiciaAudioEncoding::PcmS16Le || audioItemId != _audio_item_id ||
        chunkIndex != _next_chunk_index || sampleOffset != _next_sample_offset ||
        _source_rate_hz == 0) {
        return false;
    }
    const size_t sourceSamples = samples.size();
    auto output = resample(samples.data(), samples.size(), sampleOffset);
    _next_chunk_index += 1;
    _next_sample_offset += sourceSamples;
    if (_queued_samples + output.size() > kMaxQueuedSamples) return false;
    PlaybackChunk chunk;
    chunk.sampleCount = output.size();
    chunk.generation = _stream_generation;
    chunk.pcm = std::move(output);
    _queued_samples += chunk.sampleCount;
    _maximum_queued_samples = std::max(_maximum_queued_samples, _queued_samples);
    ++_received_chunks;
    _playback_chunks.push_back(std::move(chunk));
    return true;
}

void AiLiciaAudioOutput::setPlaying(const std::string& utteranceId, bool playing)
{
    std::lock_guard<std::mutex> lock(_mutex);
    if (utteranceId != _utterance_id || _playing == playing) return;
    const uint32_t now = GetHAL().millis();
    if (playing) resumePlaybackClockLocked(now);
    else pausePlaybackClockLocked(now);
    _playing = playing;
}

void AiLiciaAudioOutput::finish(const std::string& utteranceId)
{
    std::lock_guard<std::mutex> lock(_mutex);
    if (utteranceId != _utterance_id) return;
    if (!_playing) resumePlaybackClockLocked(GetHAL().millis());
    _playing = true;
    _drain_when_empty = true;
    mclog::tagInfo(kTag, "Desktop playback completed; draining {} buffered samples",
                   static_cast<unsigned>(_queued_samples));
}

void AiLiciaAudioOutput::abort(const std::string& utteranceId)
{
    {
        std::lock_guard<std::mutex> lock(_mutex);
        if (!utteranceId.empty() && utteranceId != _utterance_id) return;
        _playing = false;
        _drain_when_empty = false;
        ++_stream_generation;
        _decode_chunks.clear();
        _playback_chunks.clear();
        _queued_samples = 0;
        _playback_started = false;
        _playback_clock_running = false;
        _waiting_for_audio = false;
        _playback_anchor_ms = 0;
        _playback_position_ms = 0;
        _utterance_id.clear();
        _audio_item_id.clear();
    }
    std::lock_guard<std::mutex> decoderLock(_decoder_mutex);
    if (_opus_decoder) esp_opus_dec_reset(_opus_decoder);
}

AiLiciaAudioPlaybackState AiLiciaAudioOutput::playbackState() const
{
    std::lock_guard<std::mutex> lock(_mutex);
    return {
        .utteranceId = _utterance_id,
        .positionMs = playbackPositionLocked(GetHAL().millis()),
        .prepared = !_utterance_id.empty(),
        .started = _playback_started,
        .audible = _playback_started && _playing && !_waiting_for_audio,
    };
}

uint32_t AiLiciaAudioOutput::playbackPositionLocked(uint32_t nowMs) const
{
    return _playback_position_ms +
        (_playback_clock_running ? nowMs - _playback_anchor_ms : 0);
}

void AiLiciaAudioOutput::pausePlaybackClockLocked(uint32_t nowMs)
{
    if (!_playback_clock_running) return;
    _playback_position_ms = playbackPositionLocked(nowMs);
    _playback_anchor_ms = 0;
    _playback_clock_running = false;
}

void AiLiciaAudioOutput::resumePlaybackClockLocked(uint32_t nowMs)
{
    if (!_playback_started || _playback_clock_running) return;
    _playback_anchor_ms = nowMs;
    _playback_clock_running = true;
}

std::vector<int16_t> AiLiciaAudioOutput::resample(const int16_t* input, size_t sampleCount,
                                                  uint64_t sampleOffset)
{
    std::vector<int16_t> output;
    if (!input || sampleCount == 0) return output;
    if (_source_rate_hz == AUDIO_OUTPUT_SAMPLE_RATE) {
        output.assign(input, input + sampleCount);
        _next_source_position = static_cast<double>(sampleOffset + sampleCount);
        return output;
    }
    const double step = static_cast<double>(_source_rate_hz) / AUDIO_OUTPUT_SAMPLE_RATE;
    const double end = static_cast<double>(sampleOffset + sampleCount);
    if (_next_source_position < sampleOffset) _next_source_position = sampleOffset;
    output.reserve(static_cast<size_t>(sampleCount / step) + 2);
    while (_next_source_position < end) {
        const auto absoluteIndex = static_cast<uint64_t>(_next_source_position);
        const auto localIndex = static_cast<size_t>(absoluteIndex - sampleOffset);
        if (localIndex >= sampleCount) break;
        output.push_back(input[localIndex]);
        _next_source_position += step;
    }
    return output;
}

bool AiLiciaAudioOutput::decodeOpus(const std::vector<uint8_t>& encoded, size_t sampleCount,
                                    std::vector<int16_t>& pcm)
{
    pcm.resize(sampleCount);
    esp_audio_dec_in_raw_t raw = {
        .buffer = const_cast<uint8_t*>(encoded.data()),
        .len = static_cast<uint32_t>(encoded.size()),
        .consumed = 0,
        .frame_recover = ESP_AUDIO_DEC_RECOVERY_NONE,
    };
    esp_audio_dec_out_frame_t output = {
        .buffer = reinterpret_cast<uint8_t*>(pcm.data()),
        .len = static_cast<uint32_t>(pcm.size() * sizeof(int16_t)),
        .decoded_size = 0,
    };
    esp_audio_dec_info_t info = {};
    std::lock_guard<std::mutex> decoderLock(_decoder_mutex);
    if (!_opus_decoder) return false;
    const auto result = esp_opus_dec_decode(_opus_decoder, &raw, &output, &info);
    if (result != ESP_AUDIO_ERR_OK) {
        mclog::tagWarn(kTag, "Opus decode failed: {}", static_cast<int>(result));
        return false;
    }
    pcm.resize(output.decoded_size / sizeof(int16_t));
    return !pcm.empty();
}

void AiLiciaAudioOutput::codecTaskEntry(void* context)
{
    static_cast<AiLiciaAudioOutput*>(context)->codecTaskLoop();
}

void AiLiciaAudioOutput::outputTaskEntry(void* context)
{
    static_cast<AiLiciaAudioOutput*>(context)->outputTaskLoop();
}

void AiLiciaAudioOutput::codecTaskLoop()
{
    while (true) {
        EncodedChunk encoded;
        {
            std::lock_guard<std::mutex> lock(_mutex);
            if (!_running) break;
            if (!_decode_chunks.empty()) {
                encoded = std::move(_decode_chunks.front());
                _decode_chunks.pop_front();
                ++_decode_in_flight;
            }
        }
        if (encoded.sampleCount == 0) {
            vTaskDelay(kIdleDelay);
            continue;
        }
        PlaybackChunk decoded;
        decoded.sampleCount = encoded.sampleCount;
        decoded.generation = encoded.generation;
        const bool decodedSuccessfully = decodeOpus(encoded.data, encoded.sampleCount, decoded.pcm);
        {
            std::lock_guard<std::mutex> lock(_mutex);
            --_decode_in_flight;
            if (!_running || encoded.generation != _stream_generation) continue;
            if (!decodedSuccessfully) {
                ++_decode_error_count;
                _queued_samples -= std::min(_queued_samples, encoded.sampleCount);
                continue;
            }
            _playback_chunks.push_back(std::move(decoded));
        }
    }
    {
        std::lock_guard<std::mutex> lock(_mutex);
        _codec_task = nullptr;
    }
    vTaskDelete(nullptr);
}

void AiLiciaAudioOutput::outputTaskLoop()
{
    auto codec = Board::GetInstance().GetAudioCodec();
    while (true) {
        PlaybackChunk chunk;
        bool drained = false;
        {
            std::lock_guard<std::mutex> lock(_mutex);
            if (!_running) break;
            const bool startupBufferReady = _playback_started || _drain_when_empty ||
                                            _queued_samples >= kStartupBufferSamples;
            if (_playing && !_playback_chunks.empty() && startupBufferReady) {
                chunk = std::move(_playback_chunks.front());
                _playback_chunks.pop_front();
                _queued_samples -= std::min(_queued_samples, chunk.sampleCount);
                ++_played_chunks;
                if (!_playback_started) {
                    _playback_started = true;
                    _playback_position_ms = 0;
                    mclog::tagInfo(kTag, "local playback started for {}", _utterance_id);
                }
                resumePlaybackClockLocked(GetHAL().millis());
                _waiting_for_audio = false;
                if (_played_chunks % 10 == 0) {
                    mclog::tagInfo(kTag, "playing chunk {}; buffered {} ms",
                                   _played_chunks - 1,
                                   static_cast<unsigned>(_queued_samples * 1000 /
                                                         AUDIO_OUTPUT_SAMPLE_RATE));
                }
            } else if (_playing && !_drain_when_empty && _playback_started &&
                       _decode_chunks.empty() && _decode_in_flight == 0 &&
                       !_waiting_for_audio) {
                _waiting_for_audio = true;
                pausePlaybackClockLocked(GetHAL().millis());
                ++_underflow_count;
                mclog::tagWarn(kTag, "speaker buffer underrun #{} after {} chunks",
                               _underflow_count, _played_chunks);
            } else if (_drain_when_empty && _decode_chunks.empty() &&
                       _decode_in_flight == 0 && _playback_chunks.empty()) {
                _playing = false;
                _drain_when_empty = false;
                pausePlaybackClockLocked(GetHAL().millis());
                _playback_started = false;
                _playback_clock_running = false;
                _playback_anchor_ms = 0;
                _playback_position_ms = 0;
                _utterance_id.clear();
                _audio_item_id.clear();
                drained = true;
            }
        }
        if (drained) {
            mclog::tagInfo(kTag,
                           "completed: received {} chunks, played {}, underflows {}, decode errors {}, max buffered {} ms",
                           _received_chunks, _played_chunks, _underflow_count, _decode_error_count,
                           static_cast<unsigned>(_maximum_queued_samples * 1000 / AUDIO_OUTPUT_SAMPLE_RATE));
        }
        if (chunk.sampleCount == 0) {
            vTaskDelay(kIdleDelay);
            continue;
        }
        {
            std::lock_guard<std::mutex> lock(_mutex);
            if (!_running || !_playing || chunk.generation != _stream_generation) continue;
        }
        if (!codec || chunk.pcm.empty()) continue;
        if (!codec->output_enabled()) codec->EnableOutput(true);
        codec->OutputData(chunk.pcm);
    }
    if (codec && codec->output_enabled()) codec->EnableOutput(false);
    {
        std::lock_guard<std::mutex> lock(_mutex);
        _output_task = nullptr;
    }
    vTaskDelete(nullptr);
}
