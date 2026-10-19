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
#include <mdns.h>
#include <mooncake_log.h>
#include <settings.h>
#include <smooth_lvgl.hpp>
#include <web_socket.h>
#include <hal/hal.h>
#include <stackchan/stackchan.h>

using namespace stackchan;

namespace {
const std::string_view kTag = "AI-Licia";
constexpr const char* kSettingsNamespace = "ai_licia";
constexpr const char* kDesktopIdKey = "desktop_id";
constexpr const char* kCredentialKey = "credential";
constexpr uint32_t kReconnectDelayMs = 5000;
constexpr uint32_t kDiscoveryIntervalMs = 5000;

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
    for (auto* address = result ? result->addr : nullptr; address; address = address->next) {
        if (address->addr.type != ESP_IPADDR_TYPE_V4) continue;
        char text[16]{};
        std::snprintf(text, sizeof(text), IPSTR, IP2STR(&address->addr.u_addr.ip4));
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
    _audio.stop();
    for (int attempt = 0; attempt < 250 && _discovery_task; ++attempt) {
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void AiLiciaAvatarClient::update()
{
    std::queue<std::string> messages;
    {
        std::lock_guard<std::mutex> lock(_mutex);
        std::swap(messages, _messages);
    }
    while (!messages.empty()) {
        {
            LvglLockGuard lock;
            handleMessage(messages.front());
        }
        messages.pop();
    }

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

    {
        LvglLockGuard lock;
        updateAction();
        if (_speech_active && _action == Action::None &&
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
    if (remembered != _desktops.end()) {
        _selected = *remembered;
        if (!_websocket || !_websocket->IsConnected()) {
            _state = AiLiciaConnectionState::Connecting;
            _status = "Connecting to " + _selected.displayName;
        }
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
        queueMessage(data, length, binary);
    });

    const std::string url = "ws://" + endpoint.host + ":" + std::to_string(endpoint.port);
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
        while (!_messages.empty()) _messages.pop();
        _subscription_id.clear();
        _last_delivery_sequence = 0;
    }
    websocket.reset();
}

void AiLiciaAvatarClient::queueMessage(const char* data, size_t length, bool binary)
{
    if (binary || !data || length == 0 || length > 196608) return;
    std::lock_guard<std::mutex> lock(_mutex);
    if (_messages.size() >= 32) _messages.pop();
    _messages.emplace(data, length);
}

void AiLiciaAvatarClient::handleMessage(const std::string& message)
{
    ArduinoJson::JsonDocument document;
    const auto error = ArduinoJson::deserializeJson(document, message);
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
    if (sequence > 0 && _last_delivery_sequence > 0 && sequence != _last_delivery_sequence + 1) {
        _audio.end(data["utteranceId"] | "");
        _last_delivery_sequence = sequence;
        requestState();
        return;
    }
    if (sequence > 0) _last_delivery_sequence = sequence;

    if (std::strcmp(name, "avatar.state.snapshot") == 0) {
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
        applyExpression(strongest, strongestWeight);
    } else if (std::strcmp(name, "avatar.mouth.amplitude") == 0) {
        if (GetStackChan().hasAvatar()) {
            const float value = std::clamp(data["value"] | 0.0f, 0.0f, 1.0f);
            GetStackChan().avatar().mouth().setWeight(static_cast<int>(std::round(value * 100.0f)));
        }
    } else if (std::strcmp(name, "avatar.speech.started") == 0 ||
               std::strcmp(name, "avatar.speech.resumed") == 0) {
        const char* utteranceId = data["utteranceId"] | "";
        _speech_active = true;
        _audio.setPlaying(utteranceId, true);
    } else if (std::strcmp(name, "avatar.speech.paused") == 0) {
        const char* utteranceId = data["utteranceId"] | "";
        _speech_active = false;
        _audio.setPlaying(utteranceId, false);
    } else if (std::strcmp(name, "avatar.speech.ended") == 0) {
        const char* utteranceId = data["utteranceId"] | "";
        _speech_active = false;
        _audio.end(utteranceId);
        if (GetStackChan().hasAvatar()) GetStackChan().avatar().mouth().setWeight(0);
    } else if (std::strcmp(name, "avatar.audio.prepared") == 0) {
        _audio.prepare(data["utteranceId"] | "", data["audioItemId"] | "",
                       data["sampleRateHz"] | 0);
    } else if (std::strcmp(name, "avatar.audio.chunk") == 0) {
        const char* encoded = data["dataBase64"] | "";
        _audio.pushPcmBase64(data["audioItemId"] | "", data["chunkIndex"] | 0,
                             data["sampleOffset"] | 0, encoded, std::strlen(encoded));
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
        applyAction(action, std::clamp(data["intensity"] | 1.0f, 0.0f, 1.0f),
                    data["durationMs"] | 700);
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
             std::pair{"avatar.audio.pcm-s16le.v1", false},
         }) {
        auto item = profiles.add<ArduinoJson::JsonObject>();
        item["id"] = profile.first;
        item["required"] = profile.second;
    }
    payload["speechDriverPreference"].to<ArduinoJson::JsonArray>().add("avatar.mouth.amplitude.v1");
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
    _expression = expression;
    _expression_weight = std::clamp(weight, 0.0f, 1.0f);
    if (_action != Action::None || !GetStackChan().hasAvatar()) return;
    auto& avatar = GetStackChan().avatar();
    if (_expression_weight < 0.15f) expression = Expression::Neutral;
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
    applyLights(expression, _expression_weight);
    applyPose(expression, _expression_weight);
}

void AiLiciaAvatarClient::applyAction(Action action, float intensity, uint32_t durationMs)
{
    if (action == Action::None || intensity <= 0.0f) return;
    _action = action;
    _action_started_at = GetHAL().millis();
    _action_duration_ms = std::max<uint32_t>(durationMs, 300);
    _action_phase = -1;
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
    applyExpression(_expression, _expression_weight);
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

void AiLiciaAvatarClient::applyPose(Expression expression, float weight)
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
    GetStackChan().motion().moveWithSpeed(0, pitch, speed);
}

void AiLiciaAvatarClient::setState(AiLiciaConnectionState state, std::string text)
{
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

