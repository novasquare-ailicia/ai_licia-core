import type { RankKey } from "@/lib/overlay";

export type LeaderboardEntry = {
  username: string;
  count: number;
  role?: string;
  firstSeenAt: number;
  messagesPerMinute?: number;
};

export type StreamStatus = "idle" | "connecting" | "connected" | "error";

export type AnimatedCardState =
  | "enter"
  | "promoted"
  | "demoted"
  | "update"
  | "stable";

export interface AnimatedCard {
  id: string;
  entry: LeaderboardEntry;
  rank: RankKey;
  placeholder: boolean;
  progress: number;
  state: AnimatedCardState;
  countKey: string;
}
