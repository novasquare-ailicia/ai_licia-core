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