"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiliciaClient, PublicChatMessage } from "ai_licia-client";
import {
  DEFAULT_CONTEXT_INTERVAL,
  OverlaySettings,
  RankKey,
  normalizeBaseUrl,
} from "@/lib/overlay";
import type { LeaderboardEntry, StreamStatus } from "./types";

const RANKS: RankKey[] = ["rank1", "rank2", "rank3"];
const ROLLING_WINDOW_MS = 60_000;
const MIN_SAMPLE_MS = 1_000;
const RATE_REFRESH_INTERVAL_MS = 1_000;

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
}

const toKey = (username: string) => username.toLowerCase();

export const useLeaderboardStream = ({
  settings,
  disabled = false,
  initialLeaders,
  onStatusChange,
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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const readerRef = useRef<{ cancel: () => Promise<void> } | null>(null);
  const topChatterRef = useRef<string | null>(null);
  const clientRef = useRef<AiliciaClient | null>(null);
  const lastContextSyncRef = useRef(0);
  const contextInFlightRef = useRef(false);
  const rateRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasCredentials = Boolean(settings.apiKey && settings.channelName);
  const streamingEnabled = hasCredentials && !disabled;

  const emitStatus = useCallback(
    (nextStatus: StreamStatus, info: string) => {
      setStatus(nextStatus);
      setStatusMessage(info);
      onStatusChange?.(nextStatus, info);
    },
    [onStatusChange]
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

  useEffect(() => {
    if (!disabled || !initialLeaders) return;
    setLeaders(initialLeaders);
  }, [disabled, initialLeaders]);

  useEffect(() => {
    if (!hasCredentials) {
      countsRef.current.clear();
      setLeaders([]);
      emitStatus(
        "idle",
        "Add your ai_licia® API key and channel to preview live chat."
      );
      return;
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
  ]);

  useEffect(() => {
    if (!streamingEnabled) {
      if (disabled && initialLeaders) {
        setLeaders(initialLeaders);
      }
      return;
    }

    countsRef.current.clear();
    setLeaders([]);
    topChatterRef.current = null;

    const normalizedBase = normalizeBaseUrl(settings.baseUrl);
    const params = new URLSearchParams();
    settings.roles.forEach((role) => params.append("roles", role));
    const url = `${normalizedBase}/events/chat/messages/stream${
      params.size ? `?${params}` : ""
    }`;

    const controller = new AbortController();
    const decoder = new TextDecoder();
    let buffer = "";
    let reconnecting = false;
    let stopped = false;

    const cleanupReader = () => {
      readerRef.current
        ?.cancel()
        .catch(() => {
          /* noop */
        })
        .finally(() => {
          readerRef.current = null;
        });
    };

    const scheduleReconnect = () => {
      if (reconnecting || stopped) return;
      reconnecting = true;
      emitStatus("error", "Connection lost. Retrying…");
      reconnectTimerRef.current = setTimeout(() => {
        reconnecting = false;
        connect();
      }, 4000);
    };

    const handleChunk = (chunk: string) => {
      buffer += chunk;
      let boundary = buffer.indexOf("\n\n");

      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");

        const trimmed = rawEvent.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;

        const dataLines: string[] = [];
        trimmed.split("\n").forEach((line) => {
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        });

        if (!dataLines.length) continue;

        try {
          const payload = JSON.parse(dataLines.join("\n")) as PublicChatMessage;
          processEvent(payload);
        } catch (error) {
          console.warn("Failed to parse SSE payload", error);
        }
      }
    };

    const processEvent = (payload: PublicChatMessage) => {
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
    };

    const connect = async () => {
      try {
        emitStatus("connecting", "Connecting to ai_licia® chat stream…");
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${settings.apiKey}` },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        emitStatus("connected", "Live and listening");
        const reader = response.body.getReader();
        readerRef.current = reader;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            handleChunk(decoder.decode(value, { stream: true }));
          }
        }

        if (!stopped) {
          emitStatus("error", "Stream ended. Reconnecting…");
          scheduleReconnect();
        }
      } catch (error) {
        if (controller.signal.aborted || stopped) {
          return;
        }
        console.warn("Stream error", error);
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      stopped = true;
      cleanupReader();
      controller.abort();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [
    streamingEnabled,
    disabled,
    initialLeaders,
    settings.baseUrl,
    settings.roles,
    settings.apiKey,
    emitStatus,
    snapshotLeaderboard,
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

    client
      .sendEvent(`Top chatters update: ${summary}`)
      .catch((error) => console.warn("Failed to sync leaderboard", error))
      .finally(() => {
        contextInFlightRef.current = false;
        lastContextSyncRef.current = Date.now();
      });
  }, [disabled, leaders, settings.contextIntervalMs]);

  useEffect(() => {
    if (disabled || !leaders.length) return;
    const client = clientRef.current;
    if (!client) return;

    const newLeader = leaders[0]?.username;
    const previousLeader = topChatterRef.current;
    if (!newLeader) return;

    if (previousLeader && previousLeader !== newLeader) {
      client
        .triggerGeneration(
          `${newLeader} just claimed the top chatter spot with ${leaders[0].count} messages!`
        )
        .catch((error) =>
          console.warn("Failed to trigger promotion generation", error)
        );
    }

    topChatterRef.current = newLeader;
  }, [disabled, leaders]);

  const totalRate = useMemo(
    () => leaders.reduce((sum, entry) => sum + (entry.messagesPerMinute ?? 0), 0),
    [leaders]
  );

  return { leaders, status, statusMessage, totalRate };
};
