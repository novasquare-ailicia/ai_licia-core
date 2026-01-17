/**
 * Types and interfaces for the ai_licia API
 */

export enum EventType {
  GAME_EVENT = 'GAME_EVENT'
}

export interface EventContent {
  channelName: string;
  content: string;
  ttl?: number;
}

export interface EventContentGeneration {
  channelName: string;
  content: string;
}

export interface Event {
  eventType: EventType;
  data: EventContent;
}

export interface EventGeneration {
  eventType: EventType;
  data: EventContentGeneration;
}

export interface GenerationResponse {
  id: string;
  content: string;
  createdAt: string;
  status: 'completed' | 'processing' | 'failed';
  audioPath?: string;
}

export interface AiliciaConfig {
  apiKey: string;
  channelName: string;
  baseUrl?: string;
}

export interface GenerationOptions {
  promptOverride?: string;
  useMemory?: boolean;
  additionalContext?: string;
  voiceOnly?: boolean;
}

export type Platform = 'TWITCH' | 'TIKTOK' | 'KICK' | 'YOUTUBE';

export type PublicChatRole = 'Mod' | 'VIP' | 'AI' | 'Viewer' | 'Streamer';

export interface PublicChatMessage {
  id?: string;
  username: string;
  content: string;
  role: PublicChatRole;
  isSub: boolean;
  sentDateTime: string;
}

export interface ReconnectOptions {
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
  reconnectBackoffMultiplier?: number;
  reconnectJitterMs?: number;
  maxReconnectAttempts?: number;
  onReconnectAttempt?: (attemptInfo: { attempt: number; delayMs: number }) => void;
  onConnectionStateChange?: (state: 'connecting' | 'reconnecting') => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface ChatMessageStreamOptions extends ReconnectOptions {
  roles?: PublicChatRole[];
  onMessage: (message: PublicChatMessage) => void;
}

export interface ChatMessageStream {
  close: () => void;
}

export interface CharacterSummary {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface JoinChannelResponse {
  success: boolean;
  message: string;
  alreadyJoined?: boolean;
  requiresSubscription?: boolean;
  timeout?: boolean;
  joinedAt?: number;
  channelId?: string;
  joinRequestId?: string;
}

export type EventSubJwtAuth = {
  type: 'jwt';
  token: string;
};

export type EventSubApiKeyAuth = {
  type: 'apiKey';
  key: string;
};

export type EventSubAuth = EventSubJwtAuth | EventSubApiKeyAuth;

export type EventSubEventType =
  | 'chat.message'
  | 'chat.ai_message'
  | 'chat.first_message'
  | 'ai.thoughts'
  | 'ai.tts.generated'
  | 'channel.event'
  | 'channel.go_live'
  | 'channel.go_offline'
  | 'ai.moderation'
  | 'api.event'
  | 'system.join'
  | 'system.left'
  | 'character.updated';

export interface EventSubChannelRef {
  id: string;
  name: string;
  platform: Platform;
}

export interface EventSubStreamRef {
  id: string;
}

export interface EventSubEnvelope<TPayload = unknown> {
  id: string;
  type: EventSubEventType;
  timestamp: string;
  channel: EventSubChannelRef;
  stream?: EventSubStreamRef;
  version?: string;
  payload: TPayload;
  meta?: Record<string, unknown>;
}

export interface EventSubChatMessagePayload {
  id: string;
  username: string;
  message: string;
  language: string;
  platform: Platform;
  isSubscriber: boolean;
  isVip: boolean;
  isModerator: boolean;
  sentDateTime: string;
}

export interface EventSubChatAiMessagePayload {
  id: string;
  username: string;
  message: string;
  target: string;
  targetRole: string;
  shouldGenerateTtsMessage: boolean;
  characterId?: string | null;
  tone?: string | null;
  sentDateTime: string;
}

export interface EventSubChatFirstMessagePayload {
  username: string;
  sentDateTime: string;
  memory?: {
    id: string;
    name: string;
    facts: string;
    updated: string;
  } | null;
  greeting?: string | null;
}

export interface EventSubAiThoughtsPayload {
  reasoning: string;
  shouldAnswer: boolean;
  compiledFromMultiple: boolean;
  sentDateTime: string;
}

export interface EventSubAiTtsGeneratedPayload {
  messageId: string;
  username: string;
  textToSpeech: string;
  audioFormat: string;
  generationTimeMs: number;
  audioSizeBytes: number;
  ttsStreamUrl: string;
  sentDateTime: string;
}

export interface EventSubChannelEventPayload {
  eventType: string;
  username?: string | null;
  gifter?: string | null;
  count?: number | null;
  value?: number | null;
  raidViewers?: number | null;
  message?: string | null;
  sentDateTime: string;
}

export interface EventSubChannelGoLivePayload {
  sentDateTime: string;
}

export interface EventSubChannelGoOfflinePayload {
  sentDateTime: string;
}

export interface EventSubAiModerationPayload {
  messageId: string;
  username: string;
  originalMessage: string;
  isAppropriate: boolean;
  categoriesScore: Record<
    string,
    {
      flagged: boolean;
      score: number;
    }
  >;
  moderationEnabled: boolean;
  sentDateTime: string;
}

export interface EventSubApiEventPayload {
  eventType: string;
  content: string;
  shouldGenerate: boolean;
  ttl?: number | null;
  expiresAt?: string | null;
}

export interface EventSubSystemJoinPayload {
  channelId: string;
  channelName: string;
  sentDateTime: string;
}

export interface EventSubSystemLeftPayload {
  channelId: string;
  channelName: string;
  sentDateTime: string;
}

export interface EventSubCharacterUpdatedPayload {
  characterId: string;
  displayName: string;
  sentDateTime: string;
}

export type EventSubEventMap = {
  'chat.message': EventSubEnvelope<EventSubChatMessagePayload>;
  'chat.ai_message': EventSubEnvelope<EventSubChatAiMessagePayload>;
  'chat.first_message': EventSubEnvelope<EventSubChatFirstMessagePayload>;
  'ai.thoughts': EventSubEnvelope<EventSubAiThoughtsPayload>;
  'ai.tts.generated': EventSubEnvelope<EventSubAiTtsGeneratedPayload>;
  'channel.event': EventSubEnvelope<EventSubChannelEventPayload>;
  'channel.go_live': EventSubEnvelope<EventSubChannelGoLivePayload>;
  'channel.go_offline': EventSubEnvelope<EventSubChannelGoOfflinePayload>;
  'ai.moderation': EventSubEnvelope<EventSubAiModerationPayload>;
  'api.event': EventSubEnvelope<EventSubApiEventPayload>;
  'system.join': EventSubEnvelope<EventSubSystemJoinPayload>;
  'system.left': EventSubEnvelope<EventSubSystemLeftPayload>;
  'character.updated': EventSubEnvelope<EventSubCharacterUpdatedPayload>;
};

export type EventSubEvent = EventSubEventMap[EventSubEventType];

export type EventSubHandler<T extends EventSubEventType> = (event: EventSubEventMap[T]) => void;
export type EventSubAnyHandler = (event: EventSubEvent) => void;

export interface EventSubStreamOptions extends ReconnectOptions {
  types?: EventSubEventType[];
  channelId?: string;
  cursor?: string;
  handlers?: Partial<{ [K in EventSubEventType]: EventSubHandler<K> }>;
}

export interface EventSubStream {
  close(): void;
  on<T extends EventSubEventType>(type: T, handler: EventSubHandler<T>): EventSubStream;
  off<T extends EventSubEventType>(type: T, handler: EventSubHandler<T>): EventSubStream;
  onAny(handler: EventSubAnyHandler): EventSubStream;
  offAny(handler: EventSubAnyHandler): EventSubStream;
}

export const LOCAL_WEBSOCKET_CAPABILITIES = ['events', 'state', 'integration.auth'] as const;
export type LocalWebSocketCapability = typeof LOCAL_WEBSOCKET_CAPABILITIES[number];

export const LOCAL_WEBSOCKET_SCOPES = ['rest.full'] as const;
export type LocalWebSocketScope = typeof LOCAL_WEBSOCKET_SCOPES[number];

export const LOCAL_WEBSOCKET_EVENT_NAMES = ['ttsAmplitude'] as const;
export type LocalWebSocketEventName = typeof LOCAL_WEBSOCKET_EVENT_NAMES[number];

export const LOCAL_WEBSOCKET_ERROR_CODES = [
  'missing_hello',
  'invalid_client_type',
  'invalid_client_id',
  'invalid_scope',
  'not_ready',
  'request_pending',
  'rate_limited',
  'ui_unavailable'
] as const;
export type LocalWebSocketErrorCode = typeof LOCAL_WEBSOCKET_ERROR_CODES[number];

export interface LocalWebSocketHelloPayload {
  clientType: 'integration';
  clientId: string;
  displayName?: string;
  version?: string;
}

export interface LocalWebSocketWelcomePayload {
  capabilities: LocalWebSocketCapability[];
}

export interface LocalWebSocketRequestAccessPayload {
  clientId: string;
  displayName?: string;
  requestedScopes: LocalWebSocketScope[];
}

export interface LocalWebSocketAccessPendingPayload {
  requestId: string;
}

export type LocalWebSocketAccessDeniedReason = 'user_denied' | 'timeout' | 'not_ready';

export interface LocalWebSocketAccessDeniedPayload {
  requestId: string;
  reason: LocalWebSocketAccessDeniedReason;
}

export interface LocalWebSocketAccessGrantedPayload {
  requestId: string;
  apiKey: string;
  scopes: LocalWebSocketScope[];
  channelName?: string;
}

export interface LocalWebSocketErrorPayload {
  code: LocalWebSocketErrorCode;
  message: string;
}

export interface LocalWebSocketEventMap {
  ttsAmplitude: {
    soundAmplitudeValue: number;
    animationId?: string | number | null;
  };
}

export interface LocalWebSocketEventEnvelope<TName extends LocalWebSocketEventName> {
  name: TName;
  data: LocalWebSocketEventMap[TName];
}

export type LocalWebSocketMessageMap = {
  welcome: LocalWebSocketWelcomePayload;
  access_pending: LocalWebSocketAccessPendingPayload;
  access_granted: LocalWebSocketAccessGrantedPayload;
  access_denied: LocalWebSocketAccessDeniedPayload;
  error: LocalWebSocketErrorPayload;
  event: LocalWebSocketEventEnvelope<LocalWebSocketEventName>;
};

export type LocalWebSocketMessageType = keyof LocalWebSocketMessageMap;

export type LocalWebSocketMessage = {
  [K in LocalWebSocketMessageType]: { type: K; payload: LocalWebSocketMessageMap[K] }
}[LocalWebSocketMessageType];

export interface WebSocketMessageEvent {
  data: unknown;
}

export interface WebSocketCloseEvent {
  code?: number;
  reason?: string;
}

export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen?: ((event: unknown) => void) | null;
  onmessage?: ((event: WebSocketMessageEvent) => void) | null;
  onerror?: ((event: unknown) => void) | null;
  onclose?: ((event: WebSocketCloseEvent) => void) | null;
  addEventListener?: (type: 'open' | 'message' | 'error' | 'close', listener: (event: unknown) => void) => void;
  removeEventListener?: (type: 'open' | 'message' | 'error' | 'close', listener: (event: unknown) => void) => void;
  on?: (type: 'open' | 'message' | 'error' | 'close', listener: (event: unknown) => void) => void;
  off?: (type: 'open' | 'message' | 'error' | 'close', listener: (event: unknown) => void) => void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export interface LocalWebSocketConnectionOptions {
  url?: string;
  host?: string;
  port?: number;
  protocol?: 'ws' | 'wss';
  webSocketFactory?: WebSocketFactory;
}

export interface LocalWebSocketClientOptions extends LocalWebSocketConnectionOptions {
  clientId: string;
  displayName?: string;
  version?: string;
}

export interface LocalWebSocketRequestAccessOptions {
  scopes?: LocalWebSocketScope[];
  clientId?: string;
  displayName?: string;
  timeoutMs?: number;
}

export interface LocalWebSocketStream {
  close(): void;
  on<T extends LocalWebSocketMessageType>(type: T, handler: (payload: LocalWebSocketMessageMap[T]) => void): LocalWebSocketStream;
  off<T extends LocalWebSocketMessageType>(type: T, handler: (payload: LocalWebSocketMessageMap[T]) => void): LocalWebSocketStream;
  onAny(handler: (message: LocalWebSocketMessage) => void): LocalWebSocketStream;
  offAny(handler: (message: LocalWebSocketMessage) => void): LocalWebSocketStream;
  onEvent<T extends LocalWebSocketEventName>(name: T, handler: (payload: LocalWebSocketEventMap[T]) => void): LocalWebSocketStream;
  offEvent<T extends LocalWebSocketEventName>(name: T, handler: (payload: LocalWebSocketEventMap[T]) => void): LocalWebSocketStream;
}
