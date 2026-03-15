"use client";

import {
  resolveLanguageWarColor,
  resolveLanguageWarName,
} from "@/lib/languageWarOverlay";
import type {
  LanguageWarPhase,
  LanguageWarSnapshot,
  LanguageWarStanding,
} from "./types";

const DEMO_CODES = ["EN", "FR", "ES", "DE", "PT"] as const;

const buildStandings = (
  counts: number[],
  trendMode: "live" | "frozen"
): LanguageWarStanding[] => {
  const totalMessages = counts.reduce((sum, value) => sum + value, 0);
  return DEMO_CODES.map((code, index) => {
    const trend: LanguageWarStanding["trend"] =
      trendMode === "frozen"
        ? "flat"
        : index < 2
        ? "up"
        : index === 4
        ? "down"
        : "flat";

    return {
      code,
      count: counts[index] ?? 0,
      share: totalMessages > 0 ? (counts[index] ?? 0) / totalMessages : 0,
      delta:
        trendMode === "frozen" ? 0 : index < 2 ? 2 : index === 4 ? -1 : 0,
      trend,
      color: resolveLanguageWarColor(code),
    };
  }).sort((a, b) => b.count - a.count);
};

const buildDefaultCounts = (phase: LanguageWarPhase) => {
  if (phase === "idle") {
    return [0, 0, 0, 0, 0];
  }
  if (phase === "battle") {
    return [210, 198, 60, 25, 10];
  }
  return [224, 208, 63, 28, 10];
};

const formatCompactCountdown = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

interface LanguageWarDemoOptions {
  idleTimeRemainingMs?: number;
  battleTimeRemainingMs?: number;
  battleDurationMs?: number;
  podiumTimeRemainingMs?: number;
  counts?: number[];
}

export const buildLanguageWarDemoSnapshot = (
  phase: LanguageWarPhase,
  title = "Language War",
  options: LanguageWarDemoOptions = {}
): LanguageWarSnapshot => {
  const counts = buildDefaultCounts(phase);
  const idleTimeRemainingMs = options.idleTimeRemainingMs ?? 248_000;
  const battleDurationMs = options.battleDurationMs ?? 2 * 60_000;
  const battleTimeRemainingMs = options.battleTimeRemainingMs ?? 108_000;
  const podiumTimeRemainingMs = options.podiumTimeRemainingMs ?? 92_000;
  const effectiveCounts = options.counts ?? counts;

  if (phase === "idle") {
    return {
      phase: "idle",
      standings: [],
      totalMessages: 0,
      timeRemainingMs: idleTimeRemainingMs,
      progressRatio: 0.22,
      roundIndex: 0,
      title,
      eyebrowLabel: "NEXT BATTLE",
      supportLabel: "EVERY MESSAGE COUNTS",
      stateLabel: "STANDBY",
      stateDescription: `Starts in ${formatCompactCountdown(idleTimeRemainingMs)}`,
      timerLabel: `${formatCompactCountdown(idleTimeRemainingMs)} LEFT`,
      showWinnerCrown: false,
    };
  }

  const standings = buildStandings(
    effectiveCounts,
    phase === "battle" ? "live" : "frozen"
  );
  const winner = standings[0];
  const runnerUp = standings[1];
  const totalMessages = effectiveCounts.reduce((sum, value) => sum + value, 0);

  if (phase === "battle") {
    return {
      phase: "battle",
      standings,
      totalMessages,
      timeRemainingMs: battleTimeRemainingMs,
      progressRatio:
        battleDurationMs > 0
          ? Math.min(
              1,
              Math.max(0, 1 - battleTimeRemainingMs / battleDurationMs)
            )
          : 0,
      roundIndex: 3,
      title,
      eyebrowLabel: "LIVE ROUND 03",
      supportLabel: "MOST MESSAGES WINS",
      stateLabel:
        runnerUp && winner.share - runnerUp.share <= 0.05
          ? "CLOSE BATTLE"
          : `${winner.code} LEADS`,
      stateDescription: runnerUp
        ? `${winner.code} ${Math.round(winner.share * 100)}% vs ${Math.round(
            runnerUp.share * 100
          )}% ${runnerUp.code}`
        : `${winner.code} ${Math.round(winner.share * 100)}% · ${winner.count} msgs`,
      timerLabel: `${formatCompactCountdown(battleTimeRemainingMs)} LEFT`,
      winner: {
        code: winner.code,
        count: winner.count,
        share: winner.share,
        color: winner.color,
      },
      showWinnerCrown: false,
      surge: {
        code: "FR",
        delta: 12,
        windowMs: 30_000,
      },
    };
  }

  if (phase === "resolution") {
    return {
      phase: "resolution",
      standings,
      totalMessages,
      timeRemainingMs: 4_000,
      progressRatio: 1,
      roundIndex: 3,
      title,
      eyebrowLabel: "ROUND OVER",
      supportLabel: "WINNER",
      stateLabel: `${winner.code} WINS`,
      stateDescription: `${winner.count} messages · ${Math.round(
        winner.share * 100
      )}% of chat`,
      timerLabel: "WINNER",
      winner: {
        code: winner.code,
        count: winner.count,
        share: winner.share,
        color: winner.color,
      },
      showWinnerCrown: true,
    };
  }

  return {
    phase: "podium",
    standings,
    totalMessages,
    timeRemainingMs: podiumTimeRemainingMs,
    progressRatio: 0.45,
    roundIndex: 3,
    title,
    eyebrowLabel: "NEXT BATTLE",
    supportLabel: "",
    stateLabel: formatCompactCountdown(podiumTimeRemainingMs),
    stateDescription: `${resolveLanguageWarName(winner.code)} won last round`,
    timerLabel: `${formatCompactCountdown(podiumTimeRemainingMs)} LEFT`,
    winner: {
      code: winner.code,
      count: winner.count,
      share: winner.share,
      color: winner.color,
    },
    showWinnerCrown: true,
  };
};

export const LANGUAGE_WAR_PREVIEW_PHASES: readonly LanguageWarPhase[] = [
  "idle",
  "battle",
  "resolution",
  "podium",
];

export const getLanguageWarPreviewPhaseLabel = (phase: LanguageWarPhase) => {
  if (phase === "idle") return "Idle";
  if (phase === "battle") return "Battle";
  if (phase === "resolution") return "Resolution";
  return "Podium";
};
