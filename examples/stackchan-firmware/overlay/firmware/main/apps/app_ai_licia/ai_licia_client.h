/*
 * SPDX-FileCopyrightText: 2026 NovaSquare Ltd
 *
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "ai_licia_audio.h"

#include <cstdint>
#include <memory>
#include <mutex>
#include <queue>
#include <string>
#include <vector>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <ArduinoJson.hpp>

class WebSocket;

struct AiLiciaDesktopEndpoint {
    std::string installationId;
    std::string displayName;
    std::string host;
    uint16_t port = 51743;
};

enum class AiLiciaConnectionState {
    Discovering,
    ChooseDesktop,
    Connecting,
    AwaitingApproval,
    Subscribing,
    Ready,
    Error,
};

class AiLiciaAvatarClient {
public:
    AiLiciaAvatarClient();
    ~AiLiciaAvatarClient();

    void start();
    void stop();
    void update();
    void selectDesktop(const std::string& installationId);

    AiLiciaConnectionState state() const;
    std::string statusText() const;
    std::vector<AiLiciaDesktopEndpoint> desktops() const;

private:
    enum class Expression { Neutral, Happy, Angry, Sad, Relaxed, Surprised };
    enum class Action {
        None,
        Wink,
        Nod,
        ShakeHead,
        Rage,
        Celebrate,
        Laugh,
        SurprisedRecoil,
        Wave,
        Sigh,
        ClearThroat,
        Scoff,
        Pant,
        SharpExhale,
        Yawn,
    };

    static void discoveryTaskEntry(void* context);
    void discoveryTaskLoop();
    void discover();
    void connect(const AiLiciaDesktopEndpoint& endpoint);
    void disconnect();
    void queueMessage(const char* data, size_t length, bool binary);
    void handleMessage(const std::string& message);
    void handleWelcome(const ArduinoJson::JsonDocument& document);
    void handleEvent(const ArduinoJson::JsonDocument& document);
    void requestAccess();
    void subscribe();
    void requestState();
    void applyExpression(Expression expression, float weight);
    void applyAction(Action action, float intensity, uint32_t durationMs);
    void updateAction();
    void finishAction();
    void applyLights(Expression expression, float weight);
    void applyPose(Expression expression, float weight);
    void setState(AiLiciaConnectionState state, std::string text);
    std::string makeClientId() const;

    mutable std::mutex _mutex;
    std::unique_ptr<WebSocket> _websocket;
    std::queue<std::string> _messages;
    std::vector<AiLiciaDesktopEndpoint> _desktops;
    AiLiciaDesktopEndpoint _selected;
    AiLiciaConnectionState _state = AiLiciaConnectionState::Discovering;
    std::string _status = "Looking for ai_licia Desktop";
    std::string _client_id;
    std::string _reconnect_credential;
    std::string _subscription_id;
    uint64_t _last_delivery_sequence = 0;
    uint32_t _last_connect_attempt = 0;
    bool _running = false;
    bool _discovery_refresh_requested = true;
    TaskHandle_t _discovery_task = nullptr;

    Expression _expression = Expression::Neutral;
    float _expression_weight = 0.0f;
    Action _action = Action::None;
    uint32_t _action_started_at = 0;
    uint32_t _action_duration_ms = 0;
    int _action_phase = 0;
    bool _speech_active = false;
    uint32_t _last_speech_motion_at = 0;
    int _speech_motion_phase = 0;
    AiLiciaAudioOutput _audio;
};

