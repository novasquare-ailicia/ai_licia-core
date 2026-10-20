/*
 * SPDX-FileCopyrightText: 2026 NovaSquare Ltd
 *
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <cstddef>
#include <cstdint>
#include <deque>
#include <mutex>
#include <string>
#include <vector>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

enum class AiLiciaAudioEncoding {
    None,
    PcmS16Le,
    Opus,
};

struct AiLiciaAudioPlaybackState {
    std::string utteranceId;
    uint32_t positionMs = 0;
    bool prepared = false;
    bool started = false;
    bool audible = false;
};

class AiLiciaAudioOutput {
public:
    ~AiLiciaAudioOutput();

    void start();
    void stop();
    void preparePcm(std::string utteranceId, std::string audioItemId, uint32_t sampleRateHz);
    bool prepareOpus(std::string utteranceId, std::string audioItemId, uint32_t sampleRateHz,
                     uint32_t frameDurationMs);
    bool pushPcmBase64(const std::string& audioItemId, uint32_t chunkIndex, uint64_t sampleOffset,
                       const char* encoded, size_t encodedLength);
    bool pushPcmBytes(const std::string& audioItemId, uint32_t chunkIndex, uint64_t sampleOffset,
                      const uint8_t* pcm, size_t byteLength);
    bool pushOpusBytes(const std::string& audioItemId, uint32_t chunkIndex, uint64_t sampleOffset,
                       const uint8_t* opus, size_t byteLength);
    void setPlaying(const std::string& utteranceId, bool playing);
    void finish(const std::string& utteranceId);
    void abort(const std::string& utteranceId);
    AiLiciaAudioPlaybackState playbackState() const;

private:
    struct EncodedChunk {
        std::vector<uint8_t> data;
        size_t sampleCount = 0;
        uint32_t generation = 0;
    };

    struct PlaybackChunk {
        std::vector<int16_t> pcm;
        size_t sampleCount = 0;
        uint32_t generation = 0;
    };

    static void codecTaskEntry(void* context);
    static void outputTaskEntry(void* context);
    void codecTaskLoop();
    void outputTaskLoop();
    void resetStreamLocked(std::string utteranceId, std::string audioItemId,
                           AiLiciaAudioEncoding encoding, uint32_t sampleRateHz,
                           uint32_t frameDurationMs);
    bool configureOpusDecoder(uint32_t sampleRateHz, uint32_t frameDurationMs);
    bool pushPcmSamples(const std::string& audioItemId, uint32_t chunkIndex, uint64_t sampleOffset,
                        std::vector<int16_t> samples);
    std::vector<int16_t> resample(const int16_t* input, size_t sampleCount, uint64_t sampleOffset);
    bool decodeOpus(const std::vector<uint8_t>& encoded, size_t sampleCount,
                    std::vector<int16_t>& pcm);
    uint32_t playbackPositionLocked(uint32_t nowMs) const;
    void pausePlaybackClockLocked(uint32_t nowMs);
    void resumePlaybackClockLocked(uint32_t nowMs);

    mutable std::mutex _mutex;
    std::mutex _decoder_mutex;
    std::deque<EncodedChunk> _decode_chunks;
    std::deque<PlaybackChunk> _playback_chunks;
    std::string _utterance_id;
    std::string _audio_item_id;
    AiLiciaAudioEncoding _encoding = AiLiciaAudioEncoding::None;
    uint32_t _source_rate_hz = 0;
    uint32_t _frame_duration_ms = 0;
    uint32_t _next_chunk_index = 0;
    uint64_t _next_sample_offset = 0;
    double _next_source_position = 0.0;
    size_t _queued_samples = 0;
    size_t _maximum_queued_samples = 0;
    size_t _decode_in_flight = 0;
    uint32_t _received_chunks = 0;
    uint32_t _played_chunks = 0;
    uint32_t _underflow_count = 0;
    uint32_t _decode_error_count = 0;
    uint32_t _stream_generation = 0;
    void* _opus_decoder = nullptr;
    bool _playing = false;
    bool _drain_when_empty = false;
    bool _playback_started = false;
    bool _playback_clock_running = false;
    bool _waiting_for_audio = false;
    uint32_t _playback_anchor_ms = 0;
    uint32_t _playback_position_ms = 0;
    bool _running = false;
    TaskHandle_t _codec_task = nullptr;
    TaskHandle_t _output_task = nullptr;
};
