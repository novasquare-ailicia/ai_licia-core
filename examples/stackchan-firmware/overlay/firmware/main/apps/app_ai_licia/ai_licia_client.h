/*
 * SPDX-FileCopyrightText: 2026 NovaSquare Ltd
 *
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "ai_licia_audio.h"

#include <cstdint>
#include <deque>
#include <memory>
#include <mutex>
#include <optional>
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
    enum class Decoration { None, Heart, Angry, Sweat, Shy };
    enum class SpeechState { Idle, Playing, Paused };
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
    enum class IdleAnimation {
        None,
        GlanceLeft,
        GlanceRight,
        GlanceUp,
        GlanceDown,
        EyeRoll,
        LookLeft,
        LookRight,
        LookUp,
        LookDown,
        CuriousScan,
    };
    enum class IdleGazeTarget { Left, Right, Up, Down };
    enum class FullIdlePhase { FirstLook, FirstHold, SecondEyes, SecondLook, SecondHold, Return };
    enum class IdleBlockReason { None, Disconnected, Speech, Action, MissingAvatar };
    enum class DeferredPlaybackMoment { Start, End };

    struct MouthAmplitudeCue {
        std::string utteranceId;
        uint32_t offsetMs = 0;
        float value = 0.0f;
    };

    struct DeferredExpression {
        std::string utteranceId;
        Expression expression = Expression::Neutral;
        float weight = 0.0f;
        DeferredPlaybackMoment moment = DeferredPlaybackMoment::Start;
    };

    struct DeferredAction {
        std::string utteranceId;
        Action action = Action::None;
        float intensity = 0.0f;
        uint32_t durationMs = 0;
    };

    static void discoveryTaskEntry(void* context);
    void discoveryTaskLoop();
    void discover();
    void connect(const AiLiciaDesktopEndpoint& endpoint);
    void disconnect();
    void handleMessage(std::string& message);
    void handleBinaryMessage(const char* message, size_t length);
    bool acceptDeliverySequence(uint64_t sequence, const char* utteranceId = "");
    void handleWelcome(const ArduinoJson::JsonDocument& document);
    void handleEvent(const ArduinoJson::JsonDocument& document);
    void requestAccess();
    void subscribe();
    void requestState();
    void applyExpression(Expression expression, float weight);
    void renderExpression(Expression expression, float weight, int poseSpeedOverride = 0);
    void updateExpressionDecoration(Expression expression, float weight);
    void showDecoration(Decoration decoration, uint32_t durationMs);
    void updateDecoration();
    void clearDecoration();
    void applyAction(Action action, float intensity, uint32_t durationMs);
    void updateAction();
    void finishAction();
    void setSpeechState(SpeechState state, const char* utteranceId = "");
    void queueMouthAmplitude(const char* utteranceId, uint32_t offsetMs, float value);
    void updateLocalPlayback();
    bool shouldDeferUntilLocalPlayback(const char* utteranceId) const;
    void clearLocalPlaybackState(const std::string& utteranceId);
    void scheduleNextEyeIdleAnimation();
    void scheduleNextFullIdleAnimation();
    void postponeIdleAnimations();
    void updateIdleAnimation(bool connected);
    void startIdleAnimation(IdleAnimation animation);
    void applyIdleAnimationPhase(int phase);
    void applyFullIdlePhase(FullIdlePhase phase);
    void applyIdleGaze(IdleGazeTarget target, bool moveHead);
    void finishIdleAnimation();
    void cancelIdleAnimation();
    bool isEyeIdleAnimation(IdleAnimation animation) const;
    IdleAnimation chooseEyeIdleAnimation();
    IdleAnimation chooseFullIdleAnimation();
    IdleGazeTarget gazeTargetForAnimation(IdleAnimation animation);
    IdleGazeTarget chooseSecondaryGazeTarget(IdleGazeTarget first);
    void applyLights(Expression expression, float weight);
    void applyPose(Expression expression, float weight, int speedOverride = 0);
    void setState(AiLiciaConnectionState state, std::string text);
    std::string makeClientId() const;

    mutable std::mutex _mutex;
    std::unique_ptr<WebSocket> _websocket;
    std::vector<AiLiciaDesktopEndpoint> _desktops;
    AiLiciaDesktopEndpoint _selected;
    AiLiciaConnectionState _state = AiLiciaConnectionState::Discovering;
    std::string _status = "Looking for ai_licia Desktop";
    std::string _client_id;
    std::string _reconnect_credential;
    std::string _subscription_id;
    uint64_t _last_delivery_sequence = 0;
    uint32_t _last_connect_attempt = 0;
    AiLiciaAudioEncoding _audio_encoding = AiLiciaAudioEncoding::None;
    bool _running = false;
    bool _discovery_refresh_requested = true;
    TaskHandle_t _discovery_task = nullptr;

    Expression _expression = Expression::Neutral;
    float _expression_weight = 0.0f;
    Decoration _decoration = Decoration::None;
    int _decoration_id = -1;
    uint32_t _decoration_expires_at = 0;
    Action _action = Action::None;
    uint32_t _action_started_at = 0;
    uint32_t _action_duration_ms = 0;
    int _action_phase = 0;
    SpeechState _speech_state = SpeechState::Idle;
    std::string _active_utterance_id;
    std::string _local_playback_utterance_id;
    std::string _finishing_local_utterance_id;
    uint32_t _protocol_playback_started_at = 0;
    std::deque<MouthAmplitudeCue> _mouth_amplitude_cues;
    std::optional<DeferredExpression> _deferred_expression;
    std::deque<DeferredAction> _deferred_actions;
    uint32_t _last_speech_motion_at = 0;
    int _speech_motion_phase = 0;
    IdleAnimation _idle_animation = IdleAnimation::None;
    IdleAnimation _last_eye_idle_animation = IdleAnimation::None;
    IdleAnimation _last_full_idle_animation = IdleAnimation::None;
    uint32_t _idle_started_at = 0;
    uint32_t _idle_duration_ms = 0;
    int _idle_phase = -1;
    FullIdlePhase _full_idle_phase = FullIdlePhase::FirstLook;
    IdleGazeTarget _first_idle_gaze = IdleGazeTarget::Left;
    IdleGazeTarget _second_idle_gaze = IdleGazeTarget::Right;
    uint32_t _next_eye_idle_at = 0;
    uint32_t _next_full_idle_at = 0;
    IdleBlockReason _idle_block_reason = IdleBlockReason::Disconnected;
    AiLiciaAudioOutput _audio;
};

