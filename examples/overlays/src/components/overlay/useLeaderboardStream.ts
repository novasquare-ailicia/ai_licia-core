"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AiliciaClient,
  ChatMessageStream,
  PublicChatMessage,
} from "ai_licia-client";
import {
  DEFAULT_CONTEXT_INTERVAL,
  OverlaySettings,
  RankKey,
} from "@/lib/overlay";
import type { LeaderboardEntry, StreamStatus } from "./types";
import { trackEvent, trackTimedEvent } from "@/lib/analytics";

const RANKS: RankKey[] = ["rank1", "rank2", "rank3"];
const ROLLING_WINDOW_MS = 60_000;
const MIN_SAMPLE_MS = 1_000;
const RATE_REFRESH_INTERVAL_MS = 1_000;
const GENERATION_COOLDOWN_MS = 25_000;

const leaderboardsEqual = (
  next: LeaderboardEntry[],
  prev: LeaderboardEntry[]
) => {
  if (next.length !== prev.length) return false;
  for (let i = 0; i < next.length; i += 1) {
    const a = next[i];
    const b = prev[i];
    if (
      a.username !== b.username ||
      a.count !== b.count ||
      a.role !== b.role ||
      (a.messagesPerMinute ?? 0) !== (b.messagesPerMinute ?? 0)
    ) {
      return false;
    }
  }
  return true;
};

interface LeaderboardHookOptions {
  settings: OverlaySettings;
  disabled?: boolean;
  initialLeaders?: LeaderboardEntry[];
  onStatusChange?: (status: StreamStatus, info: string) => void;
  enableGenerations?: boolean;
}

const toKey = (username: string) => username.toLowerCase();

export const useLeaderboardStream = ({
  settings,
  disabled = false,
  initialLeaders,
  onStatusChange,
  enableGenerations = true,
}: LeaderboardHookOptions) => {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>(
    initialLeaders ?? []
  );
  const [statusMessage, setStatusMessage] = useState(
    "Add your ai_licia® API key and channel to preview live chat."
  );
  const [status, setStatus] = useState<StreamStatus>("idle");

  const countsRef = useRef<Map<string, LeaderboardEntry>>(new Map());
  const excludedRef = useRef<Set<string>>(new Set());
  const topChatterRef = useRef<string | null>(null);
  const clientRef = useRef<AiliciaClient | null>(null);
  const lastContextSyncRef = useRef(0);
  const contextInFlightRef = useRef(false);
  const rateRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamHandleRef = useRef<ChatMessageStream | null>(null);
  const lastGenerationRef = useRef(0);
  const pendingGenerationRef = useRef<string | null>(null);
  const generationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationInFlightRef = useRef(false);

  const hasCredentials = Boolean(settings.apiKey && settings.channelName);
  const streamingEnabled = hasCredentials && !disabled;

  const emitStatus = useCallback(
    (nextStatus: StreamStatus, info: string) => {
      setStatus(nextStatus);
      setStatusMessage(info);
      onStatusChange?.(nextStatus, info);
      trackEvent("overlay_connection_status", {
        status: nextStatus,
        info,
        hasCredentials,
        disabled,
      });
    },
    [onStatusChange, hasCredentials, disabled]
  );
  const queueStatusUpdate = useCallback(
    (nextStatus: StreamStatus, info: string) =>
      requestAnimationFrame(() => emitStatus(nextStatus, info)),
    [emitStatus]
  );

  const snapshotLeaderboard = useCallback(() => {
    const now = Date.now();
    const windowStart = now - ROLLING_WINDOW_MS;
    const snapshot = Array.from(countsRef.current.entries())
      .map(([key, entry]) => {
        const normalizedKey = entry.username.toLowerCase();
        if (excludedRef.current.has(normalizedKey)) {
          return null;
        }

        const existing = entry.recentMessages ?? [];
        const recent = existing.filter((timestamp) => timestamp >= windowStart);

        if (recent.length !== existing.length) {
          countsRef.current.set(key, { ...entry, recentMessages: recent });
        }

        const updatedEntry = countsRef.current.get(key)!;
        const spanMs = Math.min(
          ROLLING_WINDOW_MS,
          Math.max(now - (recent[0] ?? now), MIN_SAMPLE_MS)
        );
        const messagesPerMinute = (recent.length / spanMs) * 60_000;

        return {
          ...updatedEntry,
          messagesPerMinute,
        };
      })
      .filter(
        (
          entry
        ): entry is LeaderboardEntry & { messagesPerMinute: number } =>
          Boolean(entry)
      )
      .sort((a, b) => {
        if (b.count === a.count) {
          return a.username.localeCompare(b.username);
        }
        return b.count - a.count;
      })
      .slice(0, RANKS.length);

    setLeaders((prev) =>
      leaderboardsEqual(snapshot, prev) ? prev : snapshot
    );
    return snapshot;
  }, []);

  useEffect(() => {
    excludedRef.current = new Set(
      settings.excludedUsernames.map((name) => name.toLowerCase())
    );
    snapshotLeaderboard();
  }, [settings.excludedUsernames, snapshotLeaderboard]);

  const handleIncomingMessage = useCallback(
    (payload: PublicChatMessage) => {
      if (!payload?.username) return;
      const now = Date.now();
      const key = toKey(payload.username);
      const current =
        countsRef.current.get(key) ?? {
          username: payload.username,
          count: 0,
          role: payload.role,
          firstSeenAt: now,
          recentMessages: [],
        };
      current.count += 1;
      current.role = payload.role ?? current.role;
      current.recentMessages = current.recentMessages ?? [];
      current.recentMessages.push(now);
      while (
        current.recentMessages.length &&
        now - (current.recentMessages[0] ?? 0) > ROLLING_WINDOW_MS
      ) {
        current.recentMessages.shift();
      }
      countsRef.current.set(key, current);
      snapshotLeaderboard();
    },
    [snapshotLeaderboard]
  );

  const processGenerationQueue = useCallback(function processQueue() {
    const client = clientRef.current;
    if (!client) return;
    if (generationInFlightRef.current) return;
    const message = pendingGenerationRef.current;
    if (!message) return;
    const now = Date.now();
    const elapsed = now - lastGenerationRef.current;
    if (elapsed < GENERATION_COOLDOWN_MS) {
      if (!generationTimerRef.current) {
        generationTimerRef.current = setTimeout(() => {
          generationTimerRef.current = null;
          processQueue();
        }, GENERATION_COOLDOWN_MS - elapsed);
      }
      return;
    }
    pendingGenerationRef.current = null;
    generationInFlightRef.current = true;
    client
      .triggerGeneration(message)
      .catch((error) =>
        console.warn("Failed to trigger promotion generation", error)
      )
      .finally(() => {
        lastGenerationRef.current = Date.now();
        generationInFlightRef.current = false;
        processQueue();
      });
  }, []);

  const enqueueGeneration = useCallback(
    (message: string) => {
      pendingGenerationRef.current = message;
      if (generationTimerRef.current === null) {
        processGenerationQueue();
      }
    },
    [processGenerationQueue]
  );

  useEffect(() => {
    if (!disabled || !initialLeaders) return;
    const frame = requestAnimationFrame(() => setLeaders(initialLeaders));
    return () => cancelAnimationFrame(frame);
  }, [disabled, initialLeaders]);

  useEffect(() => {
    if (!hasCredentials) {
      countsRef.current.clear();
      const frameLeaders = requestAnimationFrame(() => setLeaders([]));
      const frameStatus = queueStatusUpdate(
        "idle",
        "Add your ai_licia® API key and channel to preview live chat."
      );
      return () => {
        cancelAnimationFrame(frameLeaders);
        cancelAnimationFrame(frameStatus);
      };
    }

    clientRef.current = new AiliciaClient(
      settings.apiKey,
      settings.channelName,
      settings.baseUrl
    );

    return () => {
      clientRef.current = null;
    };
  }, [
    hasCredentials,
    settings.apiKey,
    settings.channelName,
    settings.baseUrl,
    emitStatus,
    queueStatusUpdate,
  ]);

  useEffect(() => {
    if (!streamingEnabled) {
      streamHandleRef.current?.close();
      streamHandleRef.current = null;
      if (disabled && initialLeaders) {
        const frame = requestAnimationFrame(() => setLeaders(initialLeaders));
        return () => cancelAnimationFrame(frame);
      }
      return;
    }

    const client = clientRef.current;
    if (!client) return;

    countsRef.current.clear();
    const resetFrame = requestAnimationFrame(() => setLeaders([]));
    topChatterRef.current = null;

    queueStatusUpdate(
      "connecting",
      "Connecting to ai_licia® chat stream…"
    );

    streamHandleRef.current = client.streamPublicChatMessages({
      roles: settings.roles,
      autoReconnect: true,
      reconnectDelayMs: 4000,
      onMessage: handleIncomingMessage,
      onConnectionStateChange: (state) => {
        if (state === "connecting") {
          queueStatusUpdate(
            "connecting",
            "Connecting to ai_licia® chat stream…"
          );
        } else {
          queueStatusUpdate("connecting", "Reconnecting to ai_licia®…");
        }
      },
      onOpen: () => emitStatus("connected", "Live and listening"),
      onReconnectAttempt: ({ attempt, delayMs }) =>
        queueStatusUpdate(
          "connecting",
          `Reconnecting in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt})`
        ),
      onError: (error) => {
        console.warn("Stream error", error);
        queueStatusUpdate("error", "Connection lost. Retrying…");
      },
      onClose: () => {
        if (!streamingEnabled) {
          queueStatusUpdate(
            "idle",
            "Add your ai_licia® API key and channel to preview live chat."
          );
        }
      },
    });

    return () => {
      cancelAnimationFrame(resetFrame);
      streamHandleRef.current?.close();
      streamHandleRef.current = null;
      if (generationTimerRef.current) {
        clearTimeout(generationTimerRef.current);
        generationTimerRef.current = null;
      }
      pendingGenerationRef.current = null;
      generationInFlightRef.current = false;
    };
  }, [
    streamingEnabled,
    disabled,
    initialLeaders,
    settings.roles,
    settings.baseUrl,
    handleIncomingMessage,
    emitStatus,
    queueStatusUpdate,
  ]);

  useEffect(() => {
    if (!streamingEnabled) {
      if (rateRefreshRef.current) {
        clearInterval(rateRefreshRef.current);
        rateRefreshRef.current = null;
      }
      return;
    }

    rateRefreshRef.current = setInterval(() => {
      snapshotLeaderboard();
    }, RATE_REFRESH_INTERVAL_MS);

    return () => {
      if (rateRefreshRef.current) {
        clearInterval(rateRefreshRef.current);
        rateRefreshRef.current = null;
      }
    };
  }, [streamingEnabled, snapshotLeaderboard]);

  useEffect(() => {
    if (disabled || !leaders.length) return;
    const client = clientRef.current;
    if (!client) return;

    const interval = settings.contextIntervalMs || DEFAULT_CONTEXT_INTERVAL;
    const now = Date.now();
    if (
      now - lastContextSyncRef.current < interval ||
      contextInFlightRef.current
    ) {
      return;
    }

    contextInFlightRef.current = true;
    const summary = leaders
      .map(
        (entry, index) =>
          `#${index + 1} ${entry.username} (${entry.count} msg${
            entry.count === 1 ? "" : "s"
          })`
      )
      .join(" | ")
      .slice(0, 680);

    trackTimedEvent("overlay_context_sync", {
      leaderCount: leaders.length,
      intervalMs: interval,
      hasCredentials,
    });

    client
      .sendEvent(`Top chatters update: ${summary}`)
      .catch((error) => console.warn("Failed to sync leaderboard", error))
      .finally(() => {
        contextInFlightRef.current = false;
        lastContextSyncRef.current = Date.now();
      });
  }, [disabled, leaders, settings.contextIntervalMs, hasCredentials]);

  useEffect(() => {
    if (disabled || !enableGenerations || !leaders.length) return;
    const client = clientRef.current;
    if (!client) return;

    const newLeader = leaders[0]?.username;
    const previousLeader = topChatterRef.current;
    if (!newLeader) return;

    if (previousLeader && previousLeader !== newLeader) {
      const message = `${newLeader} just claimed the top chatter spot with ${leaders[0].count} messages!`;
      trackEvent("overlay_generation_trigger", {
        from: previousLeader,
        to: newLeader,
        count: leaders[0].count,
      });
      enqueueGeneration(message);
    }

    topChatterRef.current = newLeader;
  }, [disabled, enableGenerations, leaders, enqueueGeneration]);

  const totalRate = useMemo(
    () => leaders.reduce((sum, entry) => sum + (entry.messagesPerMinute ?? 0), 0),
    [leaders]
  );

  return { leaders, status, statusMessage, totalRate };
};
