import { Static, TSchema, Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export const AVATAR_PROTOCOL_CAPABILITY = 'avatar.protocol.v1' as const;
export const AVATAR_PROTOCOL_VERSION = 1 as const;
export const AVATAR_EVENTS_SCOPE = 'avatar.events.read' as const;

export const LOCAL_INTEGRATION_SCOPES = [
  'rest.full',
  'vision.rtmp.configure',
  'vision.installation.register',
  AVATAR_EVENTS_SCOPE
] as const;

export const AVATAR_STANDARD_PROFILES = [
  'avatar.speech.lifecycle.v1',
  'avatar.mouth.amplitude.v1',
  'avatar.mouth.viseme-15.v1',
  'avatar.mouth.arkit-speech.v1',
  'avatar.expression.vrm.v1',
  'avatar.action.semantic.v1',
  'avatar.audio.pcm-s16le.v1',
  'avatar.audio.opus.v1'
] as const;

export const AVATAR_AUDIO_PROFILES = [
  'avatar.audio.pcm-s16le.v1',
  'avatar.audio.opus.v1'
] as const;

export const AVATAR_AUDIO_TRANSPORTS = [
  'binary-v1',
  'json-base64'
] as const;

export const AVATAR_PCM_SAMPLE_RATES = [24000, 44100, 48000] as const;
export const AVATAR_OPUS_SAMPLE_RATES = [24000, 48000] as const;
export const AVATAR_OPUS_FRAME_DURATIONS_MS = [20, 40, 60] as const;

export const AVATAR_MOUTH_PROFILES = [
  'avatar.mouth.arkit-speech.v1',
  'avatar.mouth.viseme-15.v1',
  'avatar.mouth.amplitude.v1'
] as const;

export const AVATAR_TONE_IDS = [
  'neutral',
  'affectionate',
  'angry',
  'calm',
  'chat',
  'cheerful',
  'depressed',
  'disgruntled',
  'embarrassed',
  'empathetic',
  'envious',
  'excited',
  'fearful',
  'friendly',
  'gentle',
  'hopeful',
  'lyrical',
  'newscast-casual',
  'newscast-formal',
  'sad',
  'poetry-reading',
  'serious',
  'shouting',
  'sports_commentary',
  'sports_commentary_excited',
  'whispering',
  'terrified',
  'unfriendly'
] as const;

export const AVATAR_VISEME_IDS = [
  'sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'ih', 'oh', 'ou'
] as const;

export const AVATAR_EXPRESSION_IDS = [
  'neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'
] as const;

export const AVATAR_SPEECH_DELIVERY_IDS = [
  'neutral', 'curious', 'warm', 'excited', 'playful', 'serious', 'whispering',
  'sarcastic', 'sad', 'calm', 'crying', 'singing', 'angry', 'menacing', 'weak', 'bored'
] as const;

export const AVATAR_SPEECH_REACTION_IDS = [
  'laugh', 'sigh', 'clear_throat', 'gasp', 'scoff', 'pant', 'sharp_exhale', 'yawn'
] as const;

export const AVATAR_SPEECH_GESTURE_IDS = [
  'wink', 'nod', 'shake_head', 'rage'
] as const;

export const AVATAR_STANDARD_ACTION_IDS = [
  'wave', 'nod', 'shake_head', 'celebrate', 'laugh', 'surprised_recoil'
] as const;

export const AVATAR_EVENT_NAMES = [
  'avatar.speech.prepared',
  'avatar.speech.started',
  'avatar.speech.paused',
  'avatar.speech.resumed',
  'avatar.speech.ended',
  'avatar.mouth.amplitude',
  'avatar.mouth.visemes',
  'avatar.mouth.arkit_frames',
  'avatar.expression.state',
  'avatar.action.triggered',
  'avatar.audio.prepared',
  'avatar.audio.chunk',
  'avatar.audio.completed',
  'avatar.state.snapshot'
] as const;

const enumSchema = <T extends readonly [string, ...string[]]>(values: T) =>
  Type.Union(values.map((value) => Type.Literal(value)));
const numericEnumSchema = <T extends readonly [number, ...number[]]>(values: T) =>
  Type.Union(values.map((value) => Type.Literal(value)));

const IdentifierSchema = Type.String({ minLength: 1, maxLength: 128 });
const RequestIdSchema = Type.String({ minLength: 1, maxLength: 64 });
const SafeIntegerSchema = Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
const PositiveSequenceSchema = Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });
const NormalizedWeightSchema = Type.Number({ minimum: 0, maximum: 1 });
const Base64Schema = Type.String({
  minLength: 4,
  maxLength: 131072,
  pattern: '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
});
const ExtensionProfilePattern = '^[a-z0-9]+(?:[.-][a-z0-9]+)+/[a-z0-9][a-z0-9._-]*\\.v[1-9][0-9]*$';
const ExtensionIdentifierPattern = '^[a-z0-9]+(?:[.-][a-z0-9]+)+/[a-z0-9][a-z0-9._-]*$';

export const AvatarStandardProfileIdSchema = enumSchema(AVATAR_STANDARD_PROFILES);
export const AvatarMouthProfileIdSchema = enumSchema(AVATAR_MOUTH_PROFILES);
export const AvatarAudioProfileIdSchema = enumSchema(AVATAR_AUDIO_PROFILES);
export const AvatarAudioTransportSchema = enumSchema(AVATAR_AUDIO_TRANSPORTS);
export const AvatarProfileIdSchema = Type.Union([
  AvatarStandardProfileIdSchema,
  Type.String({ pattern: ExtensionProfilePattern, maxLength: 128 })
]);
export const AvatarToneIdSchema = Type.Union([
  enumSchema(AVATAR_TONE_IDS),
  Type.String({ pattern: ExtensionIdentifierPattern, maxLength: 128 })
]);

const EventMetadataSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  avatarSessionId: IdentifierSchema,
  subscriptionId: IdentifierSchema,
  deliverySequence: PositiveSequenceSchema,
  emittedAtMs: SafeIntegerSchema
}, { additionalProperties: false });

const ProfileRequestSchema = Type.Object({
  id: AvatarProfileIdSchema,
  required: Type.Boolean()
}, { additionalProperties: false });

const RejectedProfileSchema = Type.Object({
  id: AvatarProfileIdSchema,
  reason: enumSchema(['unsupported', 'temporarily_unavailable', 'not_authorized'] as const)
}, { additionalProperties: false });

export const AvatarPcmAudioFormatSchema = Type.Object({
  profile: Type.Literal('avatar.audio.pcm-s16le.v1'),
  sampleRateHz: numericEnumSchema(AVATAR_PCM_SAMPLE_RATES),
  channels: Type.Literal(1)
}, { additionalProperties: false });

export const AvatarOpusAudioFormatSchema = Type.Object({
  profile: Type.Literal('avatar.audio.opus.v1'),
  sampleRateHz: numericEnumSchema(AVATAR_OPUS_SAMPLE_RATES),
  channels: Type.Literal(1),
  frameDurationMs: numericEnumSchema(AVATAR_OPUS_FRAME_DURATIONS_MS),
  bitrateBps: Type.Integer({ minimum: 6000, maximum: 128000 })
}, { additionalProperties: false });

export const AvatarAudioFormatSchema = Type.Union([
  AvatarPcmAudioFormatSchema,
  AvatarOpusAudioFormatSchema
]);

const LocalIntegrationScopeSchema = enumSchema(LOCAL_INTEGRATION_SCOPES);

export const LocalIntegrationAvatarAuthMessageSchema = Type.Union([
  Type.Object({
    type: Type.Literal('hello'),
    payload: Type.Object({
      clientType: Type.Literal('integration'),
      clientId: IdentifierSchema,
      displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
      version: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
      reconnectCredential: Type.Optional(Type.String({ minLength: 1, maxLength: 256 }))
    }, { additionalProperties: false })
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('welcome'),
    payload: Type.Object({
      capabilities: Type.Array(Type.String({ minLength: 1, maxLength: 128 }), { uniqueItems: true }),
      authorizedScopes: Type.Array(LocalIntegrationScopeSchema, { uniqueItems: true })
    }, { additionalProperties: true })
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('request_access'),
    payload: Type.Object({
      clientId: IdentifierSchema,
      displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
      requestedScopes: Type.Array(LocalIntegrationScopeSchema, { minItems: 1, uniqueItems: true })
    }, { additionalProperties: true })
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('access_pending'),
    payload: Type.Object({ requestId: RequestIdSchema }, { additionalProperties: false })
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('access_granted'),
    payload: Type.Object({
      requestId: RequestIdSchema,
      scopes: Type.Array(LocalIntegrationScopeSchema, { minItems: 1, uniqueItems: true }),
      reconnectCredential: Type.Optional(Type.String({ minLength: 1, maxLength: 256 }))
    }, { additionalProperties: true })
  }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal('access_denied'),
    payload: Type.Object({
      requestId: RequestIdSchema,
      reason: enumSchema(['user_denied', 'timeout', 'not_ready'] as const)
    }, { additionalProperties: true })
  }, { additionalProperties: false })
], {
  $id: 'https://schemas.getailicia.com/integrations/avatar-auth/v1/message.schema.json',
  title: 'ai_licia local integration avatar authorization v1 message',
  description: 'Authorization messages required to obtain and restore avatar.events.read.'
});

export const AvatarSubscribeMessageSchema = Type.Object({
  type: Type.Literal('avatar.subscribe'),
  payload: Type.Object({
    requestId: RequestIdSchema,
    protocolVersion: Type.Literal(1),
    profiles: Type.Array(ProfileRequestSchema, { minItems: 1, maxItems: 32 }),
    speechDriverPreference: Type.Optional(Type.Array(AvatarMouthProfileIdSchema, { minItems: 1, maxItems: 3, uniqueItems: true })),
    audioTransportPreference: Type.Optional(Type.Array(AvatarAudioTransportSchema, { minItems: 1, maxItems: 2, uniqueItems: true })),
    audioFormatPreference: Type.Optional(Type.Array(AvatarAudioFormatSchema, { minItems: 1, maxItems: 16, uniqueItems: true }))
  }, { additionalProperties: false })
}, { additionalProperties: false });

export const AvatarSubscribedMessageSchema = Type.Object({
  type: Type.Literal('avatar.subscribed'),
  payload: Type.Object({
    requestId: RequestIdSchema,
    protocolVersion: Type.Literal(1),
    avatarSessionId: IdentifierSchema,
    subscriptionId: IdentifierSchema,
    acceptedProfiles: Type.Array(AvatarProfileIdSchema, { uniqueItems: true }),
    rejectedProfiles: Type.Array(RejectedProfileSchema),
    audioTransport: Type.Optional(AvatarAudioTransportSchema),
    audioFormat: Type.Optional(AvatarAudioFormatSchema)
  }, { additionalProperties: false })
}, { additionalProperties: false });

export const AvatarSubscriptionErrorMessageSchema = Type.Object({
  type: Type.Literal('avatar.subscription_error'),
  payload: Type.Object({
    requestId: RequestIdSchema,
    code: enumSchema([
      'not_authorized',
      'invalid_request',
      'unsupported_protocol_version',
      'required_profile_unsupported',
      'internal_error'
    ] as const),
    message: Type.String({ minLength: 1, maxLength: 512 }),
    profileId: Type.Optional(AvatarProfileIdSchema)
  }, { additionalProperties: false })
}, { additionalProperties: false });

export const AvatarGetStateMessageSchema = Type.Object({
  type: Type.Literal('avatar.get_state'),
  payload: Type.Object({
    requestId: RequestIdSchema,
    subscriptionId: IdentifierSchema,
    lastDeliverySequence: Type.Optional(PositiveSequenceSchema)
  }, { additionalProperties: false })
}, { additionalProperties: false });

const SpeechPreparedDataSchema = Type.Composite([
  EventMetadataSchema,
  Type.Object({
    utteranceId: IdentifierSchema,
    sourceMessageId: Type.Optional(IdentifierSchema),
    audioItemId: Type.Optional(IdentifierSchema),
    durationMs: Type.Optional(SafeIntegerSchema),
    toneId: Type.Optional(AvatarToneIdSchema),
    characterId: Type.Optional(IdentifierSchema),
    activeSpeechDriver: AvatarMouthProfileIdSchema,
    availableProfiles: Type.Array(AvatarProfileIdSchema, { uniqueItems: true })
  })
], { additionalProperties: false });

const SpeechPositionDataSchema = Type.Composite([
  EventMetadataSchema,
  Type.Object({
    utteranceId: IdentifierSchema,
    playbackOffsetMs: SafeIntegerSchema
  })
], { additionalProperties: false });

const SpeechPausedDataSchema = Type.Composite([
  SpeechPositionDataSchema,
  Type.Object({
    reason: enumSchema(['speaker_interruption', 'user_pause', 'system_pause'] as const)
  })
], { additionalProperties: false });

const SpeechEndedDataSchema = Type.Composite([
  SpeechPositionDataSchema,
  Type.Object({
    reason: enumSchema([
      'completed', 'discarded', 'interrupted', 'playback_error', 'account_changed', 'shutdown'
    ] as const)
  })
], { additionalProperties: false });

const MouthAmplitudeDataSchema = Type.Composite([
  EventMetadataSchema,
  Type.Object({
    utteranceId: IdentifierSchema,
    offsetMs: SafeIntegerSchema,
    value: NormalizedWeightSchema
  })
], { additionalProperties: false });

const TimelineBaseSchema = Type.Composite([
  EventMetadataSchema,
  Type.Object({
    utteranceId: IdentifierSchema,
    revision: Type.Integer({ minimum: 1, maximum: 2147483647 }),
    chunkIndex: Type.Integer({ minimum: 0, maximum: 2147483647 }),
    finalChunk: Type.Boolean()
  })
], { additionalProperties: false });

const VisemeCueSchema = Type.Object({
  offsetMs: SafeIntegerSchema,
  durationMs: Type.Optional(SafeIntegerSchema),
  viseme: enumSchema(AVATAR_VISEME_IDS),
  weight: Type.Optional(NormalizedWeightSchema)
}, { additionalProperties: false });

const MouthVisemesDataSchema = Type.Composite([
  TimelineBaseSchema,
  Type.Object({
    cues: Type.Array(VisemeCueSchema, { minItems: 1, maxItems: 4096 })
  })
], { additionalProperties: false });

export const AVATAR_ARKIT_SPEECH_COEFFICIENTS = [
  'cheekPuff', 'jawForward', 'jawLeft', 'jawOpen', 'jawRight', 'mouthClose',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthFunnel', 'mouthLeft', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthPressLeft', 'mouthPressRight', 'mouthPucker', 'mouthRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight', 'tongueOut'
] as const;

const ArkitSpeechWeightsSchema = Type.Object(
  Object.fromEntries(AVATAR_ARKIT_SPEECH_COEFFICIENTS.map((name) => [name, Type.Optional(NormalizedWeightSchema)])),
  { additionalProperties: false, minProperties: 1 }
);

const ArkitSpeechFrameSchema = Type.Object({
  offsetMs: SafeIntegerSchema,
  weights: ArkitSpeechWeightsSchema
}, { additionalProperties: false });

const ArkitSpeechFramesDataSchema = Type.Composite([
  TimelineBaseSchema,
  Type.Object({
    frames: Type.Array(ArkitSpeechFrameSchema, { minItems: 1, maxItems: 3600 })
  })
], { additionalProperties: false });

const ToneExpressionSourceSchema = Type.Object({
  kind: Type.Literal('tone'),
  toneId: AvatarToneIdSchema,
  utteranceId: IdentifierSchema,
  sourceMessageId: IdentifierSchema,
  audioItemId: IdentifierSchema,
  mappingVersion: Type.String({ minLength: 1, maxLength: 128 })
}, { additionalProperties: false });

const SpeechDeliveryExpressionSourceSchema = Type.Object({
  kind: Type.Literal('speech_delivery'),
  deliveryId: enumSchema(AVATAR_SPEECH_DELIVERY_IDS),
  utteranceId: IdentifierSchema,
  sourceMessageId: IdentifierSchema,
  audioItemId: IdentifierSchema,
  segmentIndex: Type.Integer({ minimum: 0, maximum: 15 }),
  mappingVersion: Type.String({ minLength: 1, maxLength: 128 })
}, { additionalProperties: false });

const NonToneExpressionSourceSchema = Type.Object({
  kind: enumSchema(['system', 'action', 'user'] as const)
}, { additionalProperties: false });

const ExpressionSourceSchema = Type.Union([
  ToneExpressionSourceSchema,
  SpeechDeliveryExpressionSourceSchema,
  NonToneExpressionSourceSchema
]);

const ExpressionValueSchema = Type.Object({
  expression: enumSchema(AVATAR_EXPRESSION_IDS),
  weight: NormalizedWeightSchema
}, { additionalProperties: false });

const ExpressionStateSchema = Type.Object({
  revision: Type.Integer({ minimum: 1, maximum: 2147483647 }),
  source: Type.Optional(ExpressionSourceSchema),
  transitionMs: Type.Integer({ minimum: 0, maximum: 5000 }),
  values: Type.Array(ExpressionValueSchema, { maxItems: 6 })
}, { additionalProperties: false });

const ExpressionStateDataSchema = Type.Composite([
  EventMetadataSchema,
  ExpressionStateSchema
], { additionalProperties: false });

const ActionIdSchema = Type.Union([
  enumSchema(AVATAR_STANDARD_ACTION_IDS),
  Type.String({ pattern: ExtensionIdentifierPattern, maxLength: 128 })
]);

const SpeechReactionActionSourceSchema = Type.Object({
  kind: Type.Literal('speech_reaction'),
  reactionId: enumSchema(AVATAR_SPEECH_REACTION_IDS),
  utteranceId: IdentifierSchema,
  sourceMessageId: IdentifierSchema,
  audioItemId: IdentifierSchema,
  segmentIndex: Type.Integer({ minimum: 0, maximum: 15 }),
  mappingVersion: Type.String({ minLength: 1, maxLength: 128 })
}, { additionalProperties: false });

const SpeechGestureActionSourceSchema = Type.Object({
  kind: Type.Literal('speech_gesture'),
  gestureId: enumSchema(AVATAR_SPEECH_GESTURE_IDS),
  utteranceId: IdentifierSchema,
  sourceMessageId: IdentifierSchema,
  audioItemId: IdentifierSchema,
  segmentIndex: Type.Integer({ minimum: 0, maximum: 15 }),
  mappingVersion: Type.String({ minLength: 1, maxLength: 128 })
}, { additionalProperties: false });

const ActionTriggeredDataSchema = Type.Composite([
  EventMetadataSchema,
  Type.Object({
    actionInstanceId: IdentifierSchema,
    actionId: ActionIdSchema,
    intensity: Type.Optional(NormalizedWeightSchema),
    durationMs: Type.Optional(SafeIntegerSchema),
    source: Type.Optional(Type.Union([
      SpeechReactionActionSourceSchema,
      SpeechGestureActionSourceSchema
    ]))
  })
], { additionalProperties: false });

const PcmAudioPreparedDataSchema = Type.Composite([
  EventMetadataSchema,
  Type.Object({
    utteranceId: IdentifierSchema,
    audioItemId: IdentifierSchema,
    encoding: Type.Literal('PCM_S16_LE'),
    sampleRateHz: numericEnumSchema(AVATAR_PCM_SAMPLE_RATES),
    channels: Type.Literal(1),
    durationMs: Type.Optional(SafeIntegerSchema)
  })
], { additionalProperties: false });

const OpusAudioPreparedDataSchema = Type.Composite([
  EventMetadataSchema,
  Type.Object({
    utteranceId: IdentifierSchema,
    audioItemId: IdentifierSchema,
    encoding: Type.Literal('OPUS'),
    sampleRateHz: numericEnumSchema(AVATAR_OPUS_SAMPLE_RATES),
    channels: Type.Literal(1),
    frameDurationMs: numericEnumSchema(AVATAR_OPUS_FRAME_DURATIONS_MS),
    bitrateBps: Type.Integer({ minimum: 6000, maximum: 128000 }),
    durationMs: Type.Optional(SafeIntegerSchema)
  })
], { additionalProperties: false });

const AudioChunkDataSchema = Type.Composite([
  EventMetadataSchema,
  Type.Object({
    utteranceId: IdentifierSchema,
    audioItemId: IdentifierSchema,
    chunkIndex: Type.Integer({ minimum: 0, maximum: 2147483647 }),
    sampleOffset: SafeIntegerSchema,
    dataBase64: Base64Schema
  })
], { additionalProperties: false });

const AudioCompletedDataSchema = Type.Composite([
  EventMetadataSchema,
  Type.Object({
    utteranceId: IdentifierSchema,
    audioItemId: IdentifierSchema,
    chunkCount: Type.Integer({ minimum: 0, maximum: 2147483647 }),
    totalSamples: SafeIntegerSchema
  })
], { additionalProperties: false });

const ActiveUtteranceSchema = Type.Object({
  utteranceId: IdentifierSchema,
  state: enumSchema(['playing', 'paused'] as const),
  playbackOffsetMs: SafeIntegerSchema,
  toneId: Type.Optional(AvatarToneIdSchema),
  sourceMessageId: Type.Optional(IdentifierSchema),
  audioItemId: Type.Optional(IdentifierSchema),
  activeSpeechDriver: AvatarMouthProfileIdSchema,
  availableProfiles: Type.Array(AvatarProfileIdSchema, { uniqueItems: true })
}, { additionalProperties: false });

const StateSnapshotDataSchema = Type.Composite([
  EventMetadataSchema,
  Type.Object({
    requestId: Type.Optional(RequestIdSchema),
    selectedProfiles: Type.Array(AvatarProfileIdSchema, { uniqueItems: true }),
    activeUtterance: Type.Union([Type.Null(), ActiveUtteranceSchema]),
    expression: Type.Optional(ExpressionStateSchema)
  })
], { additionalProperties: false });

const eventEnvelope = <TName extends string, TData extends TSchema>(name: TName, data: TData) =>
  Type.Object({
    type: Type.Literal('event'),
    payload: Type.Object({
      name: Type.Literal(name),
      data
    }, { additionalProperties: false })
  }, { additionalProperties: false });

export const AvatarSpeechPreparedEventSchema = eventEnvelope('avatar.speech.prepared', SpeechPreparedDataSchema);
export const AvatarSpeechStartedEventSchema = eventEnvelope('avatar.speech.started', SpeechPositionDataSchema);
export const AvatarSpeechPausedEventSchema = eventEnvelope('avatar.speech.paused', SpeechPausedDataSchema);
export const AvatarSpeechResumedEventSchema = eventEnvelope('avatar.speech.resumed', SpeechPositionDataSchema);
export const AvatarSpeechEndedEventSchema = eventEnvelope('avatar.speech.ended', SpeechEndedDataSchema);
export const AvatarMouthAmplitudeEventSchema = eventEnvelope('avatar.mouth.amplitude', MouthAmplitudeDataSchema);
export const AvatarMouthVisemesEventSchema = eventEnvelope('avatar.mouth.visemes', MouthVisemesDataSchema);
export const AvatarArkitSpeechFramesEventSchema = eventEnvelope('avatar.mouth.arkit_frames', ArkitSpeechFramesDataSchema);
export const AvatarExpressionStateEventSchema = eventEnvelope('avatar.expression.state', ExpressionStateDataSchema);
export const AvatarActionTriggeredEventSchema = eventEnvelope('avatar.action.triggered', ActionTriggeredDataSchema);
export const AvatarPcmAudioPreparedEventSchema = eventEnvelope('avatar.audio.prepared', PcmAudioPreparedDataSchema);
export const AvatarOpusAudioPreparedEventSchema = eventEnvelope('avatar.audio.prepared', OpusAudioPreparedDataSchema);
export const AvatarAudioPreparedEventSchema = Type.Union([
  AvatarPcmAudioPreparedEventSchema,
  AvatarOpusAudioPreparedEventSchema
]);
export const AvatarAudioChunkEventSchema = eventEnvelope('avatar.audio.chunk', AudioChunkDataSchema);
export const AvatarAudioCompletedEventSchema = eventEnvelope('avatar.audio.completed', AudioCompletedDataSchema);
export const AvatarPcmAudioChunkEventSchema = AvatarAudioChunkEventSchema;
export const AvatarPcmAudioCompletedEventSchema = AvatarAudioCompletedEventSchema;
export const AvatarStateSnapshotEventSchema = eventEnvelope('avatar.state.snapshot', StateSnapshotDataSchema);

export const AvatarProtocolMessageSchema = Type.Union([
  AvatarSubscribeMessageSchema,
  AvatarSubscribedMessageSchema,
  AvatarSubscriptionErrorMessageSchema,
  AvatarGetStateMessageSchema,
  AvatarSpeechPreparedEventSchema,
  AvatarSpeechStartedEventSchema,
  AvatarSpeechPausedEventSchema,
  AvatarSpeechResumedEventSchema,
  AvatarSpeechEndedEventSchema,
  AvatarMouthAmplitudeEventSchema,
  AvatarMouthVisemesEventSchema,
  AvatarArkitSpeechFramesEventSchema,
  AvatarExpressionStateEventSchema,
  AvatarActionTriggeredEventSchema,
  AvatarAudioPreparedEventSchema,
  AvatarAudioChunkEventSchema,
  AvatarAudioCompletedEventSchema,
  AvatarStateSnapshotEventSchema
], {
  $id: 'https://schemas.getailicia.com/avatar/protocol/v1/message.schema.json',
  title: 'ai_licia Avatar Protocol v1 wire message',
  description: 'Complete client, server and event messages for avatar.protocol.v1.'
});

export type AvatarStandardProfileId = Static<typeof AvatarStandardProfileIdSchema>;
export type AvatarMouthProfileId = Static<typeof AvatarMouthProfileIdSchema>;
export type AvatarAudioProfileId = Static<typeof AvatarAudioProfileIdSchema>;
export type AvatarAudioTransport = Static<typeof AvatarAudioTransportSchema>;
export type AvatarPcmAudioFormat = Static<typeof AvatarPcmAudioFormatSchema>;
export type AvatarOpusAudioFormat = Static<typeof AvatarOpusAudioFormatSchema>;
export type AvatarAudioFormat = Static<typeof AvatarAudioFormatSchema>;
export type AvatarProfileId = Static<typeof AvatarProfileIdSchema>;
export type AvatarToneId = Static<typeof AvatarToneIdSchema>;
export type AvatarSubscribeMessage = Static<typeof AvatarSubscribeMessageSchema>;
export type AvatarSubscribedMessage = Static<typeof AvatarSubscribedMessageSchema>;
export type AvatarSubscriptionErrorMessage = Static<typeof AvatarSubscriptionErrorMessageSchema>;
export type AvatarGetStateMessage = Static<typeof AvatarGetStateMessageSchema>;
export type AvatarSpeechPreparedEvent = Static<typeof AvatarSpeechPreparedEventSchema>;
export type AvatarSpeechStartedEvent = Static<typeof AvatarSpeechStartedEventSchema>;
export type AvatarSpeechPausedEvent = Static<typeof AvatarSpeechPausedEventSchema>;
export type AvatarSpeechResumedEvent = Static<typeof AvatarSpeechResumedEventSchema>;
export type AvatarSpeechEndedEvent = Static<typeof AvatarSpeechEndedEventSchema>;
export type AvatarMouthAmplitudeEvent = Static<typeof AvatarMouthAmplitudeEventSchema>;
export type AvatarMouthVisemesEvent = Static<typeof AvatarMouthVisemesEventSchema>;
export type AvatarArkitSpeechFramesEvent = Static<typeof AvatarArkitSpeechFramesEventSchema>;
export type AvatarExpressionStateEvent = Static<typeof AvatarExpressionStateEventSchema>;
export type AvatarActionTriggeredEvent = Static<typeof AvatarActionTriggeredEventSchema>;
export type AvatarPcmAudioPreparedEvent = Static<typeof AvatarPcmAudioPreparedEventSchema>;
export type AvatarOpusAudioPreparedEvent = Static<typeof AvatarOpusAudioPreparedEventSchema>;
export type AvatarAudioPreparedEvent = Static<typeof AvatarAudioPreparedEventSchema>;
export type AvatarAudioChunkEvent = Static<typeof AvatarAudioChunkEventSchema>;
export type AvatarAudioCompletedEvent = Static<typeof AvatarAudioCompletedEventSchema>;
export type AvatarPcmAudioChunkEvent = Static<typeof AvatarPcmAudioChunkEventSchema>;
export type AvatarPcmAudioCompletedEvent = Static<typeof AvatarPcmAudioCompletedEventSchema>;
export type AvatarStateSnapshotEvent = Static<typeof AvatarStateSnapshotEventSchema>;
export type AvatarProtocolMessage = Static<typeof AvatarProtocolMessageSchema>;
export type AvatarProtocolEvent = Extract<AvatarProtocolMessage, { type: 'event' }>;
export type LocalIntegrationAvatarAuthMessage = Static<typeof LocalIntegrationAvatarAuthMessageSchema>;

export const AVATAR_BINARY_AUDIO_MAGIC = 'AVP1' as const;
export const AVATAR_BINARY_AUDIO_FRAME_VERSION = 1 as const;
export const AVATAR_BINARY_AUDIO_CHUNK_TYPE = 1 as const;
export const AVATAR_BINARY_AUDIO_HEADER_BYTES = 30 as const;

export interface AvatarBinaryAudioFrame {
  deliverySequence: number;
  chunkIndex: number;
  sampleOffset: number;
  audioItemId: string;
  data: Uint8Array;
}

const binaryBytes = (input: unknown): Uint8Array | undefined => {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return undefined;
};

const readSafeUInt64BE = (view: DataView, offset: number): number | undefined => {
  const value = view.getUint32(offset) * 0x100000000 + view.getUint32(offset + 4);
  return Number.isSafeInteger(value) ? value : undefined;
};

export const decodeAvatarBinaryAudioFrame = (input: unknown): AvatarBinaryAudioFrame | undefined => {
  const bytes = binaryBytes(input);
  if (!bytes || bytes.byteLength <= AVATAR_BINARY_AUDIO_HEADER_BYTES) return undefined;
  if (
    bytes[0] !== 0x41 || bytes[1] !== 0x56 || bytes[2] !== 0x50 || bytes[3] !== 0x31
  ) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint8(4) !== AVATAR_BINARY_AUDIO_CHUNK_TYPE ||
    view.getUint8(5) !== AVATAR_BINARY_AUDIO_FRAME_VERSION ||
    view.getUint16(6) !== 0
  ) return undefined;
  const deliverySequence = readSafeUInt64BE(view, 8);
  const chunkIndex = view.getUint32(16);
  const sampleOffset = readSafeUInt64BE(view, 20);
  const audioItemIdLength = view.getUint16(28);
  const payloadOffset = AVATAR_BINARY_AUDIO_HEADER_BYTES + audioItemIdLength;
  if (
    deliverySequence === undefined || deliverySequence < 1 ||
    sampleOffset === undefined || audioItemIdLength < 1 || audioItemIdLength > 128 ||
    payloadOffset >= bytes.byteLength
  ) return undefined;
  let audioItemId: string;
  try {
    audioItemId = new TextDecoder('utf-8', { fatal: true })
      .decode(bytes.subarray(AVATAR_BINARY_AUDIO_HEADER_BYTES, payloadOffset));
  } catch {
    return undefined;
  }
  if (!audioItemId.trim()) return undefined;
  return {
    deliverySequence,
    chunkIndex,
    sampleOffset,
    audioItemId,
    data: bytes.slice(payloadOffset)
  };
};

export interface AvatarProtocolValidationIssue {
  path: string;
  message: string;
}

export type AvatarProtocolValidationResult =
  | { success: true; value: AvatarProtocolMessage }
  | { success: false; issues: AvatarProtocolValidationIssue[] };

const semanticIssue = (path: string, message: string): AvatarProtocolValidationIssue => ({ path, message });

const semanticIssuesFor = (message: AvatarProtocolMessage): AvatarProtocolValidationIssue[] => {
  const issues: AvatarProtocolValidationIssue[] = [];
  if (message.type === 'avatar.subscribe') {
    const ids = message.payload.profiles.map((profile) => profile.id);
    if (new Set(ids).size !== ids.length) {
      issues.push(semanticIssue('/payload/profiles', 'Profile identifiers must be unique.'));
    }
    if (message.payload.speechDriverPreference) {
      const requestedMouthProfiles = ids.filter((id): id is AvatarMouthProfileId =>
        (AVATAR_MOUTH_PROFILES as readonly string[]).includes(id)
      );
      const preference = message.payload.speechDriverPreference;
      if (
        preference.length !== requestedMouthProfiles.length ||
        requestedMouthProfiles.some((id) => !preference.includes(id))
      ) {
        issues.push(semanticIssue(
          '/payload/speechDriverPreference',
          'Speech driver preference must list each requested mouth profile exactly once.'
        ));
      }
    }
    const requestedAudioProfiles = ids.filter((id): id is AvatarAudioProfileId =>
      (AVATAR_AUDIO_PROFILES as readonly string[]).includes(id)
    );
    if (message.payload.audioTransportPreference && requestedAudioProfiles.length === 0) {
      issues.push(semanticIssue(
        '/payload/audioTransportPreference',
        'Audio transport preference requires a requested audio profile.'
      ));
    }
    if (message.payload.audioFormatPreference) {
      const keys = message.payload.audioFormatPreference.map((format) =>
        format.profile === 'avatar.audio.opus.v1'
          ? `${format.profile}:${format.sampleRateHz}:${format.channels}:${format.frameDurationMs}:${format.bitrateBps}`
          : `${format.profile}:${format.sampleRateHz}:${format.channels}`
      );
      if (new Set(keys).size !== keys.length) {
        issues.push(semanticIssue(
          '/payload/audioFormatPreference',
          'Audio format preference entries must be unique.'
        ));
      }
      if (message.payload.audioFormatPreference.some((format) => !ids.includes(format.profile))) {
        issues.push(semanticIssue(
          '/payload/audioFormatPreference',
          'Every audio format preference must use a requested audio profile.'
        ));
      }
    }
  }

  if (message.type === 'avatar.subscribed') {
    const acceptedAudioProfiles = message.payload.acceptedProfiles.filter((id): id is AvatarAudioProfileId =>
      (AVATAR_AUDIO_PROFILES as readonly string[]).includes(id)
    );
    if (message.payload.audioTransport && acceptedAudioProfiles.length === 0) {
      issues.push(semanticIssue(
        '/payload/audioTransport',
        'Negotiated audio transport requires an accepted audio profile.'
      ));
    }
    if (
      message.payload.audioFormat &&
      !message.payload.acceptedProfiles.includes(message.payload.audioFormat.profile)
    ) {
      issues.push(semanticIssue(
        '/payload/audioFormat',
        'Negotiated audio format must use an accepted audio profile.'
      ));
    }
  }

  if (message.type !== 'event') {
    return issues;
  }

  const { name, data } = message.payload;
  if (name === 'avatar.speech.prepared') {
    if (!data.availableProfiles.includes(data.activeSpeechDriver)) {
      issues.push(semanticIssue('/payload/data/activeSpeechDriver', 'Active speech driver must be available.'));
    }
    if (data.toneId && (!data.sourceMessageId || !data.audioItemId)) {
      issues.push(semanticIssue('/payload/data/toneId', 'Tone requires exact source message and audio item identifiers.'));
    }
  }
  if (name === 'avatar.state.snapshot' && data.activeUtterance) {
    if (!data.activeUtterance.availableProfiles.includes(data.activeUtterance.activeSpeechDriver)) {
      issues.push(semanticIssue(
        '/payload/data/activeUtterance/activeSpeechDriver',
        'Active speech driver must be available.'
      ));
    }
  }
  if (name === 'avatar.expression.state') {
    const expressionIds = data.values.map((value) => value.expression);
    if (new Set(expressionIds).size !== expressionIds.length) {
      issues.push(semanticIssue('/payload/data/values', 'Expression identifiers must be unique.'));
    }
  }
  if (name === 'avatar.mouth.visemes') {
    data.cues.forEach((cue, index) => {
      const next = data.cues[index + 1];
      if (next && next.offsetMs <= cue.offsetMs) {
        issues.push(semanticIssue('/payload/data/cues', 'Viseme cues must be strictly ordered.'));
      }
      if (next && cue.durationMs !== undefined && cue.offsetMs + cue.durationMs > next.offsetMs) {
        issues.push(semanticIssue('/payload/data/cues', 'Viseme cues must not overlap.'));
      }
    });
    if (message.payload.data.finalChunk && data.cues[data.cues.length - 1]?.durationMs === undefined) {
      issues.push(semanticIssue('/payload/data/cues', 'The final viseme cue must have a duration.'));
    }
  }
  if (name === 'avatar.mouth.arkit_frames') {
    data.frames.forEach((frame, index) => {
      const next = data.frames[index + 1];
      if (next && next.offsetMs <= frame.offsetMs) {
        issues.push(semanticIssue('/payload/data/frames', 'ARKit frames must be strictly ordered.'));
      }
    });
  }
  return issues;
};

export const validateAvatarProtocolMessage = (input: unknown): AvatarProtocolValidationResult => {
  if (!Value.Check(AvatarProtocolMessageSchema, input)) {
    return {
      success: false,
      issues: [...Value.Errors(AvatarProtocolMessageSchema, input)].map((error) => ({
        path: error.path,
        message: error.message
      }))
    };
  }
  const value = input as AvatarProtocolMessage;
  const issues = semanticIssuesFor(value);
  return issues.length === 0 ? { success: true, value } : { success: false, issues };
};

export const validateAvatarProtocolSequence = (
  inputs: readonly unknown[]
): AvatarProtocolValidationIssue[] => {
  const issues: AvatarProtocolValidationIssue[] = [];
  const lastSequenceBySubscription = new Map<string, number>();
  const preparedAudioStreams = new Map<string, {
    encoding: 'PCM_S16_LE' | 'OPUS';
    sampleRateHz: number;
    frameDurationMs?: number;
  }>();
  const lastAudioChunkByStream = new Map<string, { index: number; sampleOffset: number; sampleCount: number }>();
  inputs.forEach((input, index) => {
    const result = validateAvatarProtocolMessage(input);
    if (!result.success) {
      result.issues.forEach((issue) => issues.push({
        path: `/${index}${issue.path}`,
        message: issue.message
      }));
      return;
    }
    if (result.value.type !== 'event') return;
    const metadata = result.value.payload.data;
    const last = lastSequenceBySubscription.get(metadata.subscriptionId);
    if (last !== undefined && metadata.deliverySequence !== last + 1) {
      issues.push(semanticIssue(
        `/${index}/payload/data/deliverySequence`,
        `Expected delivery sequence ${last + 1} for subscription ${metadata.subscriptionId}.`
      ));
    }
    lastSequenceBySubscription.set(metadata.subscriptionId, metadata.deliverySequence);

    const audioStreamKey = 'utteranceId' in metadata && 'audioItemId' in metadata
      ? `${metadata.subscriptionId}\u0000${metadata.utteranceId}\u0000${metadata.audioItemId}`
      : undefined;
    if (result.value.payload.name === 'avatar.audio.prepared' && audioStreamKey) {
      preparedAudioStreams.set(audioStreamKey, {
        encoding: result.value.payload.data.encoding,
        sampleRateHz: result.value.payload.data.sampleRateHz,
        ...(result.value.payload.data.encoding === 'OPUS'
          ? { frameDurationMs: result.value.payload.data.frameDurationMs }
          : {})
      });
      lastAudioChunkByStream.delete(audioStreamKey);
    }
    if (result.value.payload.name === 'avatar.audio.chunk' && audioStreamKey) {
      const chunk = result.value.payload.data;
      const previous = lastAudioChunkByStream.get(audioStreamKey);
      const prepared = preparedAudioStreams.get(audioStreamKey);
      if (!prepared) {
        issues.push(semanticIssue(
          `/${index}/payload/data/audioItemId`,
          'An audio stream must be prepared before chunks are delivered.'
        ));
      }
      const expectedIndex = previous ? previous.index + 1 : 0;
      if (chunk.chunkIndex !== expectedIndex) {
        issues.push(semanticIssue(
          `/${index}/payload/data/chunkIndex`,
          `Expected PCM chunk index ${expectedIndex}.`
        ));
      }
      const paddingBytes = chunk.dataBase64.endsWith('==') ? 2 : chunk.dataBase64.endsWith('=') ? 1 : 0;
      const decodedBytes = (chunk.dataBase64.length * 3) / 4 - paddingBytes;
      const sampleCount = prepared?.encoding === 'OPUS'
        ? prepared.sampleRateHz * (prepared.frameDurationMs ?? 0) / 1000
        : decodedBytes / 2;
      if (prepared?.encoding === 'PCM_S16_LE' && !Number.isInteger(sampleCount)) {
        issues.push(semanticIssue(
          `/${index}/payload/data/dataBase64`,
          'PCM_S16_LE chunks must contain a whole number of 16-bit samples.'
        ));
      }
      const expectedSampleOffset = previous
        ? previous.sampleOffset + previous.sampleCount
        : 0;
      if (chunk.sampleOffset !== expectedSampleOffset) {
        issues.push(semanticIssue(
          `/${index}/payload/data/sampleOffset`,
          `Expected PCM sample offset ${expectedSampleOffset}.`
        ));
      }
      lastAudioChunkByStream.set(audioStreamKey, {
        index: chunk.chunkIndex,
        sampleOffset: chunk.sampleOffset,
        sampleCount
      });
    }
    if (result.value.payload.name === 'avatar.audio.completed' && audioStreamKey) {
      const completed = result.value.payload.data;
      const previous = lastAudioChunkByStream.get(audioStreamKey);
      if (!preparedAudioStreams.has(audioStreamKey)) {
        issues.push(semanticIssue(
          `/${index}/payload/data/audioItemId`,
          'An audio stream must be prepared before it is completed.'
        ));
      }
      const expectedChunkCount = previous ? previous.index + 1 : 0;
      if (completed.chunkCount !== expectedChunkCount) {
        issues.push(semanticIssue(
          `/${index}/payload/data/chunkCount`,
          `Expected completed chunk count ${expectedChunkCount}.`
        ));
      }
      const expectedTotalSamples = previous
        ? previous.sampleOffset + previous.sampleCount
        : 0;
      if (completed.totalSamples !== expectedTotalSamples) {
        issues.push(semanticIssue(
          `/${index}/payload/data/totalSamples`,
          `Expected completed sample count ${expectedTotalSamples}.`
        ));
      }
      preparedAudioStreams.delete(audioStreamKey);
      lastAudioChunkByStream.delete(audioStreamKey);
    }
  });
  return issues;
};
