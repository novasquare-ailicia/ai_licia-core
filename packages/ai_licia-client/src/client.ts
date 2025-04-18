import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
  AiliciaConfig, 
  Event, 
  EventContent, 
  EventContentGeneration, 
  EventGeneration, 
  EventType,
  GenerationOptions,
  GenerationResponse
} from './interfaces';

/**
 * AiliciaClient to interact with the ai_licia API
 */
export class AiliciaClient {
  private apiKey: string;
  private channelName: string;
  private client: AxiosInstance;
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
    
    this.client = axios.create({
      baseURL: apiUrl,
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
} 