import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  AiliciaConfig,
  Event,
  EventContent,
  EventContentGeneration,
  EventGeneration,
  EventType,
  GenerationOptions,
  GenerationResponse,
  ChatMessageStreamOptions,
  ChatMessageStream,
  PublicChatMessage,
  CharacterSummary,
  JoinChannelResponse,
  EventSubAuth,
  EventSubStream,
  EventSubStreamOptions,
  EventSubEventType,
  EventSubEventMap,
  EventSubEnvelope,
  EventSubAnyHandler,
  EventSubHandler
} from './interfaces';

type StreamReader = {
  read: () => Promise<{ value?: Uint8Array; done: boolean }>;
  cancel: (reason?: unknown) => Promise<void>;
};

const EVENT_SUB_EVENT_TYPES: EventSubEventType[] = [
  'chat.message',
  'chat.ai_message',
  'chat.first_message',
  'ai.thoughts',
  'ai.tts.generated',
  'channel.event',
  'channel.go_live',
  'channel.go_offline',
  'ai.moderation',
  'api.event',
  'system.join',
  'system.left',
  'character.updated'
];

const isEventSubEventType = (value: string): value is EventSubEventType =>
  (EVENT_SUB_EVENT_TYPES as string[]).includes(value);

const resolveEventSubToken = (auth: EventSubAuth): string => {
  if (auth.type === 'jwt') {
    return auth.token;
  }
  return auth.key;
};

type InternalEventSubStream = EventSubStream & {
  emit<T extends EventSubEventType>(type: T, event: EventSubEventMap[T]): void;
  setTeardown(teardown: () => void): void;
};

/**
 * AiliciaClient to interact with the ai_licia API
 */
export class AiliciaClient {
  private apiKey: string;
  private channelName: string;
  private client: AxiosInstance;
  private baseUrl: string;
  private static instance: AiliciaClient;

  /**
   * Creates a new AiliciaClient instance
   * 
   * @param apiKey - Optional API key (will use environment variables if not provided)
   * @param channelName - Optional channel name (will use environment variables if not provided)
   * @param baseUrl - Optional base URL (will use default or environment variables if not provided)
   */
  constructor(apiKey?: string, channelName?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.AI_LICIA_API_KEY || '';
    this.channelName = channelName || process.env.AI_LICIA_CHANNEL || '';
    const apiUrl = baseUrl || process.env.AI_LICIA_API_URL || 'https://api.getailicia.com/v1';
    this.baseUrl = apiUrl.replace(/\/$/, '');
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey
      }
    });
  }

  /**
   * Gets or creates the AiliciaClient instance
   * 
   * @param config - Configuration for the ailicia client
   * @returns AiliciaClient instance
   */
  public static getInstance(config: AiliciaConfig): AiliciaClient {
    if (!AiliciaClient.instance) {
      AiliciaClient.instance = new AiliciaClient(
        config.apiKey,
        config.channelName,
        config.baseUrl
      );
    }
    
    return AiliciaClient.instance;
  }

  /**
   * Feeds data to ai_licia to be added to her context
   * 
   * @param content - The data for ai_licia to process (max 700 characters)
   * @param ttl - Optional Time-to-Live in seconds
   * @returns Promise that resolves when data is successfully sent
   * @throws Error if the request fails
   */
  public async sendEvent(content: string, ttl?: number): Promise<void> {
    if (content.length > 700) {
      throw new Error('Content exceeds the 700-character limit');
    }

    const eventContent: EventContent = {
      channelName: this.channelName,
      content,
      ttl
    };

    const event: Event = {
      eventType: EventType.GAME_EVENT,
      data: eventContent
    };

    try {
      await this.client.post('/events', event);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const data = axiosError.response?.data as Record<string, any>;
        const message = data?.message || axiosError.message;
        
        if (status === 400) {
          throw new Error(`Invalid input: ${message}`);
        } else if (status === 401) {
          throw new Error(`Unauthorized: Not allowed to send events for this channel. ${message}`);
        } else if (status === 422) {
          throw new Error(`Content exceeds the 700-character limit: ${message}`);
        } else {
          throw new Error(`Failed to send event: ${message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Triggers a reaction from ai_licia
   * 
   * @param content - The data for ai_licia to react to (max 300 characters)
   * @returns Promise that resolves with the response from ai_licia
   * @throws Error if the request fails
   */
  public async triggerGeneration(content: string): Promise<GenerationResponse> {
    if (content.length > 300) {
      throw new Error('Content exceeds the 300-character limit');
    }

    const eventContent: EventContentGeneration = {
      channelName: this.channelName,
      content
    };

    const event: EventGeneration = {
      eventType: EventType.GAME_EVENT,
      data: eventContent
    };

    try {
      const response = await this.client.post('/events/generations', event);
      return response.data as GenerationResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const data = axiosError.response?.data as Record<string, any>;
        const message = data?.message || axiosError.message;
        
        if (status === 400) {
          throw new Error(`Invalid input: ${message}`);
        } else if (status === 401) {
          throw new Error(`Unauthorized: Not allowed to send events for this channel. ${message}`);
        } else if (status === 422) {
          throw new Error(`Content exceeds the 300-character limit: ${message}`);
        } else if (status === 429) {
          throw new Error(`Too many requests: ${message}`);
        } else {
          throw new Error(`Failed to trigger generation: ${message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Lists the characters available to the authenticated streamer.
   */
  public async listCharacters(): Promise<CharacterSummary[]> {
    try {
      const response = await this.client.get('/characters');
      return response.data as CharacterSummary[];
    } catch (error) {
      this.handleAxiosError('Failed to list characters', error);
    }
  }

  /**
   * Sets the active character for the authenticated streamer.
   */
  public async setActiveCharacter(characterId: string): Promise<void> {
    if (!characterId) {
      throw new Error('characterId is required to activate a character');
    }
    try {
      await this.client.put(`/characters/${encodeURIComponent(characterId)}/active`);
    } catch (error) {
      this.handleAxiosError('Failed to set active character', error);
    }
  }

  /**
   * Requests ai_licia to join a chat channel immediately.
   */
  public async requestStreamJoin(channelName?: string): Promise<JoinChannelResponse> {
    const targetChannel = this.resolveChannelName(channelName);
    try {
      const response = await this.client.post(`/streams/${encodeURIComponent(targetChannel)}`);
      return response.data as JoinChannelResponse;
    } catch (error) {
      this.handleAxiosError('Failed to request ai_licia to join chat', error);
    }
  }

  /**
   * Requests ai_licia to leave a chat channel.
   */
  public async requestStreamLeave(channelName?: string): Promise<void> {
    const targetChannel = this.resolveChannelName(channelName);
    try {
      await this.client.delete(`/streams/${encodeURIComponent(targetChannel)}`);
    } catch (error) {
      this.handleAxiosError('Failed to request ai_licia to leave chat', error);
    }
  }

  /**
   * Listens to the public chat message stream via Server-Sent Events.
   * Returns a handle that can be closed to stop streaming.
   *
   * @param options - Roles filter and callbacks for stream lifecycle events
   */
  public streamPublicChatMessages(options: ChatMessageStreamOptions): ChatMessageStream {
    const {
      onMessage,
      roles,
      autoReconnect = false,
      reconnectDelayMs = 4000,
      reconnectBackoffMultiplier = 1.5,
      reconnectJitterMs = 1000,
      maxReconnectAttempts = Infinity,
      onReconnectAttempt,
      onConnectionStateChange,
      onError,
      onOpen,
      onClose,
    } = options;
    if (typeof onMessage !== 'function') {
      throw new Error('onMessage callback is required to consume chat messages.');
    }

    const normalizedBase = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const query = roles && roles.length > 0
      ? `?${roles.map(role => `roles=${encodeURIComponent(role)}`).join('&')}`
      : '';
    const streamUrl = new URL(`events/chat/messages/stream${query}`, normalizedBase);

    const headers: Record<string, string> = {
      'Accept': 'text/event-stream',
      'Authorization': `Bearer ${this.apiKey}`
    };

    let controller: AbortController | null = null;
    let reader: StreamReader | null = null;
    let shutdown = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    const computeDelayMs = (attempt: number) => {
      const multiplier = Math.max(1, reconnectBackoffMultiplier);
      const base = reconnectDelayMs * Math.pow(multiplier, Math.max(0, attempt - 1));
      const jitter = reconnectJitterMs > 0 ? Math.random() * reconnectJitterMs : 0;
      return base + jitter;
    };

    const cleanupConnection = () => {
      reader?.cancel().catch(() => {});
      reader = null;
      controller?.abort();
      controller = null;
    };

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const handleFinalClose = () => {
      cleanupConnection();
      clearReconnectTimer();
      onClose?.();
    };

    const scheduleReconnect = () => {
      if (!autoReconnect || shutdown) {
        handleFinalClose();
        return;
      }
      if (reconnectAttempts >= maxReconnectAttempts) {
        handleFinalClose();
        return;
      }
      reconnectAttempts += 1;
      const delayMs = computeDelayMs(reconnectAttempts);
      onReconnectAttempt?.({ attempt: reconnectAttempts, delayMs });
      onConnectionStateChange?.("reconnecting");
      clearReconnectTimer();
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!shutdown) {
          startStream();
        }
      }, delayMs);
    };

    const startStream = async () => {
      try {
        onConnectionStateChange?.(reconnectAttempts === 0 ? "connecting" : "reconnecting");
        cleanupConnection();
        const localController = new AbortController();
        controller = localController;
        const decoder = new TextDecoder();
        let buffer = '';

        const response = await fetch(streamUrl, {
          method: 'GET',
          headers,
          signal: localController.signal
        });

        if (!response.ok || !response.body) {
          throw new Error(`Failed to connect to chat stream: HTTP ${response.status}`);
        }

        reconnectAttempts = 0;
        onOpen?.();
        reader = response.body.getReader();

        while (!shutdown) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            let delimiterIndex = buffer.indexOf('\n\n');

            while (delimiterIndex !== -1) {
              const rawEvent = buffer.slice(0, delimiterIndex);
              buffer = buffer.slice(delimiterIndex + 2);
              delimiterIndex = buffer.indexOf('\n\n');

              const trimmedEvent = rawEvent.trim();
              if (!trimmedEvent || trimmedEvent.startsWith(':')) {
                continue;
              }

              const parsed = this.parseSseEvent(trimmedEvent);
              if (parsed.event && parsed.event !== 'message') {
                continue;
              }
              if (!parsed.data) {
                continue;
              }

              try {
                const payload = JSON.parse(parsed.data) as PublicChatMessage;
                const message: PublicChatMessage = {
                  ...payload,
                  id: payload.id ?? parsed.id
                };
                onMessage(message);
              } catch (error) {
                onError?.(error instanceof Error ? error : new Error(String(error)));
              }
            }
          }
        }
        cleanupConnection();
        scheduleReconnect();
      } catch (error) {
        cleanupConnection();
        if (!shutdown) {
          onError?.(error instanceof Error ? error : new Error(String(error)));
          scheduleReconnect();
        }
      }
    };

    startStream();

    return {
      close: () => {
        if (shutdown) return;
        shutdown = true;
        clearReconnectTimer();
        cleanupConnection();
        onClose?.();
      }
    };
  }

  /**
   * Subscribes to the EventSub SSE stream for chat, AI, moderation, and system events.
   * Provide explicit auth so the server can enforce JWT vs API key entitlements.
   */
  public streamEventSub(auth: EventSubAuth, options: EventSubStreamOptions = {}): EventSubStream {
    const {
      types,
      channelId,
      cursor,
      handlers,
      autoReconnect = true,
      reconnectDelayMs = 4000,
      reconnectBackoffMultiplier = 1.5,
      reconnectJitterMs = 1000,
      maxReconnectAttempts = Infinity,
      onReconnectAttempt,
      onConnectionStateChange,
      onError,
      onOpen,
      onClose
    } = options;

    const authToken = resolveEventSubToken(auth).trim();
    if (!authToken) {
      throw new Error('EventSub auth token is required.');
    }

    const normalizedBase = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const params = new URLSearchParams();
    if (types?.length) {
      params.set('types', types.join(','));
    }
    if (channelId) {
      params.set('channelId', channelId);
    }
    if (cursor) {
      params.set('cursor', cursor);
    }
    const streamPath = params.toString() ? `eventsub/stream?${params}` : 'eventsub/stream';
    const streamUrl = new URL(streamPath, normalizedBase);

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${authToken}`
    };

    let controller: AbortController | null = null;
    let reader: StreamReader | null = null;
    let shutdown = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let closedCallbackFired = false;

    const subscription: InternalEventSubStream = new EventSubSubscriptionImpl();

    if (handlers) {
      (Object.entries(handlers) as [EventSubEventType, EventSubHandler<EventSubEventType>][])
        .forEach(([type, handler]) => {
          if (handler) {
            subscription.on(type, handler as EventSubHandler<typeof type>);
          }
        });
    }

    const fireOnClose = () => {
      if (!closedCallbackFired) {
        closedCallbackFired = true;
        onClose?.();
      }
    };

    const cleanupConnection = () => {
      reader?.cancel().catch(() => {});
      reader = null;
      controller?.abort();
      controller = null;
    };

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const handleFinalClose = () => {
      shutdown = true;
      cleanupConnection();
      clearReconnectTimer();
      fireOnClose();
    };

    const computeDelayMs = (attempt: number) => {
      const multiplier = Math.max(1, reconnectBackoffMultiplier);
      const base = reconnectDelayMs * Math.pow(multiplier, Math.max(0, attempt - 1));
      const jitter = reconnectJitterMs > 0 ? Math.random() * reconnectJitterMs : 0;
      return base + jitter;
    };

    const scheduleReconnect = () => {
      if (!autoReconnect || shutdown) {
        handleFinalClose();
        return;
      }
      if (reconnectAttempts >= maxReconnectAttempts) {
        handleFinalClose();
        return;
      }
      reconnectAttempts += 1;
      const delayMs = computeDelayMs(reconnectAttempts);
      onReconnectAttempt?.({ attempt: reconnectAttempts, delayMs });
      onConnectionStateChange?.('reconnecting');
      clearReconnectTimer();
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!shutdown) {
          startStream();
        }
      }, delayMs);
    };

    const startStream = async () => {
      try {
        onConnectionStateChange?.(reconnectAttempts === 0 ? 'connecting' : 'reconnecting');
        cleanupConnection();
        const localController = new AbortController();
        controller = localController;
        const decoder = new TextDecoder();
        let buffer = '';

        const response = await fetch(streamUrl, {
          method: 'GET',
          headers,
          signal: localController.signal
        });

        if (!response.ok || !response.body) {
          let detail = '';
          try {
            detail = (await response.text()).trim();
          } catch {
            detail = '';
          }
          const suffix = detail ? ` ${detail}` : '';

          if (response.status === 401) {
            throw new Error(`Unauthorized to connect to EventSub stream.${suffix}`);
          }
          if (response.status === 400) {
            throw new Error(`Invalid EventSub types value.${suffix}`);
          }
          throw new Error(`Failed to connect to EventSub stream: HTTP ${response.status}.${suffix}`);
        }

        reconnectAttempts = 0;
        closedCallbackFired = false;
        onOpen?.();
        reader = response.body.getReader();

        while (!shutdown) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            let delimiterIndex = buffer.indexOf('\n\n');

            while (delimiterIndex !== -1) {
              const rawEvent = buffer.slice(0, delimiterIndex);
              buffer = buffer.slice(delimiterIndex + 2);
              delimiterIndex = buffer.indexOf('\n\n');

              const trimmedEvent = rawEvent.trim();
              if (!trimmedEvent || trimmedEvent.startsWith(':')) {
                continue;
              }

              this.handleEventSubFrame(trimmedEvent, subscription, onError);
            }
          }
        }

        cleanupConnection();
        if (shutdown) {
          fireOnClose();
        } else {
          scheduleReconnect();
        }
      } catch (error) {
        cleanupConnection();
        if (shutdown) {
          fireOnClose();
          return;
        }
        onError?.(error instanceof Error ? error : new Error(String(error)));
        scheduleReconnect();
      }
    };

    const manualClose = () => {
      if (shutdown) {
        return;
      }
      shutdown = true;
      clearReconnectTimer();
      cleanupConnection();
      fireOnClose();
    };

    subscription.setTeardown(manualClose);
    startStream();

    return subscription;
  }

  private parseSseEvent(rawEvent: string): { id?: string; event?: string; data?: string } {
    const event: { id?: string; event?: string; data?: string } = {};
    const dataParts: string[] = [];

    for (const line of rawEvent.split(/\r?\n/)) {
      if (line.startsWith('id:')) {
        event.id = line.slice(3).trim();
      } else if (line.startsWith('event:')) {
        event.event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        let value = line.slice(5);
        if (value.startsWith(' ')) {
          value = value.slice(1);
        }
        dataParts.push(value);
      }
    }

    if (dataParts.length > 0) {
      event.data = dataParts.join('\n');
    }

    return event;
  }

  private handleEventSubFrame(
    rawEvent: string,
    subscription: InternalEventSubStream,
    onError?: (error: Error) => void
  ): void {
    const parsed = this.parseSseEvent(rawEvent);
    if (!parsed.data) {
      return;
    }

    try {
      const envelope = JSON.parse(parsed.data) as EventSubEnvelope;
      const resolvedType = (parsed.event && parsed.event !== 'message' ? parsed.event : envelope.type) ?? '';

      if (resolvedType && isEventSubEventType(resolvedType)) {
        subscription.emit(resolvedType, envelope as EventSubEventMap[typeof resolvedType]);
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private resolveChannelName(channelName?: string): string {
    const resolved = (channelName ?? this.channelName).trim();
    if (!resolved) {
      throw new Error('Channel name is required. Provide it in the constructor or as a method argument.');
    }
    return resolved;
  }

  private handleAxiosError(context: string, error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const data = axiosError.response?.data as Record<string, any> | undefined;
      const detail = data?.message || axiosError.message;
      throw new Error(`${context}: ${detail}`);
    }
    throw error;
  }
}

class EventSubSubscriptionImpl implements InternalEventSubStream {
  private teardown: () => void;
  private readonly handlers = new Map<EventSubEventType, Set<EventSubHandler<EventSubEventType>>>();
  private readonly anyHandlers = new Set<EventSubAnyHandler>();

  constructor(teardown?: () => void) {
    this.teardown = teardown ?? (() => {});
  }

  public setTeardown(teardown: () => void): void {
    this.teardown = teardown;
  }

  public on<T extends EventSubEventType>(type: T, handler: EventSubHandler<T>): EventSubStream {
    const entry = this.handlers.get(type) ?? new Set();
    entry.add(handler as EventSubHandler<EventSubEventType>);
    this.handlers.set(type, entry);
    return this;
  }

  public off<T extends EventSubEventType>(type: T, handler: EventSubHandler<T>): EventSubStream {
    const entry = this.handlers.get(type);
    entry?.delete(handler as EventSubHandler<EventSubEventType>);
    if (entry && entry.size === 0) {
      this.handlers.delete(type);
    }
    return this;
  }

  public onAny(handler: EventSubAnyHandler): EventSubStream {
    this.anyHandlers.add(handler);
    return this;
  }

  public offAny(handler: EventSubAnyHandler): EventSubStream {
    this.anyHandlers.delete(handler);
    return this;
  }

  public emit<T extends EventSubEventType>(type: T, event: EventSubEventMap[T]): void {
    const entry = this.handlers.get(type);
    entry?.forEach((handler) => {
      (handler as EventSubHandler<T>)(event);
    });
    this.anyHandlers.forEach((handler) => handler(event));
  }

  public close(): void {
    this.teardown();
  }
}
