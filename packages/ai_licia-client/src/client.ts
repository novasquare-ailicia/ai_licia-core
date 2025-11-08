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
  PublicChatMessage
} from './interfaces';

type StreamReader = {
  read: () => Promise<{ value?: Uint8Array; done: boolean }>;
  cancel: (reason?: unknown) => Promise<void>;
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
   * Listens to the public chat message stream via Server-Sent Events.
   * Returns a handle that can be closed to stop streaming.
   *
   * @param options - Roles filter and callbacks for stream lifecycle events
   */
  public streamPublicChatMessages(options: ChatMessageStreamOptions): ChatMessageStream {
    const { onMessage } = options;
    if (typeof onMessage !== 'function') {
      throw new Error('onMessage callback is required to consume chat messages.');
    }

    const normalizedBase = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const query = options.roles && options.roles.length > 0
      ? `?${options.roles.map(role => `roles=${encodeURIComponent(role)}`).join('&')}`
      : '';
    const streamUrl = new URL(`events/chat/messages/stream${query}`, normalizedBase);

    const headers: Record<string, string> = {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Authorization': `Bearer ${this.apiKey}`
    };

    const controller = new AbortController();
    const decoder = new TextDecoder();
    let reader: StreamReader | null = null;
    let closed = false;
    let buffer = '';

    const finalize = () => {
      if (closed) {
        return;
      }
      closed = true;
      reader?.cancel().catch(() => {});
      controller.abort();
      options.onClose?.();
    };

    const pump = async () => {
      try {
        const response = await fetch(streamUrl.toString(), {
          method: 'GET',
          headers,
          signal: controller.signal
        });

        if (!response.ok || !response.body) {
          throw new Error(`Failed to connect to chat stream: HTTP ${response.status}`);
        }

        options.onOpen?.();
        reader = response.body.getReader();

        while (!closed) {
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
                options.onError?.(error instanceof Error ? error : new Error(String(error)));
              }
            }
          }
        }
      } catch (error) {
        if (!closed) {
          options.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      } finally {
        finalize();
      }
    };

    pump();

    return {
      close: () => {
        finalize();
      }
    };
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
}
