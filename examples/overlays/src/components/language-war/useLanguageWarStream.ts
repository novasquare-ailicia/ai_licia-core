"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  EventSubEventMap,
  EventSubEventType,
  EventSubStream,
} from "ai_licia-client";
import { AiliciaClient } from "ai_licia-client";
import type { StreamStatus } from "@/components/overlay/types";
import {
  formatLanguageWarTimerLabel,
  normalizeLanguageWarCode,
  resolveLanguageWarColor,
  resolveLanguageWarName,
  type LanguageWarOverlaySettings,
  type LanguageWarSurge,
} from "@/lib/languageWarOverlay";
import type {
  LanguageWarPhase,
  LanguageWarSnapshot,
  LanguageWarStanding,
  LanguageWarWinner,
} from "./types";

interface LanguageWarHookOptions {
  settings: LanguageWarOverlaySettings;
  disabled?: boolean;
  onStatusChange?: (status: StreamStatus, info: string) => void;
}

type LanguageMessage = {
  timestamp: number;
  code: string;
};

type BattleMetrics = {
  standings: LanguageWarStanding[];
  totalMessages: number;
  surge?: LanguageWarSurge;
  winner?: LanguageWarWinner;
};

type ResolvedBattle = BattleMetrics & {
  roundIndex: number;
};

const EVENT_TYPES = ["chat.message"] as const satisfies readonly EventSubEventType[];
const TICK_INTERVAL_MS = 250;
const RESOLUTION_DURATION_MS = 2500;

const clampShare = (value: number) => Math.min(1, Math.max(0, value));

const EMPTY_SNAPSHOT: LanguageWarSnapshot = {
  phase: "idle",
  standings: [],
  totalMessages: 0,
  timeRemainingMs: 0,
  progressRatio: 0,
  roundIndex: 0,
  title: "Language War",
  eyebrowLabel: "NEXT BATTLE",
  supportLabel: "EVERY MESSAGE COUNTS",
  stateLabel: "STANDBY",
  stateDescription: "Waiting for the first battle",
  timerLabel: "0:00 LEFT",
  showWinnerCrown: false,
};

const formatCompactCountdown = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatRoundNumber = (roundIndex: number) =>
  String(Math.max(0, roundIndex)).padStart(2, "0");

const describeHeadToHead = (standings: LanguageWarStanding[]) => {
  const [leader, runnerUp] = standings;
  if (!leader) {
    return "First detected language takes the lead";
  }
  if (!runnerUp) {
    return `${leader.code} ${Math.round(leader.share * 100)}% · ${leader.count} msgs`;
  }
  return `${leader.code} ${Math.round(leader.share * 100)}% vs ${Math.round(
    runnerUp.share * 100
  )}% ${runnerUp.code}`;
};

const describeLiveBattleState = (standings: LanguageWarStanding[]) => {
  if (standings.length === 0) {
    return {
      stateLabel: "BATTLE LIVE",
      stateDescription: "First detected language takes the lead",
    };
  }

  const [leader, runnerUp] = standings;
  if (!runnerUp) {
    return {
      stateLabel: `${leader.code} IN CONTROL`,
      stateDescription: describeHeadToHead(standings),
    };
  }

  const leadGap = leader.share - runnerUp.share;
  if (leadGap <= 0.05) {
    return {
      stateLabel: "CLOSE BATTLE",
      stateDescription: describeHeadToHead(standings),
    };
  }

  if (leader.share >= 0.55) {
    return {
      stateLabel: `${leader.code} DOMINATES`,
      stateDescription: describeHeadToHead(standings),
    };
  }

  return {
    stateLabel: `${leader.code} LEADS`,
    stateDescription: describeHeadToHead(standings),
  };
};

const buildStandings = (
  counts: Map<string, number>,
  previousCounts: Map<string, number>,
  maxLanguages: number
) =>
  Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] === a[1]) {
        return a[0].localeCompare(b[0]);
      }
      return b[1] - a[1];
    })
    .slice(0, maxLanguages)
    .map(([code, count], index, source) => {
      const totalMessages = source.reduce((sum, [, value]) => sum + value, 0);
      const previous = previousCounts.get(code) ?? count;
      const delta = count - previous;
      return {
        code,
        count,
        share: totalMessages > 0 ? clampShare(count / totalMessages) : 0,
        delta,
        trend: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
        color: resolveLanguageWarColor(code),
      } satisfies LanguageWarStanding;
    });

const freezeStandings = (standings: LanguageWarStanding[]) =>
  standings.map((standing) => ({
    ...standing,
    delta: 0,
    trend: "flat" as const,
  }));

const buildBattleMetrics = (
  settings: LanguageWarOverlaySettings,
  messages: LanguageMessage[],
  previousCounts: Map<string, number>,
  now: number
): BattleMetrics => {
  const counts = new Map<string, number>();
  messages.forEach((message) => {
    counts.set(message.code, (counts.get(message.code) ?? 0) + 1);
  });

  const totalMessages = Array.from(counts.values()).reduce(
    (sum, value) => sum + value,
    0
  );

  const standings = buildStandings(
    counts,
    previousCounts,
    settings.maxLanguages
  );
  const winner = standings[0]
    ? {
        code: standings[0].code,
        count: standings[0].count,
        share: standings[0].share,
        color: standings[0].color,
      }
    : undefined;

  const surgeCutoff = now - settings.surgeWindowMs;
  const visibleCodes = new Set(standings.map((standing) => standing.code));
  const surgeCounts = new Map<string, number>();
  messages.forEach((message) => {
    if (message.timestamp < surgeCutoff || !visibleCodes.has(message.code)) {
      return;
    }
    surgeCounts.set(message.code, (surgeCounts.get(message.code) ?? 0) + 1);
  });

  let surge: LanguageWarSurge | undefined;
  surgeCounts.forEach((delta, code) => {
    if (!surge || delta > surge.delta) {
      surge = { code, delta, windowMs: settings.surgeWindowMs };
    }
  });

  return {
    standings,
    totalMessages,
    surge,
    winner,
  };
};

const buildIdleSnapshot = (
  settings: LanguageWarOverlaySettings,
  timeRemainingMs: number
): LanguageWarSnapshot => ({
  ...EMPTY_SNAPSHOT,
  phase: "idle",
  title: settings.title,
  timeRemainingMs,
  progressRatio:
    settings.battleIntervalMs > 0
      ? clampShare(1 - timeRemainingMs / settings.battleIntervalMs)
      : 0,
  timerLabel: formatLanguageWarTimerLabel(timeRemainingMs),
  supportLabel: "EVERY MESSAGE COUNTS",
  stateDescription: `Starts in ${formatCompactCountdown(timeRemainingMs)}`,
});

  const buildBattleSnapshot = (
  settings: LanguageWarOverlaySettings,
  roundIndex: number,
  battleStartAt: number,
  now: number,
  metrics: BattleMetrics
): LanguageWarSnapshot => {
  const timeRemainingMs = Math.max(
    0,
    settings.battleDurationMs - (now - battleStartAt)
  );
  const battleState = describeLiveBattleState(metrics.standings);

  return {
    phase: "battle",
    standings: metrics.standings,
    totalMessages: metrics.totalMessages,
    timeRemainingMs,
    progressRatio:
      settings.battleDurationMs > 0
        ? clampShare(1 - timeRemainingMs / settings.battleDurationMs)
        : 0,
    roundIndex,
    title: settings.title,
    eyebrowLabel: `LIVE ROUND ${formatRoundNumber(roundIndex)}`,
    supportLabel: "MOST MESSAGES WINS",
    stateLabel: battleState.stateLabel,
    stateDescription: battleState.stateDescription,
    timerLabel: formatLanguageWarTimerLabel(timeRemainingMs),
    surge: metrics.surge,
    winner: metrics.winner,
    showWinnerCrown: false,
  };
};

const buildResolutionSnapshot = (
  settings: LanguageWarOverlaySettings,
  resolvedBattle: ResolvedBattle,
  timeRemainingMs: number
): LanguageWarSnapshot => {
  const winner = resolvedBattle.winner;
  return {
    phase: "resolution",
    standings: resolvedBattle.standings,
    totalMessages: resolvedBattle.totalMessages,
    timeRemainingMs,
    progressRatio: 1,
    roundIndex: resolvedBattle.roundIndex,
    title: settings.title,
    eyebrowLabel: "ROUND OVER",
    supportLabel: winner ? "WINNER" : "",
    stateLabel: winner ? `${winner.code} WINS` : "NO WINNER",
    stateDescription: winner
      ? `${winner.count} messages · ${Math.round(winner.share * 100)}% of chat`
      : "No detected languages scored this battle",
    timerLabel: "WINNER",
    winner,
    surge: resolvedBattle.surge,
    showWinnerCrown: Boolean(winner),
  };
};

const buildPodiumSnapshot = (
  settings: LanguageWarOverlaySettings,
  resolvedBattle: ResolvedBattle,
  timeRemainingMs: number
): LanguageWarSnapshot => {
  const winner = resolvedBattle.winner;
  const availableWindow = Math.max(
    1,
    settings.battleIntervalMs - settings.battleDurationMs
  );

  return {
    phase: "podium",
    standings: resolvedBattle.standings,
    totalMessages: resolvedBattle.totalMessages,
    timeRemainingMs,
    progressRatio: clampShare(1 - timeRemainingMs / availableWindow),
    roundIndex: resolvedBattle.roundIndex,
    title: settings.title,
    eyebrowLabel: "NEXT BATTLE",
    supportLabel: "",
    stateLabel: formatCompactCountdown(timeRemainingMs),
    stateDescription: winner
      ? `${resolveLanguageWarName(winner.code)} won last round`
      : "Waiting for the next battle to begin",
    timerLabel: formatLanguageWarTimerLabel(timeRemainingMs),
    winner,
    surge: resolvedBattle.surge,
    showWinnerCrown: Boolean(winner),
  };
};

const buildBattleStartGeneration = (
  settings: LanguageWarOverlaySettings
) => {
  const minutes = Math.round(settings.battleDurationMs / 60_000);
  return `Language War begins. Every detected chat message counts for its language. Highest message total wins this ${minutes}-minute battle.`;
};

const buildBattleEndGeneration = (resolvedBattle: ResolvedBattle) => {
  const winner = resolvedBattle.winner;
  if (!winner) {
    return "Language War ended with no detected language winner this round.";
  }
  return `Language War ended. ${winner.code} won round ${formatRoundNumber(
    resolvedBattle.roundIndex
  )} with ${winner.count} messages and ${Math.round(
    winner.share * 100
  )}% of detected chat.`;
};

export const useLanguageWarStream = ({
  settings,
  disabled = false,
  onStatusChange,
}: LanguageWarHookOptions) => {
  const [snapshot, setSnapshot] = useState<LanguageWarSnapshot>({
    ...EMPTY_SNAPSHOT,
    title: settings.title,
    timeRemainingMs: settings.battleIntervalMs,
    timerLabel: formatLanguageWarTimerLabel(settings.battleIntervalMs),
    stateDescription: `Starts in ${formatCompactCountdown(
      settings.battleIntervalMs
    )}`,
  });
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Add your ai_licia API key and channel to start EventSub."
  );

  const phaseRef = useRef<LanguageWarPhase>("idle");
  const mountedAtRef = useRef(0);
  const roundIndexRef = useRef(0);
  const nextBattleStartAtRef = useRef(0);
  const currentBattleStartAtRef = useRef<number | null>(null);
  const currentBattleEndAtRef = useRef<number | null>(null);
  const resolutionEndAtRef = useRef<number | null>(null);
  const messagesRef = useRef<LanguageMessage[]>([]);
  const previousCountsRef = useRef<Map<string, number>>(new Map());
  const resolvedBattleRef = useRef<ResolvedBattle | null>(null);
  const streamRef = useRef<EventSubStream | null>(null);
  const clientRef = useRef<AiliciaClient | null>(null);

  const hasCredentials = useMemo(
    () => Boolean(settings.apiKey && settings.channelName),
    [settings.apiKey, settings.channelName]
  );

  const emitStatus = useCallback(
    (nextStatus: StreamStatus, info: string) => {
      setStatus(nextStatus);
      setStatusMessage(info);
      onStatusChange?.(nextStatus, info);
    },
    [onStatusChange]
  );

  const triggerGeneration = useCallback(
    (message: string) => {
      if (!settings.emitBattleGenerations || disabled) {
        return;
      }
      clientRef.current
        ?.triggerGeneration(message)
        .catch((error) =>
          console.warn("Failed to trigger language war generation", error)
        );
    },
    [disabled, settings.emitBattleGenerations]
  );

  const resetLifecycle = useCallback(
    (startedAt: number) => {
      phaseRef.current = "idle";
      mountedAtRef.current = startedAt;
      roundIndexRef.current = 0;
      nextBattleStartAtRef.current = startedAt + settings.battleIntervalMs;
      currentBattleStartAtRef.current = null;
      currentBattleEndAtRef.current = null;
      resolutionEndAtRef.current = null;
      messagesRef.current = [];
      previousCountsRef.current = new Map();
      resolvedBattleRef.current = null;
      setSnapshot(buildIdleSnapshot(settings, settings.battleIntervalMs));
    },
    [settings]
  );

  const startBattle = useCallback(
    (scheduledStartAt: number) => {
      phaseRef.current = "battle";
      roundIndexRef.current += 1;
      currentBattleStartAtRef.current = scheduledStartAt;
      currentBattleEndAtRef.current = scheduledStartAt + settings.battleDurationMs;
      resolutionEndAtRef.current = null;
      nextBattleStartAtRef.current = scheduledStartAt + settings.battleIntervalMs;
      messagesRef.current = [];
      previousCountsRef.current = new Map();
      resolvedBattleRef.current = null;
      triggerGeneration(buildBattleStartGeneration(settings));
    },
    [settings, triggerGeneration]
  );

  const resolveBattle = useCallback(() => {
    const resolvedAt = currentBattleEndAtRef.current ?? Date.now();
    const metrics = buildBattleMetrics(
      settings,
      messagesRef.current,
      previousCountsRef.current,
      resolvedAt
    );
    const resolvedBattle: ResolvedBattle = {
      roundIndex: roundIndexRef.current,
      standings: freezeStandings(metrics.standings),
      totalMessages: metrics.totalMessages,
      surge: metrics.surge,
      winner: metrics.winner,
    };

    resolvedBattleRef.current = resolvedBattle;
    phaseRef.current = "resolution";
    messagesRef.current = [];
    previousCountsRef.current = new Map();

    const timeUntilNextBattle = Math.max(
      0,
      nextBattleStartAtRef.current - resolvedAt
    );
    resolutionEndAtRef.current =
      resolvedAt + Math.min(RESOLUTION_DURATION_MS, timeUntilNextBattle);

    triggerGeneration(buildBattleEndGeneration(resolvedBattle));
  }, [settings, triggerGeneration]);

  const synchronizeLifecycle = useCallback(
    (now: number) => {
      let changed = false;
      let guard = 0;

      while (guard < 6) {
        guard += 1;

        if (phaseRef.current === "idle") {
          if (now < nextBattleStartAtRef.current) {
            break;
          }
          startBattle(nextBattleStartAtRef.current);
          changed = true;
          continue;
        }

        if (phaseRef.current === "battle") {
          if (
            currentBattleEndAtRef.current !== null &&
            now >= currentBattleEndAtRef.current
          ) {
            resolveBattle();
            changed = true;
            continue;
          }
          break;
        }

        if (phaseRef.current === "resolution") {
          if (
            resolutionEndAtRef.current !== null &&
            now >= resolutionEndAtRef.current
          ) {
            phaseRef.current = "podium";
            changed = true;
            continue;
          }
          break;
        }

        if (now < nextBattleStartAtRef.current) {
          break;
        }
        startBattle(nextBattleStartAtRef.current);
        changed = true;
      }

      return changed;
    },
    [resolveBattle, startBattle]
  );

  const refreshSnapshot = useCallback(() => {
    const now = Date.now();
    synchronizeLifecycle(now);

    if (phaseRef.current === "idle") {
      setSnapshot(
        buildIdleSnapshot(
          settings,
          Math.max(0, nextBattleStartAtRef.current - now)
        )
      );
      return;
    }

    if (phaseRef.current === "battle") {
      const battleStartAt = currentBattleStartAtRef.current ?? now;
      const activeMessages = messagesRef.current.filter(
        (entry) => entry.timestamp >= battleStartAt
      );
      messagesRef.current = activeMessages;

      const metrics = buildBattleMetrics(
        settings,
        activeMessages,
        previousCountsRef.current,
        now
      );
      previousCountsRef.current = new Map(
        metrics.standings.map((standing) => [standing.code, standing.count])
      );

      setSnapshot(
        buildBattleSnapshot(
          settings,
          roundIndexRef.current,
          battleStartAt,
          now,
          metrics
        )
      );
      return;
    }

    const resolvedBattle = resolvedBattleRef.current;
    if (!resolvedBattle) {
      setSnapshot(buildIdleSnapshot(settings, settings.battleIntervalMs));
      return;
    }

    const timeRemainingMs = Math.max(0, nextBattleStartAtRef.current - now);
    setSnapshot(
      phaseRef.current === "resolution"
        ? buildResolutionSnapshot(settings, resolvedBattle, timeRemainingMs)
        : buildPodiumSnapshot(settings, resolvedBattle, timeRemainingMs)
    );
  }, [settings, synchronizeLifecycle]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      resetLifecycle(Date.now());
      refreshSnapshot();
    });
    return () => cancelAnimationFrame(frame);
  }, [
    refreshSnapshot,
    resetLifecycle,
    settings.battleDurationMs,
    settings.battleIntervalMs,
    settings.emitBattleGenerations,
    settings.hideUndetermined,
    settings.maxLanguages,
    settings.surgeWindowMs,
    settings.title,
  ]);

  useEffect(() => {
    if (disabled) {
      const frame = requestAnimationFrame(() =>
        emitStatus("idle", "Preview mode")
      );
      return () => cancelAnimationFrame(frame);
    }

    if (!hasCredentials) {
      const frame = requestAnimationFrame(() =>
        emitStatus("idle", "Add your ai_licia API key and channel to connect.")
      );
      return () => cancelAnimationFrame(frame);
    }

    const connectFrame = requestAnimationFrame(() =>
      emitStatus("connecting", "Connecting to EventSub...")
    );
    const client = new AiliciaClient(
      settings.apiKey,
      settings.channelName,
      settings.baseUrl
    );
    clientRef.current = client;

    const stream = client.streamEventSub(
      { type: "apiKey", key: settings.apiKey },
      {
        types: [...EVENT_TYPES],
        onConnectionStateChange: (connectionState) => {
          if (connectionState === "reconnecting") {
            emitStatus("connecting", "Reconnecting to EventSub...");
            return;
          }
          emitStatus("connecting", "Connecting to EventSub...");
        },
        onOpen: () => emitStatus("connected", "Connected to EventSub"),
        onError: (error) => emitStatus("error", error.message),
        onClose: () => emitStatus("idle", "Disconnected from EventSub"),
      }
    );
    streamRef.current = stream;

    const handleMessage = (event: EventSubEventMap["chat.message"]) => {
      const code = normalizeLanguageWarCode(event.payload.language);
      if (!code) {
        return;
      }
      if (settings.hideUndetermined && code === "UND") {
        return;
      }

      const now = Date.now();
      synchronizeLifecycle(now);
      if (phaseRef.current !== "battle") {
        refreshSnapshot();
        return;
      }

      messagesRef.current.push({ timestamp: now, code });
      refreshSnapshot();
    };

    stream.on("chat.message", handleMessage);

    return () => {
      cancelAnimationFrame(connectFrame);
      stream.off("chat.message", handleMessage);
      stream.close();
      streamRef.current = null;
      clientRef.current = null;
    };
  }, [
    disabled,
    emitStatus,
    hasCredentials,
    refreshSnapshot,
    settings.apiKey,
    settings.baseUrl,
    settings.channelName,
    settings.hideUndetermined,
    synchronizeLifecycle,
  ]);

  useEffect(() => {
    if (disabled) {
      return;
    }
    const timer = setInterval(() => {
      refreshSnapshot();
    }, TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [disabled, refreshSnapshot]);

  return {
    snapshot,
    status,
    statusMessage,
  };
};
