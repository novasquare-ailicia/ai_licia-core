import {
  LOCAL_WEBSOCKET_CAPABILITIES,
  LOCAL_WEBSOCKET_EVENT_NAMES,
  LOCAL_WEBSOCKET_ERROR_CODES,
  LOCAL_WEBSOCKET_SCOPES,
  LocalWebSocketAccessDeniedPayload,
  LocalWebSocketAccessGrantedPayload,
  LocalWebSocketAccessPendingPayload,
  LocalWebSocketCapability,
  LocalWebSocketClientOptions,
  LocalWebSocketConnectionOptions,
  LocalWebSocketErrorPayload,
  LocalWebSocketEventEnvelope,
  LocalWebSocketEventMap,
  LocalWebSocketEventName,
  LocalWebSocketHelloPayload,
  LocalWebSocketMessage,
  LocalWebSocketMessageMap,
  LocalWebSocketMessageType,
  LocalWebSocketRequestAccessOptions,
  LocalWebSocketRequestAccessPayload,
  LocalWebSocketScope,
  LocalWebSocketStream,
  LocalWebSocketWelcomePayload,
  WebSocketFactory,
  WebSocketLike
} from './interfaces';

type MessageHandler<T extends LocalWebSocketMessageType> = (payload: LocalWebSocketMessageMap[T]) => void;
type AnyMessageHandler = (message: LocalWebSocketMessage) => void;
type EventHandler<T extends LocalWebSocketEventName> = (payload: LocalWebSocketEventMap[T]) => void;

type MessageHandlerMap = {
  [K in LocalWebSocketMessageType]?: Set<MessageHandler<K>>;
};

type EventHandlerMap = {
  [K in LocalWebSocketEventName]?: Set<EventHandler<K>>;
};

type PendingAccessRequest = {
  requestId?: string;
  resolve: (payload: LocalWebSocketAccessGrantedPayload) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 51743;
const DEFAULT_PROTOCOL: LocalWebSocketConnectionOptions['protocol'] = 'ws';
const DEFAULT_ACCESS_TIMEOUT_MS = 2 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isLocalWebSocketMessageType = (value: string): value is LocalWebSocketMessageType =>
  (['welcome', 'access_pending', 'access_granted', 'access_denied', 'error', 'event'] as const)
    .includes(value as LocalWebSocketMessageType);

const isLocalWebSocketEventName = (value: string): value is LocalWebSocketEventName =>
  (LOCAL_WEBSOCKET_EVENT_NAMES as readonly string[]).includes(value);

const isLocalWebSocketCapability = (value: string): value is LocalWebSocketCapability =>
  (LOCAL_WEBSOCKET_CAPABILITIES as readonly string[]).includes(value);

const isLocalWebSocketScope = (value: string): value is LocalWebSocketScope =>
  (LOCAL_WEBSOCKET_SCOPES as readonly string[]).includes(value);

const isLocalWebSocketErrorCode = (value: string): value is LocalWebSocketErrorPayload['code'] =>
  (LOCAL_WEBSOCKET_ERROR_CODES as readonly string[]).includes(value);

const decodeMessageData = (data: unknown): string | null => {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(data));
  }
  if (data instanceof Uint8Array) {
    return new TextDecoder().decode(data);
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
    return data.toString('utf-8');
  }
  return null;
};

const buildLocalWebSocketUrl = (options: LocalWebSocketConnectionOptions): string => {
  if (options.url) {
    return options.url;
  }
  const protocol = options.protocol ?? DEFAULT_PROTOCOL;
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  return `${protocol}://${host}:${port}`;
};

const resolveWebSocketFactory = (factory?: WebSocketFactory): WebSocketFactory => {
  if (factory) {
    return factory;
  }
  const globalWs = (globalThis as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket;
  if (globalWs) {
    return (url: string) => new globalWs(url);
  }
  throw new Error('WebSocket is not available. Provide webSocketFactory in LocalWebSocketClientOptions.');
};

export class LocalWebSocketClient implements LocalWebSocketStream {
  private readonly clientId: string;
  private readonly displayName?: string;
  private readonly version?: string;
  private readonly url: string;
  private readonly socketFactory: WebSocketFactory;
  private socket: WebSocketLike | null = null;
  private connectPromise: Promise<void> | null = null;
  private lastWelcome: LocalWebSocketWelcomePayload | null = null;
  private pendingWelcomeResolve: ((payload: LocalWebSocketWelcomePayload) => void) | null = null;
  private pendingWelcomeReject: ((error: Error) => void) | null = null;
  private pendingAccess: PendingAccessRequest | null = null;
  private readonly messageHandlers: MessageHandlerMap = {};
  private readonly anyHandlers = new Set<AnyMessageHandler>();
  private readonly eventHandlers: EventHandlerMap = {};

  constructor(options: LocalWebSocketClientOptions) {
    this.clientId = options.clientId;
    this.displayName = options.displayName;
    this.version = options.version;
    this.url = buildLocalWebSocketUrl(options);
    this.socketFactory = resolveWebSocketFactory(options.webSocketFactory);
  }

  public getUrl(): string {
    return this.url;
  }

  public isConnected(): boolean {
    return this.socket?.readyState === 1;
  }

  public async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const socket = this.socketFactory(this.url);
      this.socket = socket;

      const onOpen = () => {
        resolve();
      };

      const onError = () => {
        reject(new Error('WebSocket connection failed.'));
      };

      this.bindSocketEvents(socket, onOpen, onError);
    }).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise ?? Promise.resolve();
  }

  public close(): void {
    this.socket?.close(1000, 'client_closed');
    this.socket = null;
    this.connectPromise = null;
    if (this.pendingAccess) {
      this.pendingAccess.reject(new Error('WebSocket closed before access was granted.'));
      this.clearPendingAccess();
    }
    if (this.pendingWelcomeReject) {
      this.pendingWelcomeReject(new Error('WebSocket closed before welcome was received.'));
      this.pendingWelcomeReject = null;
      this.pendingWelcomeResolve = null;
    }
  }

  public async sendHello(overrides: Partial<LocalWebSocketHelloPayload> = {}): Promise<LocalWebSocketWelcomePayload> {
    await this.connect();
    if (this.lastWelcome) {
      return this.lastWelcome;
    }
    if (this.pendingWelcomeResolve) {
      return new Promise((resolve, reject) => {
        const previousResolve = this.pendingWelcomeResolve;
        const previousReject = this.pendingWelcomeReject;
        this.pendingWelcomeResolve = (payload) => {
          previousResolve?.(payload);
          resolve(payload);
        };
        this.pendingWelcomeReject = (error) => {
          previousReject?.(error);
          reject(error);
        };
      });
    }

    const resolvedClientId = overrides.clientId ?? this.clientId;
    if (!resolvedClientId) {
      throw new Error('clientId is required for the hello handshake.');
    }

    const hello: LocalWebSocketHelloPayload = {
      clientType: 'integration',
      clientId: resolvedClientId,
      displayName: overrides.displayName ?? this.displayName,
      version: overrides.version ?? this.version
    };

    this.sendMessage({ type: 'hello', payload: hello });

    return new Promise((resolve, reject) => {
      this.pendingWelcomeResolve = resolve;
      this.pendingWelcomeReject = reject;
    });
  }

  public async requestAccess(options: LocalWebSocketRequestAccessOptions = {}): Promise<LocalWebSocketAccessGrantedPayload> {
    if (this.pendingAccess) {
      throw new Error('Access request already pending.');
    }
    const scopes = options.scopes ?? [...LOCAL_WEBSOCKET_SCOPES];
    const clientId = options.clientId ?? this.clientId;
    const displayName = options.displayName ?? this.displayName ?? clientId;
    const timeoutMs = options.timeoutMs ?? DEFAULT_ACCESS_TIMEOUT_MS;

    if (!clientId) {
      throw new Error('clientId is required to request access.');
    }
    if (scopes.length === 0) {
      throw new Error('At least one scope is required to request access.');
    }
    const invalidScopes = scopes.filter((scope) => !LOCAL_WEBSOCKET_SCOPES.includes(scope));
    if (invalidScopes.length > 0) {
      throw new Error(`Unsupported scopes: ${invalidScopes.join(', ')}`);
    }

    const welcome = await this.sendHello({ clientId, displayName });
    if (!welcome.capabilities.includes('integration.auth')) {
      throw new Error('integration.auth capability is not available yet.');
    }

    const payload: LocalWebSocketRequestAccessPayload = {
      clientId,
      displayName,
      requestedScopes: scopes
    };

    this.sendMessage({ type: 'request_access', payload });

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Access request timed out.'));
        this.clearPendingAccess();
      }, timeoutMs);
      this.pendingAccess = { resolve, reject, timeoutId };
    });
  }

  public on<T extends LocalWebSocketMessageType>(
    type: T,
    handler: (payload: LocalWebSocketMessageMap[T]) => void
  ): LocalWebSocketClient {
    const entry = this.getMessageHandlerSet(type);
    entry.add(handler);
    return this;
  }

  public off<T extends LocalWebSocketMessageType>(
    type: T,
    handler: (payload: LocalWebSocketMessageMap[T]) => void
  ): LocalWebSocketClient {
    const entry = this.messageHandlers[type] as Set<MessageHandler<T>> | undefined;
    entry?.delete(handler);
    if (entry && entry.size === 0) {
      delete this.messageHandlers[type];
    }
    return this;
  }

  public onAny(handler: AnyMessageHandler): LocalWebSocketClient {
    this.anyHandlers.add(handler);
    return this;
  }

  public offAny(handler: AnyMessageHandler): LocalWebSocketClient {
    this.anyHandlers.delete(handler);
    return this;
  }

  public onEvent<T extends LocalWebSocketEventName>(
    name: T,
    handler: (payload: LocalWebSocketEventMap[T]) => void
  ): LocalWebSocketClient {
    const entry = this.getEventHandlerSet(name);
    entry.add(handler);
    return this;
  }

  public offEvent<T extends LocalWebSocketEventName>(
    name: T,
    handler: (payload: LocalWebSocketEventMap[T]) => void
  ): LocalWebSocketClient {
    const entry = this.eventHandlers[name] as Set<EventHandler<T>> | undefined;
    entry?.delete(handler);
    if (entry && entry.size === 0) {
      delete this.eventHandlers[name];
    }
    return this;
  }

  private bindSocketEvents(socket: WebSocketLike, onOpen: () => void, onError: () => void): void {
    const handleOpen = () => onOpen();
    const handleError = () => {
      this.socket = null;
      if (this.pendingAccess) {
        this.pendingAccess.reject(new Error('WebSocket error before access was granted.'));
        this.clearPendingAccess();
      }
      if (this.pendingWelcomeReject) {
        this.pendingWelcomeReject(new Error('WebSocket error before welcome was received.'));
        this.pendingWelcomeReject = null;
        this.pendingWelcomeResolve = null;
      }
      onError();
    };
    const handleMessage = (eventOrData: unknown) => {
      const messageEvent = eventOrData as { data?: unknown };
      if (messageEvent && Object.prototype.hasOwnProperty.call(messageEvent, 'data')) {
        this.handleMessage(messageEvent.data);
        return;
      }
      this.handleMessage(eventOrData);
    };
    const handleClose = () => {
      this.socket = null;
      this.lastWelcome = null;
      if (this.pendingAccess) {
        this.pendingAccess.reject(new Error('WebSocket closed before access was granted.'));
        this.clearPendingAccess();
      }
      if (this.pendingWelcomeReject) {
        this.pendingWelcomeReject(new Error('WebSocket closed before welcome was received.'));
        this.pendingWelcomeReject = null;
        this.pendingWelcomeResolve = null;
      }
    };

    if (socket.addEventListener) {
      socket.addEventListener('open', handleOpen);
      socket.addEventListener('error', handleError);
      socket.addEventListener('message', handleMessage);
      socket.addEventListener('close', handleClose);
      return;
    }

    if (socket.on) {
      socket.on('open', handleOpen);
      socket.on('error', handleError);
      socket.on('message', handleMessage);
      socket.on('close', handleClose);
      return;
    }

    socket.onopen = handleOpen;
    socket.onerror = handleError;
    socket.onmessage = handleMessage;
    socket.onclose = handleClose;
  }

  private sendMessage(message: { type: 'hello'; payload: LocalWebSocketHelloPayload } | { type: 'request_access'; payload: LocalWebSocketRequestAccessPayload }): void {
    if (!this.socket || this.socket.readyState !== 1) {
      throw new Error('WebSocket is not connected.');
    }
    this.socket.send(JSON.stringify(message));
  }

  private handleMessage(raw: unknown): void {
    const decoded = decodeMessageData(raw);
    if (!decoded) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded);
    } catch {
      return;
    }
    if (!isRecord(parsed)) {
      return;
    }
    const typeValue = readString(parsed.type);
    if (!typeValue || !isLocalWebSocketMessageType(typeValue)) {
      return;
    }
    const payload = isRecord(parsed.payload) ? parsed.payload : {};
    const message = this.parsePayload(typeValue, payload);
    if (!message) {
      return;
    }
    this.dispatchMessage(message);
  }

  private parsePayload(type: LocalWebSocketMessageType, payload: Record<string, unknown>): LocalWebSocketMessage | null {
    switch (type) {
      case 'welcome': {
        const capabilitiesRaw = Array.isArray(payload.capabilities) ? payload.capabilities : [];
        const capabilities = capabilitiesRaw
          .map((value) => (typeof value === 'string' ? value : null))
          .filter((value): value is string => !!value)
          .filter(isLocalWebSocketCapability);
        return { type, payload: { capabilities } };
      }
      case 'access_pending': {
        const requestId = readString(payload.requestId);
        if (!requestId) return null;
        const parsedPayload: LocalWebSocketAccessPendingPayload = { requestId };
        return { type, payload: parsedPayload };
      }
      case 'access_granted': {
        const requestId = readString(payload.requestId);
        const apiKey = readString(payload.apiKey);
        const scopesRaw = Array.isArray(payload.scopes) ? payload.scopes : [];
        const scopes = scopesRaw
          .map((value) => (typeof value === 'string' ? value : null))
          .filter((value): value is string => !!value)
          .filter(isLocalWebSocketScope);
        if (!requestId || !apiKey || scopes.length === 0) {
          return null;
        }
        const channelName = readString(payload.channelName);
        const parsedPayload: LocalWebSocketAccessGrantedPayload = {
          requestId,
          apiKey,
          scopes,
          channelName
        };
        return { type, payload: parsedPayload };
      }
      case 'access_denied': {
        const requestId = readString(payload.requestId);
        const reason = readString(payload.reason) as LocalWebSocketAccessDeniedPayload['reason'] | undefined;
        if (!requestId || !reason || !['user_denied', 'timeout', 'not_ready'].includes(reason)) {
          return null;
        }
        const parsedPayload: LocalWebSocketAccessDeniedPayload = { requestId, reason };
        return { type, payload: parsedPayload };
      }
      case 'error': {
        const code = readString(payload.code);
        const message = readString(payload.message);
        if (!code || !message || !isLocalWebSocketErrorCode(code)) {
          return null;
        }
        const parsedPayload: LocalWebSocketErrorPayload = { code, message };
        return { type, payload: parsedPayload };
      }
      case 'event': {
        const name = readString(payload.name);
        if (!name || !isLocalWebSocketEventName(name)) {
          return null;
        }
        const dataRaw = isRecord(payload.data) ? payload.data : {};
        if (name === 'ttsAmplitude') {
          const soundAmplitudeValue = isNumber(dataRaw.soundAmplitudeValue) ? dataRaw.soundAmplitudeValue : null;
          if (soundAmplitudeValue === null) {
            return null;
          }
          const animationIdValue = dataRaw.animationId;
          const animationId =
            typeof animationIdValue === 'string' || typeof animationIdValue === 'number' || animationIdValue === null
              ? animationIdValue
              : undefined;
          const eventPayload: LocalWebSocketEventEnvelope<'ttsAmplitude'> = {
            name: 'ttsAmplitude',
            data: {
              soundAmplitudeValue,
              animationId
            }
          };
          return { type, payload: eventPayload };
        }
        return null;
      }
      default:
        return null;
    }
  }

  private dispatchMessage(message: LocalWebSocketMessage): void {
    this.anyHandlers.forEach((handler) => handler(message));
    const entry = this.messageHandlers[message.type] as Set<MessageHandler<typeof message.type>> | undefined;
    entry?.forEach((handler) => handler(message.payload));

    if (message.type === 'welcome') {
      this.lastWelcome = message.payload;
      if (this.pendingWelcomeResolve) {
        this.pendingWelcomeResolve(message.payload);
        this.pendingWelcomeResolve = null;
        this.pendingWelcomeReject = null;
      }
    }

    if (message.type === 'access_pending') {
      this.handleAccessPending(message.payload);
    }
    if (message.type === 'access_granted') {
      this.handleAccessGranted(message.payload);
    }
    if (message.type === 'access_denied') {
      this.handleAccessDenied(message.payload);
    }
    if (message.type === 'error') {
      this.handleAccessError(message.payload);
    }

    if (message.type === 'event') {
      const event = message.payload;
      const eventHandlers = this.eventHandlers[event.name] as Set<EventHandler<typeof event.name>> | undefined;
      eventHandlers?.forEach((handler) => handler(event.data));
    }
  }

  private handleAccessPending(payload: LocalWebSocketAccessPendingPayload): void {
    if (!this.pendingAccess) {
      return;
    }
    if (!this.pendingAccess.requestId) {
      this.pendingAccess.requestId = payload.requestId;
    }
  }

  private handleAccessGranted(payload: LocalWebSocketAccessGrantedPayload): void {
    if (!this.pendingAccess) {
      return;
    }
    if (this.pendingAccess.requestId && this.pendingAccess.requestId !== payload.requestId) {
      return;
    }
    this.pendingAccess.resolve(payload);
    this.clearPendingAccess();
  }

  private handleAccessDenied(payload: LocalWebSocketAccessDeniedPayload): void {
    if (!this.pendingAccess) {
      return;
    }
    if (this.pendingAccess.requestId && this.pendingAccess.requestId !== payload.requestId) {
      return;
    }
    this.pendingAccess.reject(new Error(`Access denied: ${payload.reason}`));
    this.clearPendingAccess();
  }

  private handleAccessError(payload: LocalWebSocketErrorPayload): void {
    if (!this.pendingAccess) {
      return;
    }
    this.pendingAccess.reject(new Error(`${payload.code}: ${payload.message}`));
    this.clearPendingAccess();
  }

  private clearPendingAccess(): void {
    if (this.pendingAccess?.timeoutId) {
      clearTimeout(this.pendingAccess.timeoutId);
    }
    this.pendingAccess = null;
  }

  private getMessageHandlerSet<T extends LocalWebSocketMessageType>(type: T): Set<MessageHandler<T>> {
    const existing = this.messageHandlers[type] as Set<MessageHandler<T>> | undefined;
    if (existing) {
      return existing;
    }
    const created = new Set<MessageHandler<T>>();
    this.messageHandlers[type] = created as MessageHandlerMap[T];
    return created;
  }

  private getEventHandlerSet<T extends LocalWebSocketEventName>(name: T): Set<EventHandler<T>> {
    const existing = this.eventHandlers[name] as Set<EventHandler<T>> | undefined;
    if (existing) {
      return existing;
    }
    const created = new Set<EventHandler<T>>();
    this.eventHandlers[name] = created as EventHandlerMap[T];
    return created;
  }
}

export const getLocalWebSocketUrl = (options: LocalWebSocketConnectionOptions = {}): string =>
  buildLocalWebSocketUrl(options);
