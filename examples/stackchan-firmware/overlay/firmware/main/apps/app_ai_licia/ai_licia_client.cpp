/*
 * SPDX-FileCopyrightText: 2026 NovaSquare Ltd
 *
 * SPDX-License-Identifier: MIT
 */
#include "ai_licia_client.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <map>
#include <utility>
#include <ArduinoJson.hpp>
#include <board.h>
#include <esp_err.h>
#include <esp_log.h>
#include <esp_netif.h>
#include <hal/board/config.h>
#include <mdns.h>
#include <mooncake_log.h>
#include <settings.h>
#include <smooth_lvgl.hpp>
#include <web_socket.h>
#include <hal/hal.h>
#include <stackchan/avatar/decorators/decorators.h>
#include <stackchan/stackchan.h>
#include <stackchan/utils/random.h>

using namespace stackchan;

namespace {
const std::string_view kTag = "AI-Licia";
constexpr const char* kSettingsNamespace = "ai_licia";
constexpr const char* kDesktopIdKey = "desktop_id";
constexpr const char* kCredentialKey = "credential";
constexpr uint32_t kReconnectDelayMs = 5000;
constexpr uint32_t kDiscoveryIntervalMs = 5000;
constexpr size_t kBinaryAudioHeaderBytes = 30;
constexpr char kBinaryAudioMagic[] = {'A', 'V', 'P', '1'};
constexpr uint8_t kBinaryAudioChunkType = 1;
constexpr uint8_t kBinaryAudioFrameVersion = 1;
constexpr uint32_t kEyeIdleMinDelayMs = 20'000;
constexpr uint32_t kEyeIdleMaxDelayMs = 60'000;
constexpr uint32_t kFullIdleMinDelayMs = 60'000;
constexpr uint32_t kFullIdleMaxDelayMs = 300'000;
constexpr uint32_t kFullIdleMinDurationMs = 15'000;
constexpr uint32_t kFullIdleMaxDurationMs = 20'000;
constexpr int kIdleServoSpeed = 55;
constexpr size_t kMaxMouthAmplitudeCues = 256;
constexpr size_t kMaxDeferredActions = 8;

bool timeReached(uint32_t now, uint32_t target)
{
    return static_cast<int32_t>(now - target) >= 0;
}

uint16_t readUint16Be(const uint8_t* bytes)
{
    return (static_cast<uint16_t>(bytes[0]) << 8) | bytes[1];
}

uint32_t readUint32Be(const uint8_t* bytes)
{
    return (static_cast<uint32_t>(bytes[0]) << 24) |
           (static_cast<uint32_t>(bytes[1]) << 16) |
           (static_cast<uint32_t>(bytes[2]) << 8) |
           bytes[3];
}

uint64_t readUint64Be(const uint8_t* bytes)
{
    uint64_t value = 0;
    for (size_t index = 0; index < 8; ++index) value = (value << 8) | bytes[index];
    return value;
}

bool arrayContains(const ArduinoJson::JsonArrayConst& array, const char* value)
{
    for (const auto item : array) {
        if (item.is<const char*>() && std::strcmp(item.as<const char*>(), value) == 0) return true;
    }
    return false;
}

std::string readTxtValue(const mdns_result_t* result, const char* key)
{
    for (size_t index = 0; result && index < result->txt_count; ++index) {
        if (result->txt[index].key && std::strcmp(result->txt[index].key, key) == 0) {
            return result->txt[index].value ? result->txt[index].value : "";
        }
    }
    return {};
}

std::string endpointHost(const mdns_result_t* result)
{
    esp_netif_ip_info_t localIp{};
    esp_netif_t* defaultNetif = esp_netif_get_default_netif();
    const bool hasLocalSubnet =
        defaultNetif && esp_netif_get_ip_info(defaultNetif, &localIp) == ESP_OK;
    const mdns_ip_addr_t* firstIpv4 = nullptr;

    for (auto* address = result ? result->addr : nullptr; address; address = address->next) {
        if (address->addr.type != ESP_IPADDR_TYPE_V4) continue;
        if (!firstIpv4) firstIpv4 = address;
        if (!hasLocalSubnet ||
            (address->addr.u_addr.ip4.addr & localIp.netmask.addr) !=
                (localIp.ip.addr & localIp.netmask.addr)) {
            continue;
        }
        char text[16]{};
        std::snprintf(text, sizeof(text), IPSTR, IP2STR(&address->addr.u_addr.ip4));
        return text;
    }
    if (firstIpv4) {
        char text[16]{};
        std::snprintf(text, sizeof(text), IPSTR, IP2STR(&firstIpv4->addr.u_addr.ip4));
        return text;
    }
    if (result && result->hostname) return std::string(result->hostname) + ".local";
    return {};
}

uint8_t scaleChannel(uint8_t channel, float weight)
{
    return static_cast<uint8_t>(std::round(channel * std::clamp(0.25f + weight * 0.75f, 0.0f, 1.0f)));
}
}

AiLiciaAvatarClient::AiLiciaAvatarClient()
    : _client_id(makeClientId())
{
    Settings settings(kSettingsNamespace, false);
    _selected.installationId = settings.GetString(kDesktopIdKey, "");
    _reconnect_credential = settings.GetString(kCredentialKey, "");
}

AiLiciaAvatarClient::~AiLiciaAvatarClient()
{
    stop();
}

void AiLiciaAvatarClient::start()
{
    std::lock_guard<std::mutex> lock(_mutex);
    if (_running) return;
    _running = true;
    _discovery_refresh_requested = true;
    _audio.start();
    const esp_err_t mdnsResult = mdns_init();
    if (mdnsResult != ESP_OK && mdnsResult != ESP_ERR_INVALID_STATE) {
        mclog::tagWarn(kTag, "mDNS init failed: {}", esp_err_to_name(mdnsResult));
    }
    mdns_hostname_set(_client_id.c_str());
    if (xTaskCreatePinnedToCore(discoveryTaskEntry, "ai_licia_mdns", 6144, this, 2,
                                &_discovery_task, 0) != pdPASS) {
        _running = false;
        _discovery_task = nullptr;
        _state = AiLiciaConnectionState::Error;
        _status = "Could not start discovery";
    }
}

void AiLiciaAvatarClient::stop()
{
    {
        std::lock_guard<std::mutex> lock(_mutex);
        if (!_running) return;
        _running = false;
    }
    disconnect();
    for (int attempt = 0; attempt < 250 && _discovery_task; ++attempt) {
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    _audio.stop();
}

void AiLiciaAvatarClient::update()
{
    AiLiciaDesktopEndpoint endpoint;
    bool shouldConnect = false;
    {
        std::lock_guard<std::mutex> lock(_mutex);
        const bool disconnected = !_websocket || !_websocket->IsConnected();
        shouldConnect = _running && disconnected && !_selected.host.empty() &&
                        GetHAL().millis() - _last_connect_attempt >= kReconnectDelayMs;
        endpoint = _selected;
    }
    if (shouldConnect) connect(endpoint);

    const bool connected = state() == AiLiciaConnectionState::Ready;
    {
        LvglLockGuard lock;
        updateLocalPlayback();
        updateDecoration();
        updateAction();
        updateIdleAnimation(connected);
        if (_speech_state == SpeechState::Playing && _action == Action::None &&
            GetHAL().millis() - _last_speech_motion_at > 900) {
            _last_speech_motion_at = GetHAL().millis();
            const int direction = (_speech_motion_phase++ % 2 == 0) ? -1 : 1;
            const int yaw = direction * static_cast<int>(35 + 55 * _expression_weight);
            const int basePitch = _expression == Expression::Sad ? 240 :
                                  _expression == Expression::Angry ? 170 :
                                  _expression == Expression::Relaxed ? 115 : 55;
            GetStackChan().motion().moveWithSpeed(yaw, basePitch + direction * 10, 170);
        }
    }
}

void AiLiciaAvatarClient::selectDesktop(const std::string& installationId)
{
    AiLiciaDesktopEndpoint selected;
    {
        std::lock_guard<std::mutex> lock(_mutex);
        const auto match = std::find_if(_desktops.begin(), _desktops.end(), [&](const auto& endpoint) {
            return endpoint.installationId == installationId;
        });
        if (match == _desktops.end()) return;
        selected = *match;
        if (_selected.installationId != selected.installationId) _reconnect_credential.clear();
        _selected = selected;
        _state = AiLiciaConnectionState::Connecting;
        _status = "Connecting to " + selected.displayName;
        _last_connect_attempt = 0;
    }
    Settings settings(kSettingsNamespace, true);
    settings.SetString(kDesktopIdKey, selected.installationId);
    settings.SetString(kCredentialKey, _reconnect_credential);
    disconnect();
}

AiLiciaConnectionState AiLiciaAvatarClient::state() const
{
    std::lock_guard<std::mutex> lock(_mutex);
    return _state;
}

std::string AiLiciaAvatarClient::statusText() const
{
    std::lock_guard<std::mutex> lock(_mutex);
    return _status;
}

std::vector<AiLiciaDesktopEndpoint> AiLiciaAvatarClient::desktops() const
{
    std::lock_guard<std::mutex> lock(_mutex);
    return _desktops;
}

void AiLiciaAvatarClient::discoveryTaskEntry(void* context)
{
    static_cast<AiLiciaAvatarClient*>(context)->discoveryTaskLoop();
}

void AiLiciaAvatarClient::discoveryTaskLoop()
{
    while (true) {
        {
            std::lock_guard<std::mutex> lock(_mutex);
            if (!_running) break;
        }
        discover();
        for (uint32_t elapsed = 0; elapsed < kDiscoveryIntervalMs; elapsed += 100) {
            {
                std::lock_guard<std::mutex> lock(_mutex);
                if (!_running) {
                    _discovery_task = nullptr;
                    vTaskDelete(nullptr);
                    return;
                }
            }
            vTaskDelay(pdMS_TO_TICKS(100));
        }
    }
    _discovery_task = nullptr;
    vTaskDelete(nullptr);
}

void AiLiciaAvatarClient::discover()
{
    mdns_result_t* results = nullptr;
    const esp_err_t query = mdns_query_ptr("_ailicia-avatar", "_tcp", 1800, 8, &results);
    if (query != ESP_OK && query != ESP_ERR_NOT_FOUND) {
        mclog::tagWarn(kTag, "mDNS query failed: {}", esp_err_to_name(query));
        return;
    }

    std::map<std::string, AiLiciaDesktopEndpoint> endpoints;
    for (auto* result = results; result; result = result->next) {
        const std::string protocol = readTxtValue(result, "protocol");
        const std::string version = readTxtValue(result, "protocolVersion");
        const std::string installationId = readTxtValue(result, "installationId");
        const std::string host = endpointHost(result);
        if (protocol != "avatar.protocol.v1" || version != "1" || installationId.empty() ||
            host.empty() || result->port == 0) continue;
        endpoints[installationId] = {
            .installationId = installationId,
            .displayName = result->instance_name ? result->instance_name : "ai_licia Desktop",
            .host = host,
            .port = result->port,
        };
    }
    mdns_query_results_free(results);

    std::lock_guard<std::mutex> lock(_mutex);
    _desktops.clear();
    for (const auto& [id, endpoint] : endpoints) _desktops.push_back(endpoint);

    const auto remembered = std::find_if(_desktops.begin(), _desktops.end(), [&](const auto& endpoint) {
        return endpoint.installationId == _selected.installationId;
    });
    // Discovery refreshes available endpoints, but an existing WebSocket owns
    // the protocol session state until its callbacks report a disconnect.
    if (_websocket) {
        if (remembered != _desktops.end()) _selected = *remembered;
        return;
    }
    if (remembered != _desktops.end()) {
        _selected = *remembered;
        _state = AiLiciaConnectionState::Connecting;
        _status = "Connecting to " + _selected.displayName;
        return;
    }
    if (_desktops.size() == 1) {
        _selected = _desktops.front();
        _state = AiLiciaConnectionState::Connecting;
        _status = "Connecting to " + _selected.displayName;
        return;
    }
    _selected.host.clear();
    if (_desktops.empty()) {
        _state = AiLiciaConnectionState::Discovering;
        _status = "Enable local avatar devices in Desktop";
    } else {
        _state = AiLiciaConnectionState::ChooseDesktop;
        _status = "Choose ai_licia Desktop";
    }
}

void AiLiciaAvatarClient::connect(const AiLiciaDesktopEndpoint& endpoint)
{
    disconnect();
    auto network = Board::GetInstance().GetNetwork();
    auto websocket = network ? network->CreateWebSocket(1) : nullptr;
    if (!websocket) {
        setState(AiLiciaConnectionState::Error, "WebSocket unavailable");
        return;
    }
    websocket->SetReceiveTaskPriority(5);

    websocket->OnConnected([this]() {
        ArduinoJson::JsonDocument document;
        document["type"] = "hello";
        auto payload = document["payload"].to<ArduinoJson::JsonObject>();
        payload["clientType"] = "integration";
        payload["clientId"] = _client_id;
        payload["displayName"] = "ai_licia StackChan";
        payload["version"] = "0.1.0";
        if (!_reconnect_credential.empty()) payload["reconnectCredential"] = _reconnect_credential;
        std::string json;
        ArduinoJson::serializeJson(document, json);
        if (_websocket) _websocket->Send(json);
        setState(AiLiciaConnectionState::Connecting, "Authenticating with Desktop");
    });
    websocket->OnDisconnected([this]() {
        setState(AiLiciaConnectionState::Connecting, "Desktop disconnected; reconnecting");
    });
    websocket->OnData([this](const char* data, size_t length, bool binary) {
        if (!data || length == 0 || length > 196608) return;
        if (binary) {
            handleBinaryMessage(data, length);
            return;
        }
        std::string message(data, length);
        handleMessage(message);
    });

    const std::string url = "ws://" + endpoint.host + ":" + std::to_string(endpoint.port);
    mclog::tagInfo(kTag, "connecting to {}", url);
    {
        std::lock_guard<std::mutex> lock(_mutex);
        _websocket = std::move(websocket);
        _last_connect_attempt = GetHAL().millis();
    }
    if (!_websocket->Connect(url.c_str())) {
        setState(AiLiciaConnectionState::Connecting, "Desktop unavailable; retrying");
    }
}

void AiLiciaAvatarClient::disconnect()
{
    std::unique_ptr<WebSocket> websocket;
    {
        std::lock_guard<std::mutex> lock(_mutex);
        websocket = std::move(_websocket);
        _subscription_id.clear();
        _last_delivery_sequence = 0;
        _audio_encoding = AiLiciaAudioEncoding::None;
    }
    websocket.reset();
    _audio.abort("");
    _speech_state = SpeechState::Idle;
    _active_utterance_id.clear();
    clearLocalPlaybackState("");
    _action = Action::None;
    _action_phase = 0;
    _idle_animation = IdleAnimation::None;
    _idle_phase = -1;
    _next_eye_idle_at = 0;
    _next_full_idle_at = 0;
}

bool AiLiciaAvatarClient::acceptDeliverySequence(uint64_t sequence, const char* utteranceId)
{
    if (sequence == 0) return true;
    if (_last_delivery_sequence > 0 && sequence != _last_delivery_sequence + 1) {
        mclog::tagWarn(kTag, "delivery sequence gap: expected {}, received {}",
                       _last_delivery_sequence + 1, sequence);
        _audio.abort(utteranceId ? utteranceId : "");
        _last_delivery_sequence = sequence;
        requestState();
        return false;
    }
    _last_delivery_sequence = sequence;
    return true;
}

void AiLiciaAvatarClient::handleBinaryMessage(const char* message, size_t length)
{
    if (!message || length < kBinaryAudioHeaderBytes) return;
    const auto* bytes = reinterpret_cast<const uint8_t*>(message);
    if (std::memcmp(bytes, kBinaryAudioMagic, sizeof(kBinaryAudioMagic)) != 0 ||
        bytes[4] != kBinaryAudioChunkType || bytes[5] != kBinaryAudioFrameVersion ||
        readUint16Be(bytes + 6) != 0) {
        return;
    }
    const uint64_t sequence = readUint64Be(bytes + 8);
    const uint32_t chunkIndex = readUint32Be(bytes + 16);
    const uint64_t sampleOffset = readUint64Be(bytes + 20);
    const size_t audioItemIdLength = readUint16Be(bytes + 28);
    const size_t payloadOffset = kBinaryAudioHeaderBytes + audioItemIdLength;
    if (audioItemIdLength == 0 || payloadOffset >= length ||
        !acceptDeliverySequence(sequence)) {
        return;
    }
    const std::string audioItemId(message + kBinaryAudioHeaderBytes, audioItemIdLength);
    const bool accepted = _audio_encoding == AiLiciaAudioEncoding::Opus
        ? _audio.pushOpusBytes(audioItemId, chunkIndex, sampleOffset, bytes + payloadOffset,
                               length - payloadOffset)
        : _audio.pushPcmBytes(audioItemId, chunkIndex, sampleOffset, bytes + payloadOffset,
                              length - payloadOffset);
    if (!accepted) {
        mclog::tagWarn(kTag, "rejected binary audio chunk {}", chunkIndex);
    }
}

void AiLiciaAvatarClient::handleMessage(std::string& message)
{
    ArduinoJson::JsonDocument document;
    // The mutable input overload keeps JSON strings inside the queued message
    // instead of duplicating every key and the large PCM base64 payload.
    const auto error = ArduinoJson::deserializeJson(document, message.data(), message.size());
    if (error) {
        mclog::tagWarn(kTag, "invalid protocol JSON: {}", error.c_str());
        return;
    }
    const char* type = document["type"] | "";
    if (std::strcmp(type, "welcome") == 0) {
        handleWelcome(document);
    } else if (std::strcmp(type, "access_pending") == 0) {
        setState(AiLiciaConnectionState::AwaitingApproval, "Approve StackChan in Desktop");
    } else if (std::strcmp(type, "access_granted") == 0) {
        const char* credential = document["payload"]["reconnectCredential"] | "";
        if (*credential) {
            _reconnect_credential = credential;
            Settings settings(kSettingsNamespace, true);
            settings.SetString(kDesktopIdKey, _selected.installationId);
            settings.SetString(kCredentialKey, _reconnect_credential);
        }
        subscribe();
    } else if (std::strcmp(type, "access_denied") == 0) {
        setState(AiLiciaConnectionState::Error, "Avatar access was not approved");
    } else if (std::strcmp(type, "avatar.subscribed") == 0) {
        _subscription_id = document["payload"]["subscriptionId"] | "";
        _last_delivery_sequence = 0;
        const char* transport = document["payload"]["audioTransport"] | "none";
        const char* profile = document["payload"]["audioFormat"]["profile"] | "none";
        const uint32_t sampleRate = document["payload"]["audioFormat"]["sampleRateHz"] | 0;
        _audio_encoding = std::strcmp(profile, "avatar.audio.opus.v1") == 0
            ? AiLiciaAudioEncoding::Opus
            : std::strcmp(profile, "avatar.audio.pcm-s16le.v1") == 0
                ? AiLiciaAudioEncoding::PcmS16Le
                : AiLiciaAudioEncoding::None;
        mclog::tagInfo(kTag, "avatar stream negotiated {} over {} at {} Hz", profile,
                       transport, sampleRate);
        setState(AiLiciaConnectionState::Ready, "Connected");
    } else if (std::strcmp(type, "avatar.subscription_error") == 0) {
        setState(AiLiciaConnectionState::Error, "Avatar subscription failed");
    } else if (std::strcmp(type, "event") == 0) {
        handleEvent(document);
    } else if (std::strcmp(type, "error") == 0) {
        const char* text = document["payload"]["message"] | "Protocol error";
        setState(AiLiciaConnectionState::Error, text);
    }
}

void AiLiciaAvatarClient::handleWelcome(const ArduinoJson::JsonDocument& document)
{
    const auto scopes = document["payload"]["authorizedScopes"].as<ArduinoJson::JsonArrayConst>();
    if (arrayContains(scopes, "avatar.events.read")) subscribe();
    else requestAccess();
}

void AiLiciaAvatarClient::handleEvent(const ArduinoJson::JsonDocument& document)
{
    const char* name = document["payload"]["name"] | "";
    const auto data = document["payload"]["data"];
    const uint64_t sequence = data["deliverySequence"] | 0;
    if (!acceptDeliverySequence(sequence, data["utteranceId"] | "")) return;

    if (std::strcmp(name, "avatar.state.snapshot") == 0) {
        const auto activeUtterance = data["activeUtterance"];
        {
            LvglLockGuard lock;
            if (activeUtterance.isNull()) {
                setSpeechState(SpeechState::Idle);
            } else {
                const char* state = activeUtterance["state"] | "";
                setSpeechState(std::strcmp(state, "playing") == 0
                                   ? SpeechState::Playing
                                   : SpeechState::Paused,
                               activeUtterance["utteranceId"] | "");
            }
        }
        const auto expression = data["expression"];
        if (!expression.isNull()) {
            float strongestWeight = 0.0f;
            Expression strongest = Expression::Neutral;
            for (const auto value : expression["values"].as<ArduinoJson::JsonArrayConst>()) {
                const char* id = value["expression"] | "";
                const float weight = std::clamp(value["weight"] | 0.0f, 0.0f, 1.0f);
                if (weight <= strongestWeight) continue;
                strongestWeight = weight;
                if (std::strcmp(id, "happy") == 0) strongest = Expression::Happy;
                else if (std::strcmp(id, "angry") == 0) strongest = Expression::Angry;
                else if (std::strcmp(id, "sad") == 0) strongest = Expression::Sad;
                else if (std::strcmp(id, "relaxed") == 0) strongest = Expression::Relaxed;
                else if (std::strcmp(id, "surprised") == 0) strongest = Expression::Surprised;
            }
            LvglLockGuard lock;
            applyExpression(strongest, strongestWeight);
        }
        return;
    }
    if (std::strcmp(name, "avatar.expression.state") == 0) {
        float strongestWeight = 0.0f;
        Expression strongest = Expression::Neutral;
        for (const auto value : data["values"].as<ArduinoJson::JsonArrayConst>()) {
            const char* id = value["expression"] | "";
            const float weight = std::clamp(value["weight"] | 0.0f, 0.0f, 1.0f);
            if (weight <= strongestWeight) continue;
            strongestWeight = weight;
            if (std::strcmp(id, "happy") == 0) strongest = Expression::Happy;
            else if (std::strcmp(id, "angry") == 0) strongest = Expression::Angry;
            else if (std::strcmp(id, "sad") == 0) strongest = Expression::Sad;
            else if (std::strcmp(id, "relaxed") == 0) strongest = Expression::Relaxed;
            else if (std::strcmp(id, "surprised") == 0) strongest = Expression::Surprised;
        }
        const auto source = data["source"];
        const char* sourceKind = source["kind"] | "";
        const char* sourceUtteranceId = source["utteranceId"] | "";
        LvglLockGuard lock;
        if (std::strcmp(sourceKind, "speech_delivery") == 0 &&
            shouldDeferUntilLocalPlayback(sourceUtteranceId)) {
            _deferred_expression = DeferredExpression{
                sourceUtteranceId,
                strongest,
                strongestWeight,
                DeferredPlaybackMoment::Start,
            };
        } else if (std::strcmp(sourceKind, "system") == 0 &&
                   strongestWeight == 0.0f &&
                   !_finishing_local_utterance_id.empty()) {
            _deferred_expression = DeferredExpression{
                _finishing_local_utterance_id,
                strongest,
                strongestWeight,
                DeferredPlaybackMoment::End,
            };
        } else {
            applyExpression(strongest, strongestWeight);
        }
    } else if (std::strcmp(name, "avatar.mouth.amplitude") == 0) {
        LvglLockGuard lock;
        queueMouthAmplitude(data["utteranceId"] | "", data["offsetMs"] | 0,
                            std::clamp(data["value"] | 0.0f, 0.0f, 1.0f));
    } else if (std::strcmp(name, "avatar.speech.started") == 0 ||
               std::strcmp(name, "avatar.speech.resumed") == 0) {
        const char* utteranceId = data["utteranceId"] | "";
        {
            LvglLockGuard lock;
            cancelIdleAnimation();
            postponeIdleAnimations();
            setSpeechState(SpeechState::Playing, utteranceId);
            _protocol_playback_started_at = GetHAL().millis();
            if (_audio_encoding != AiLiciaAudioEncoding::None && GetStackChan().hasAvatar()) {
                GetStackChan().avatar().mouth().setWeight(0);
            }
        }
        _audio.setPlaying(utteranceId, true);
    } else if (std::strcmp(name, "avatar.speech.paused") == 0) {
        const char* utteranceId = data["utteranceId"] | "";
        {
            LvglLockGuard lock;
            if (_active_utterance_id.empty() || _active_utterance_id == utteranceId) {
                setSpeechState(SpeechState::Paused, utteranceId);
            }
            postponeIdleAnimations();
        }
        _audio.setPlaying(utteranceId, false);
    } else if (std::strcmp(name, "avatar.speech.ended") == 0) {
        const char* utteranceId = data["utteranceId"] | "";
        const char* reason = data["reason"] | "";
        const bool completed = std::strcmp(reason, "completed") == 0;
        if (completed) _audio.finish(utteranceId);
        else _audio.abort(utteranceId);
        const auto playback = _audio.playbackState();
        const bool drainingLocally = completed && playback.prepared &&
                                     playback.utteranceId == utteranceId;
        {
            LvglLockGuard lock;
            if (drainingLocally) {
                _finishing_local_utterance_id = utteranceId;
            } else if (_active_utterance_id.empty() || _active_utterance_id == utteranceId) {
                setSpeechState(SpeechState::Idle);
                postponeIdleAnimations();
                clearLocalPlaybackState(utteranceId);
            }
        }
    } else if (std::strcmp(name, "avatar.audio.prepared") == 0) {
        const char* encoding = data["encoding"] | "";
        if (std::strcmp(encoding, "OPUS") == 0) {
            _audio_encoding = AiLiciaAudioEncoding::Opus;
            if (!_audio.prepareOpus(data["utteranceId"] | "", data["audioItemId"] | "",
                                    data["sampleRateHz"] | 0,
                                    data["frameDurationMs"] | 0)) {
                mclog::tagError(kTag, "could not prepare Opus audio stream");
            }
        } else {
            _audio_encoding = AiLiciaAudioEncoding::PcmS16Le;
            _audio.preparePcm(data["utteranceId"] | "", data["audioItemId"] | "",
                              data["sampleRateHz"] | 0);
        }
    } else if (std::strcmp(name, "avatar.audio.chunk") == 0) {
        if (_audio_encoding != AiLiciaAudioEncoding::PcmS16Le) {
            mclog::tagWarn(kTag, "JSON Opus audio is not supported; binary transport is required");
            return;
        }
        const char* encoded = data["dataBase64"] | "";
        const uint32_t chunkIndex = data["chunkIndex"] | 0;
        if (!_audio.pushPcmBase64(data["audioItemId"] | "", chunkIndex,
                                  data["sampleOffset"] | 0, encoded,
                                  std::strlen(encoded))) {
            mclog::tagWarn(kTag, "rejected JSON PCM chunk {}", chunkIndex);
        }
    } else if (std::strcmp(name, "avatar.action.triggered") == 0) {
        const char* id = data["actionId"] | "";
        Action action = Action::None;
        if (std::strcmp(id, "ai.licia/wink") == 0) action = Action::Wink;
        else if (std::strcmp(id, "nod") == 0) action = Action::Nod;
        else if (std::strcmp(id, "shake_head") == 0) action = Action::ShakeHead;
        else if (std::strcmp(id, "ai.licia/rage") == 0) action = Action::Rage;
        else if (std::strcmp(id, "celebrate") == 0) action = Action::Celebrate;
        else if (std::strcmp(id, "laugh") == 0) action = Action::Laugh;
        else if (std::strcmp(id, "surprised_recoil") == 0) action = Action::SurprisedRecoil;
        else if (std::strcmp(id, "wave") == 0) action = Action::Wave;
        else if (std::strcmp(id, "ai.licia/sigh") == 0) action = Action::Sigh;
        else if (std::strcmp(id, "ai.licia/clear_throat") == 0) action = Action::ClearThroat;
        else if (std::strcmp(id, "ai.licia/scoff") == 0) action = Action::Scoff;
        else if (std::strcmp(id, "ai.licia/pant") == 0) action = Action::Pant;
        else if (std::strcmp(id, "ai.licia/sharp_exhale") == 0) action = Action::SharpExhale;
        else if (std::strcmp(id, "ai.licia/yawn") == 0) action = Action::Yawn;
        LvglLockGuard lock;
        const float intensity = std::clamp(data["intensity"] | 1.0f, 0.0f, 1.0f);
        const uint32_t durationMs = data["durationMs"] | 700;
        const char* sourceUtteranceId = data["source"]["utteranceId"] | "";
        if (action != Action::None && shouldDeferUntilLocalPlayback(sourceUtteranceId)) {
            if (_deferred_actions.size() >= kMaxDeferredActions) _deferred_actions.pop_front();
            _deferred_actions.push_back({sourceUtteranceId, action, intensity, durationMs});
        } else {
            applyAction(action, intensity, durationMs);
        }
    }
}

void AiLiciaAvatarClient::requestAccess()
{
    if (!_websocket || !_websocket->IsConnected()) return;
    ArduinoJson::JsonDocument document;
    document["type"] = "request_access";
    auto payload = document["payload"].to<ArduinoJson::JsonObject>();
    payload["clientId"] = _client_id;
    payload["displayName"] = "ai_licia StackChan";
    payload["requestedScopes"].to<ArduinoJson::JsonArray>().add("avatar.events.read");
    std::string json;
    ArduinoJson::serializeJson(document, json);
    _websocket->Send(json);
    setState(AiLiciaConnectionState::AwaitingApproval, "Approve StackChan in Desktop");
}

void AiLiciaAvatarClient::subscribe()
{
    if (!_websocket || !_websocket->IsConnected()) return;
    ArduinoJson::JsonDocument document;
    document["type"] = "avatar.subscribe";
    auto payload = document["payload"].to<ArduinoJson::JsonObject>();
    payload["requestId"] = "stackchan-subscription";
    payload["protocolVersion"] = 1;
    auto profiles = payload["profiles"].to<ArduinoJson::JsonArray>();
    for (const auto& profile : {
             std::pair{"avatar.speech.lifecycle.v1", true},
             std::pair{"avatar.mouth.amplitude.v1", true},
             std::pair{"avatar.expression.vrm.v1", false},
             std::pair{"avatar.action.semantic.v1", false},
             std::pair{"avatar.audio.opus.v1", true},
         }) {
        auto item = profiles.add<ArduinoJson::JsonObject>();
        item["id"] = profile.first;
        item["required"] = profile.second;
    }
    payload["speechDriverPreference"].to<ArduinoJson::JsonArray>().add("avatar.mouth.amplitude.v1");
    auto audioTransports = payload["audioTransportPreference"].to<ArduinoJson::JsonArray>();
    audioTransports.add("binary-v1");
    auto audioFormats = payload["audioFormatPreference"].to<ArduinoJson::JsonArray>();
    auto opus24Khz = audioFormats.add<ArduinoJson::JsonObject>();
    opus24Khz["profile"] = "avatar.audio.opus.v1";
    opus24Khz["sampleRateHz"] = AUDIO_OUTPUT_SAMPLE_RATE;
    opus24Khz["channels"] = 1;
    opus24Khz["frameDurationMs"] = 60;
    opus24Khz["bitrateBps"] = 48000;
    std::string json;
    ArduinoJson::serializeJson(document, json);
    _websocket->Send(json);
    setState(AiLiciaConnectionState::Subscribing, "Starting avatar stream");
}

void AiLiciaAvatarClient::requestState()
{
    if (!_websocket || !_websocket->IsConnected() || _subscription_id.empty()) return;
    ArduinoJson::JsonDocument document;
    document["type"] = "avatar.get_state";
    auto payload = document["payload"].to<ArduinoJson::JsonObject>();
    payload["requestId"] = "stackchan-recovery";
    payload["subscriptionId"] = _subscription_id;
    payload["lastDeliverySequence"] = _last_delivery_sequence;
    std::string json;
    ArduinoJson::serializeJson(document, json);
    _websocket->Send(json);
}

void AiLiciaAvatarClient::applyExpression(Expression expression, float weight)
{
    cancelIdleAnimation();
    _expression = expression;
    _expression_weight = std::clamp(weight, 0.0f, 1.0f);
    if (_action != Action::None || !GetStackChan().hasAvatar()) return;
    renderExpression(_expression, _expression_weight);
    updateExpressionDecoration(_expression, _expression_weight);
}

void AiLiciaAvatarClient::renderExpression(Expression expression, float weight, int poseSpeedOverride)
{
    if (!GetStackChan().hasAvatar()) return;
    auto& avatar = GetStackChan().avatar();
    if (weight < 0.15f) expression = Expression::Neutral;
    avatar.leftEye().setPosition({0, 0});
    avatar.rightEye().setPosition({0, 0});
    avatar.leftEye().setSize(0);
    avatar.rightEye().setSize(0);
    switch (expression) {
        case Expression::Happy: avatar.setEmotion(avatar::Emotion::Happy); break;
        case Expression::Angry: avatar.setEmotion(avatar::Emotion::Angry); break;
        case Expression::Sad: avatar.setEmotion(avatar::Emotion::Sad); break;
        case Expression::Relaxed: avatar.setEmotion(avatar::Emotion::Sleepy); break;
        case Expression::Surprised:
            avatar.setEmotion(avatar::Emotion::Neutral);
            avatar.leftEye().setSize(70);
            avatar.rightEye().setSize(70);
            break;
        case Expression::Neutral: avatar.setEmotion(avatar::Emotion::Neutral); break;
    }
    applyLights(expression, weight);
    applyPose(expression, weight, poseSpeedOverride);
}

void AiLiciaAvatarClient::updateExpressionDecoration(Expression expression, float weight)
{
    Decoration decoration = Decoration::None;
    if (weight >= 0.35f) {
        switch (expression) {
            case Expression::Happy:
                decoration = weight >= 0.75f ? Decoration::Heart : Decoration::Shy;
                break;
            case Expression::Angry: decoration = Decoration::Angry; break;
            case Expression::Surprised: decoration = Decoration::Sweat; break;
            case Expression::Neutral:
            case Expression::Sad:
            case Expression::Relaxed: break;
        }
    }
    if (decoration == Decoration::None) {
        clearDecoration();
        return;
    }
    if (_decoration != decoration) showDecoration(decoration, 0);
}

void AiLiciaAvatarClient::showDecoration(Decoration decoration, uint32_t durationMs)
{
    if (!GetStackChan().hasAvatar()) return;
    clearDecoration();
    auto& avatarView = GetStackChan().avatar();
    switch (decoration) {
        case Decoration::Heart:
            _decoration_id = avatarView.addDecorator(
                std::make_unique<stackchan::avatar::HeartDecorator>(lv_screen_active(), 0, 350));
            break;
        case Decoration::Angry:
            _decoration_id = avatarView.addDecorator(
                std::make_unique<stackchan::avatar::AngryDecorator>(lv_screen_active(), 0, 300));
            break;
        case Decoration::Sweat:
            _decoration_id = avatarView.addDecorator(
                std::make_unique<stackchan::avatar::SweatDecorator>(lv_screen_active(), 0, 350));
            break;
        case Decoration::Shy:
            _decoration_id = avatarView.addDecorator(
                std::make_unique<stackchan::avatar::ShyDecorator>(lv_screen_active(), 0));
            break;
        case Decoration::None: return;
    }
    _decoration = decoration;
    _decoration_expires_at = durationMs == 0 ? 0 : GetHAL().millis() + durationMs;
}

void AiLiciaAvatarClient::updateDecoration()
{
    if (_decoration != Decoration::None && _decoration_expires_at != 0 &&
        timeReached(GetHAL().millis(), _decoration_expires_at)) {
        clearDecoration();
    }
}

void AiLiciaAvatarClient::clearDecoration()
{
    if (_decoration_id >= 0 && GetStackChan().hasAvatar()) {
        GetStackChan().avatar().removeDecorator(_decoration_id);
    }
    _decoration = Decoration::None;
    _decoration_id = -1;
    _decoration_expires_at = 0;
}

void AiLiciaAvatarClient::applyAction(Action action, float intensity, uint32_t durationMs)
{
    if (action == Action::None || intensity <= 0.0f) return;
    cancelIdleAnimation();
    postponeIdleAnimations();
    clearDecoration();
    _action = action;
    _action_started_at = GetHAL().millis();
    _action_duration_ms = std::max<uint32_t>(durationMs, 300);
    _action_phase = -1;
    switch (action) {
        case Action::Rage: showDecoration(Decoration::Angry, _action_duration_ms); break;
        case Action::Celebrate:
        case Action::Laugh: showDecoration(Decoration::Heart, _action_duration_ms); break;
        case Action::SurprisedRecoil:
        case Action::SharpExhale: showDecoration(Decoration::Sweat, _action_duration_ms); break;
        case Action::Wink: showDecoration(Decoration::Shy, _action_duration_ms); break;
        case Action::None:
        case Action::Nod:
        case Action::ShakeHead:
        case Action::Wave:
        case Action::Sigh:
        case Action::ClearThroat:
        case Action::Scoff:
        case Action::Pant:
        case Action::Yawn: break;
    }
    updateAction();
}

void AiLiciaAvatarClient::updateAction()
{
    if (_action == Action::None || !GetStackChan().hasAvatar()) return;
    const uint32_t elapsed = GetHAL().millis() - _action_started_at;
    if (elapsed >= _action_duration_ms) {
        finishAction();
        return;
    }
    const int phase = std::min(3, static_cast<int>((elapsed * 4) / _action_duration_ms));
    if (phase == _action_phase) return;
    _action_phase = phase;
    auto& stackchan = GetStackChan();
    auto& avatar = stackchan.avatar();
    auto& motion = stackchan.motion();
    const int side = phase % 2 == 0 ? -1 : 1;
    switch (_action) {
        case Action::Wink:
            avatar.setEmotion(avatar::Emotion::Happy);
            avatar.leftEye().setWeight(phase < 2 ? 6 : 72);
            GetHAL().showRgbColor(45, 8, 28);
            break;
        case Action::Nod:
        case Action::ClearThroat:
            motion.moveWithSpeed(0, phase % 2 == 0 ? 120 : 25, 250);
            break;
        case Action::ShakeHead:
        case Action::Scoff:
        case Action::Wave:
            motion.moveWithSpeed(side * 115, 55, 270);
            break;
        case Action::Rage:
            avatar.setEmotion(avatar::Emotion::Angry);
            GetHAL().showRgbColor(80, 0, 0);
            motion.moveWithSpeed(side * 95, 180 + side * 15, 340);
            break;
        case Action::Celebrate:
            avatar.setEmotion(avatar::Emotion::Happy);
            GetHAL().showRgbColor(phase % 2 == 0 ? 80 : 70, 15, phase % 2 == 0 ? 45 : 5);
            motion.moveWithSpeed(side * 125, phase < 2 ? 20 : 65, 330);
            break;
        case Action::Laugh:
        case Action::Pant:
            avatar.setEmotion(avatar::Emotion::Happy);
            motion.moveWithSpeed(0, phase % 2 == 0 ? 20 : 95, 270);
            break;
        case Action::SurprisedRecoil:
        case Action::SharpExhale:
            avatar.setEmotion(avatar::Emotion::Neutral);
            avatar.leftEye().setSize(70);
            avatar.rightEye().setSize(70);
            GetHAL().showRgbColor(80, 45, 0);
            motion.moveWithSpeed(0, phase == 0 ? 0 : 55, 340);
            break;
        case Action::Sigh:
            avatar.setEmotion(avatar::Emotion::Sad);
            motion.moveWithSpeed(0, phase < 3 ? 230 : 100, 100);
            break;
        case Action::Yawn:
            avatar.setEmotion(avatar::Emotion::Sleepy);
            avatar.mouth().setWeight(phase < 3 ? 80 : 10);
            motion.moveWithSpeed(0, 125, 90);
            break;
        case Action::None: break;
    }
}

void AiLiciaAvatarClient::finishAction()
{
    _action = Action::None;
    _action_phase = 0;
    clearDecoration();
    applyExpression(_expression, _expression_weight);
    postponeIdleAnimations();
}

void AiLiciaAvatarClient::setSpeechState(SpeechState state, const char* utteranceId)
{
    _speech_state = state;
    if (state == SpeechState::Idle) {
        _active_utterance_id.clear();
    } else {
        _active_utterance_id = utteranceId ? utteranceId : "";
    }
}

void AiLiciaAvatarClient::queueMouthAmplitude(const char* utteranceId, uint32_t offsetMs,
                                               float value)
{
    const std::string id = utteranceId ? utteranceId : "";
    if (id.empty()) return;
    if (_audio_encoding == AiLiciaAudioEncoding::None) {
        if (GetStackChan().hasAvatar()) {
            GetStackChan().avatar().mouth().setWeight(
                static_cast<int>(std::round(value * 100.0f)));
        }
        return;
    }
    if (_mouth_amplitude_cues.size() >= kMaxMouthAmplitudeCues) {
        _mouth_amplitude_cues.pop_front();
        mclog::tagWarn(kTag, "mouth cue buffer full; dropping oldest cue");
    }
    _mouth_amplitude_cues.push_back({id, offsetMs, value});
}

bool AiLiciaAvatarClient::shouldDeferUntilLocalPlayback(const char* utteranceId) const
{
    if (_audio_encoding == AiLiciaAudioEncoding::None || !utteranceId || !*utteranceId) {
        return false;
    }
    const auto playback = _audio.playbackState();
    return !playback.started || playback.utteranceId != utteranceId;
}

void AiLiciaAvatarClient::updateLocalPlayback()
{
    const auto playback = _audio.playbackState();
    if (playback.started && !playback.utteranceId.empty()) {
        const bool startedNow = _local_playback_utterance_id != playback.utteranceId;
        if (startedNow) {
            _local_playback_utterance_id = playback.utteranceId;
            const uint32_t startDelay = _protocol_playback_started_at == 0 ? 0 :
                GetHAL().millis() - _protocol_playback_started_at;
            mclog::tagInfo(kTag, "anchored face to local audio {} after {} ms",
                           playback.utteranceId, startDelay);

            if (_deferred_expression &&
                _deferred_expression->moment == DeferredPlaybackMoment::Start &&
                _deferred_expression->utteranceId == playback.utteranceId) {
                const auto expression = *_deferred_expression;
                _deferred_expression.reset();
                applyExpression(expression.expression, expression.weight);
            }
            for (auto action = _deferred_actions.begin(); action != _deferred_actions.end();) {
                if (action->utteranceId != playback.utteranceId) {
                    ++action;
                    continue;
                }
                const auto deferred = *action;
                action = _deferred_actions.erase(action);
                applyAction(deferred.action, deferred.intensity, deferred.durationMs);
            }
        }

        if (!playback.audible) {
            if (GetStackChan().hasAvatar()) GetStackChan().avatar().mouth().setWeight(0);
            return;
        }

        std::optional<float> latestWeight;
        for (auto cue = _mouth_amplitude_cues.begin(); cue != _mouth_amplitude_cues.end();) {
            if (cue->utteranceId != playback.utteranceId) {
                ++cue;
                continue;
            }
            if (cue->offsetMs > playback.positionMs) {
                ++cue;
                continue;
            }
            latestWeight = cue->value;
            cue = _mouth_amplitude_cues.erase(cue);
        }
        if (latestWeight && GetStackChan().hasAvatar()) {
            GetStackChan().avatar().mouth().setWeight(
                static_cast<int>(std::round(*latestWeight * 100.0f)));
        }
        return;
    }

    std::string completedUtterance;
    if (!_local_playback_utterance_id.empty() &&
        (!playback.prepared || playback.utteranceId != _local_playback_utterance_id)) {
        completedUtterance = _local_playback_utterance_id;
    } else if (_local_playback_utterance_id.empty() &&
               !_finishing_local_utterance_id.empty() && !playback.prepared) {
        completedUtterance = _finishing_local_utterance_id;
    }
    if (completedUtterance.empty()) return;

    mclog::tagInfo(kTag, "local audio completed for {}", completedUtterance);
    if (_deferred_expression &&
        _deferred_expression->moment == DeferredPlaybackMoment::End &&
        _deferred_expression->utteranceId == completedUtterance) {
        const auto expression = *_deferred_expression;
        _deferred_expression.reset();
        applyExpression(expression.expression, expression.weight);
    }
    if (_active_utterance_id.empty() || _active_utterance_id == completedUtterance) {
        setSpeechState(SpeechState::Idle);
        postponeIdleAnimations();
    }
    clearLocalPlaybackState(completedUtterance);
}

void AiLiciaAvatarClient::clearLocalPlaybackState(const std::string& utteranceId)
{
    const bool clearAll = utteranceId.empty();
    if (clearAll || _local_playback_utterance_id == utteranceId) {
        _local_playback_utterance_id.clear();
        if (GetStackChan().hasAvatar()) GetStackChan().avatar().mouth().setWeight(0);
    }
    if (clearAll || _finishing_local_utterance_id == utteranceId) {
        _finishing_local_utterance_id.clear();
    }
    if (clearAll || _active_utterance_id.empty() ||
        _active_utterance_id == utteranceId) {
        _protocol_playback_started_at = 0;
    }

    for (auto cue = _mouth_amplitude_cues.begin(); cue != _mouth_amplitude_cues.end();) {
        if (clearAll || cue->utteranceId == utteranceId) cue = _mouth_amplitude_cues.erase(cue);
        else ++cue;
    }
    for (auto action = _deferred_actions.begin(); action != _deferred_actions.end();) {
        if (clearAll || action->utteranceId == utteranceId) action = _deferred_actions.erase(action);
        else ++action;
    }
    if (_deferred_expression &&
        (clearAll || _deferred_expression->utteranceId == utteranceId)) {
        _deferred_expression.reset();
    }
}

void AiLiciaAvatarClient::postponeIdleAnimations()
{
    scheduleNextEyeIdleAnimation();
    scheduleNextFullIdleAnimation();
}

void AiLiciaAvatarClient::scheduleNextEyeIdleAnimation()
{
    _next_eye_idle_at = GetHAL().millis() +
        Random::getInstance().getInt(kEyeIdleMinDelayMs, kEyeIdleMaxDelayMs);
}

void AiLiciaAvatarClient::scheduleNextFullIdleAnimation()
{
    _next_full_idle_at = GetHAL().millis() +
        Random::getInstance().getInt(kFullIdleMinDelayMs, kFullIdleMaxDelayMs);
}

void AiLiciaAvatarClient::updateIdleAnimation(bool connected)
{
    const IdleBlockReason blockReason = !connected ? IdleBlockReason::Disconnected :
        _speech_state == SpeechState::Playing ? IdleBlockReason::Speech :
        _action != Action::None ? IdleBlockReason::Action :
        !GetStackChan().hasAvatar() ? IdleBlockReason::MissingAvatar : IdleBlockReason::None;
    if (blockReason != _idle_block_reason) {
        _idle_block_reason = blockReason;
        switch (blockReason) {
            case IdleBlockReason::None: mclog::tagInfo(kTag, "idle animations ready"); break;
            case IdleBlockReason::Disconnected:
                mclog::tagInfo(kTag, "idle animations blocked: disconnected");
                break;
            case IdleBlockReason::Speech:
                mclog::tagInfo(kTag, "idle animations blocked: speech playing");
                break;
            case IdleBlockReason::Action:
                mclog::tagInfo(kTag, "idle animations blocked: action playing");
                break;
            case IdleBlockReason::MissingAvatar:
                mclog::tagInfo(kTag, "idle animations blocked: avatar unavailable");
                break;
        }
    }
    if (blockReason != IdleBlockReason::None) {
        cancelIdleAnimation();
        return;
    }
    if (_next_eye_idle_at == 0 || _next_full_idle_at == 0) postponeIdleAnimations();

    const uint32_t now = GetHAL().millis();
    if (_idle_animation == IdleAnimation::None) {
        if (timeReached(now, _next_full_idle_at)) {
            startIdleAnimation(chooseFullIdleAnimation());
        } else if (timeReached(now, _next_eye_idle_at)) {
            startIdleAnimation(chooseEyeIdleAnimation());
        }
        return;
    }

    const uint32_t elapsed = now - _idle_started_at;
    if (elapsed >= _idle_duration_ms) {
        finishIdleAnimation();
        return;
    }
    if (!isEyeIdleAnimation(_idle_animation)) {
        const uint32_t progress = elapsed * 100 / _idle_duration_ms;
        const FullIdlePhase phase = progress < 18 ? FullIdlePhase::FirstLook :
            progress < 40 ? FullIdlePhase::FirstHold :
            progress < 46 ? FullIdlePhase::SecondEyes :
            progress < 65 ? FullIdlePhase::SecondLook :
            progress < 78 ? FullIdlePhase::SecondHold : FullIdlePhase::Return;
        if (phase != _full_idle_phase) applyFullIdlePhase(phase);
        return;
    }

    const int phase = _idle_animation == IdleAnimation::EyeRoll ?
        std::min(4, static_cast<int>(elapsed / 280)) : elapsed < 650 ? 0 : 1;
    if (phase != _idle_phase) applyIdleAnimationPhase(phase);
}

void AiLiciaAvatarClient::startIdleAnimation(IdleAnimation animation)
{
    _idle_animation = animation;
    _idle_started_at = GetHAL().millis();
    _idle_phase = -1;
    if (isEyeIdleAnimation(animation)) {
        _idle_duration_ms = animation == IdleAnimation::EyeRoll ? 1400 : 1000;
    } else {
        _idle_duration_ms = Random::getInstance().getInt(kFullIdleMinDurationMs,
                                                         kFullIdleMaxDurationMs);
        _first_idle_gaze = gazeTargetForAnimation(animation);
        _second_idle_gaze = chooseSecondaryGazeTarget(_first_idle_gaze);
        _full_idle_phase = FullIdlePhase::FirstLook;
    }
    mclog::tagInfo(kTag, "starting idle animation {}", static_cast<int>(animation));
    if (isEyeIdleAnimation(animation)) applyIdleAnimationPhase(0);
    else applyFullIdlePhase(FullIdlePhase::FirstLook);
}

void AiLiciaAvatarClient::applyIdleAnimationPhase(int phase)
{
    if (!GetStackChan().hasAvatar()) return;
    _idle_phase = phase;
    auto& avatar = GetStackChan().avatar();
    auto setEyes = [&](int x, int y) {
        avatar.leftEye().setPosition({x, y});
        avatar.rightEye().setPosition({x, y});
    };
    const bool restoring = phase > 0 && _idle_animation != IdleAnimation::EyeRoll;
    if (restoring) {
        setEyes(0, 0);
        renderExpression(_expression, _expression_weight);
        return;
    }
    switch (_idle_animation) {
        case IdleAnimation::GlanceLeft: setEyes(-65, 0); break;
        case IdleAnimation::GlanceRight: setEyes(65, 0); break;
        case IdleAnimation::GlanceUp: setEyes(0, -65); break;
        case IdleAnimation::GlanceDown: setEyes(0, 65); break;
        case IdleAnimation::EyeRoll: {
            constexpr int positions[5][2] = {{-60, 0}, {0, -60}, {60, 0}, {0, 60}, {0, 0}};
            setEyes(positions[phase][0], positions[phase][1]);
            break;
        }
        case IdleAnimation::LookLeft:
        case IdleAnimation::LookRight:
        case IdleAnimation::LookUp:
        case IdleAnimation::LookDown:
        case IdleAnimation::CuriousScan: break;
        case IdleAnimation::None: break;
    }
}

void AiLiciaAvatarClient::applyFullIdlePhase(FullIdlePhase phase)
{
    if (!GetStackChan().hasAvatar()) return;
    _full_idle_phase = phase;
    switch (phase) {
        case FullIdlePhase::FirstLook:
            applyIdleGaze(_first_idle_gaze, true);
            break;
        case FullIdlePhase::FirstHold:
        case FullIdlePhase::SecondHold:
            break;
        case FullIdlePhase::SecondEyes:
            applyIdleGaze(_second_idle_gaze, false);
            break;
        case FullIdlePhase::SecondLook:
            applyIdleGaze(_second_idle_gaze, true);
            break;
        case FullIdlePhase::Return:
            renderExpression(_expression, _expression_weight, kIdleServoSpeed);
            break;
    }
}

void AiLiciaAvatarClient::applyIdleGaze(IdleGazeTarget target, bool moveHead)
{
    auto& avatar = GetStackChan().avatar();
    auto& motion = GetStackChan().motion();
    int eyeX = 0;
    int eyeY = 0;
    int yaw = 0;
    int pitch = 65;
    switch (target) {
        case IdleGazeTarget::Left: eyeX = -40; yaw = -105; break;
        case IdleGazeTarget::Right: eyeX = 40; yaw = 105; break;
        case IdleGazeTarget::Up: eyeY = -40; pitch = 165; break;
        case IdleGazeTarget::Down: eyeY = 40; pitch = 30; break;
    }
    avatar.leftEye().setPosition({eyeX, eyeY});
    avatar.rightEye().setPosition({eyeX, eyeY});
    if (moveHead) motion.moveWithSpeed(yaw, pitch, kIdleServoSpeed);
}

void AiLiciaAvatarClient::finishIdleAnimation()
{
    if (_idle_animation == IdleAnimation::None) return;
    const IdleAnimation completedAnimation = _idle_animation;
    _idle_animation = IdleAnimation::None;
    _idle_phase = -1;
    renderExpression(_expression, _expression_weight);
    if (isEyeIdleAnimation(completedAnimation)) scheduleNextEyeIdleAnimation();
    else scheduleNextFullIdleAnimation();
}

void AiLiciaAvatarClient::cancelIdleAnimation()
{
    if (_idle_animation != IdleAnimation::None) finishIdleAnimation();
}

bool AiLiciaAvatarClient::isEyeIdleAnimation(IdleAnimation animation) const
{
    switch (animation) {
        case IdleAnimation::GlanceLeft:
        case IdleAnimation::GlanceRight:
        case IdleAnimation::GlanceUp:
        case IdleAnimation::GlanceDown:
        case IdleAnimation::EyeRoll: return true;
        case IdleAnimation::None:
        case IdleAnimation::LookLeft:
        case IdleAnimation::LookRight:
        case IdleAnimation::LookUp:
        case IdleAnimation::LookDown:
        case IdleAnimation::CuriousScan: return false;
    }
    return false;
}

AiLiciaAvatarClient::IdleAnimation AiLiciaAvatarClient::chooseEyeIdleAnimation()
{
    IdleAnimation selected = IdleAnimation::GlanceLeft;
    do {
        switch (Random::getInstance().getInt(0, 4)) {
            case 0: selected = IdleAnimation::GlanceLeft; break;
            case 1: selected = IdleAnimation::GlanceRight; break;
            case 2: selected = IdleAnimation::GlanceUp; break;
            case 3: selected = IdleAnimation::GlanceDown; break;
            default: selected = IdleAnimation::EyeRoll; break;
        }
    } while (selected == _last_eye_idle_animation);
    _last_eye_idle_animation = selected;
    return selected;
}

AiLiciaAvatarClient::IdleAnimation AiLiciaAvatarClient::chooseFullIdleAnimation()
{
    IdleAnimation selected = IdleAnimation::LookLeft;
    do {
        switch (Random::getInstance().getInt(0, 4)) {
            case 0: selected = IdleAnimation::LookLeft; break;
            case 1: selected = IdleAnimation::LookRight; break;
            case 2: selected = IdleAnimation::LookUp; break;
            case 3: selected = IdleAnimation::LookDown; break;
            default: selected = IdleAnimation::CuriousScan; break;
        }
    } while (selected == _last_full_idle_animation);
    _last_full_idle_animation = selected;
    return selected;
}

AiLiciaAvatarClient::IdleGazeTarget AiLiciaAvatarClient::gazeTargetForAnimation(
    IdleAnimation animation)
{
    switch (animation) {
        case IdleAnimation::LookLeft: return IdleGazeTarget::Left;
        case IdleAnimation::LookRight: return IdleGazeTarget::Right;
        case IdleAnimation::LookUp: return IdleGazeTarget::Up;
        case IdleAnimation::LookDown: return IdleGazeTarget::Down;
        case IdleAnimation::CuriousScan:
            return static_cast<IdleGazeTarget>(Random::getInstance().getInt(0, 3));
        case IdleAnimation::None:
        case IdleAnimation::GlanceLeft:
        case IdleAnimation::GlanceRight:
        case IdleAnimation::GlanceUp:
        case IdleAnimation::GlanceDown:
        case IdleAnimation::EyeRoll: return IdleGazeTarget::Left;
    }
    return IdleGazeTarget::Left;
}

AiLiciaAvatarClient::IdleGazeTarget AiLiciaAvatarClient::chooseSecondaryGazeTarget(
    IdleGazeTarget first)
{
    const bool chooseFirst = Random::getInstance().getInt(0, 1) == 0;
    switch (first) {
        case IdleGazeTarget::Left:
        case IdleGazeTarget::Right:
            return chooseFirst ? IdleGazeTarget::Up : IdleGazeTarget::Down;
        case IdleGazeTarget::Up:
        case IdleGazeTarget::Down:
            return chooseFirst ? IdleGazeTarget::Left : IdleGazeTarget::Right;
    }
    return IdleGazeTarget::Right;
}

void AiLiciaAvatarClient::applyLights(Expression expression, float weight)
{
    if (expression == Expression::Neutral || weight < 0.15f) {
        GetHAL().showRgbColor(0, 0, 0);
        return;
    }
    uint8_t red = 0, green = 0, blue = 0;
    switch (expression) {
        case Expression::Happy: red = 80; green = 15; blue = 45; break;
        case Expression::Angry: red = 90; break;
        case Expression::Sad: red = 8; green = 20; blue = 90; break;
        case Expression::Relaxed: red = 8; green = 55; blue = 80; break;
        case Expression::Surprised: red = 90; green = 45; break;
        case Expression::Neutral: break;
    }
    GetHAL().showRgbColor(scaleChannel(red, weight), scaleChannel(green, weight), scaleChannel(blue, weight));
}

void AiLiciaAvatarClient::applyPose(Expression expression, float weight, int speedOverride)
{
    int target = 45;
    int speed = 160;
    switch (expression) {
        case Expression::Happy: target = 65; speed = 220; break;
        case Expression::Angry: target = 170; speed = 280; break;
        case Expression::Sad: target = 240; speed = 105; break;
        case Expression::Relaxed: target = 115; speed = 115; break;
        case Expression::Surprised: target = 55; speed = 300; break;
        case Expression::Neutral: break;
    }
    const int pitch = static_cast<int>(std::round(45 + (target - 45) * weight));
    GetStackChan().motion().moveWithSpeed(0, pitch, speedOverride > 0 ? speedOverride : speed);
}

void AiLiciaAvatarClient::setState(AiLiciaConnectionState state, std::string text)
{
    mclog::tagInfo(kTag, "connection state: {}", text);
    std::lock_guard<std::mutex> lock(_mutex);
    _state = state;
    _status = std::move(text);
}

std::string AiLiciaAvatarClient::makeClientId() const
{
    std::string uuid = Board::GetInstance().GetUuid();
    uuid.erase(std::remove(uuid.begin(), uuid.end(), '-'), uuid.end());
    if (uuid.size() > 12) uuid.resize(12);
    return "ai-licia-stackchan-" + uuid;
}

