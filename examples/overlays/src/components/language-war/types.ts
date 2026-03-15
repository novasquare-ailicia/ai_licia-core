import type { StreamStatus } from "@/components/overlay/types";

export type LanguageWarTrend = "up" | "down" | "flat";
export type LanguageWarPhase = "idle" | "battle" | "resolution" | "podium";

export interface LanguageWarStanding {
  code: string;
  count: number;
  share: number;
  delta: number;
  trend: LanguageWarTrend;
  color: string;
}

export interface LanguageWarWinner {
  code: string;
  count: number;
  share: number;
  color: string;
}

export interface LanguageWarSnapshot {
  phase: LanguageWarPhase;
  standings: LanguageWarStanding[];
  totalMessages: number;
  timeRemainingMs: number;
  progressRatio: number;
  roundIndex: number;
  title: string;
  eyebrowLabel: string;
  supportLabel: string;
  stateLabel: string;
  stateDescription: string;
  timerLabel: string;
  winner?: LanguageWarWinner;
  showWinnerCrown: boolean;
  surge?: {
    code: string;
    delta: number;
    windowMs: number;
  };
}

export interface LanguageWarViewState {
  snapshot: LanguageWarSnapshot;
  status: StreamStatus;
  statusMessage: string;
}
