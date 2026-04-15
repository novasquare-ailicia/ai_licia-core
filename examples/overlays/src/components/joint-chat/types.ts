import type { EventSubEventType, Platform } from "ai_licia-client";

export type JointChatItemKind = "chat" | "event";

export interface JointChatFeedItem {
  id: string;
  kind: JointChatItemKind;
  platform: Platform;
  username: string;
  usernameColor: string;
  message: string;
  statusChips: string[];
  emphasized: boolean;
  ingestedAt: number;
  leaving: boolean;
  sourceEventType: EventSubEventType;
  dedupeKey: string | null;
}
