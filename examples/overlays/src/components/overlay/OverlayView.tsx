'use client';

import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PublicChatMessage } from "ai_licia-client";
import { AiliciaClient } from "ai_licia-client";
import {
  DEFAULT_CONTEXT_INTERVAL,
  OverlaySettings,
  DEFAULT_THEME,
  THEME_PRESETS,
  RankKey,
  normalizeBaseUrl,
  DEFAULT_LAYOUT,
  DEFAULT_SHOW_RATES,
  DEFAULT_SHOW_TOTAL_RATE,
} from "@/lib/overlay";
import styles from "./OverlayView.module.css";

type LeaderboardEntry = {
  username: string;
  count: number;
  role?: string;
  firstSeenAt: number;
  messagesPerMinute?: number;
};

type StreamStatus = "idle" | "connecting" | "connected" | "error";
type OverlayMode = "full" | "total-rate";

interface OverlayViewProps {
  settings: OverlaySettings;
  variant?: "standalone" | "preview";
  disableStream?: boolean;
  initialLeaders?: LeaderboardEntry[];
  onStatusChange?: (status: StreamStatus, info: string) => void;
  showPlaceholders?: boolean;
  mode?: OverlayMode;
}

export const OverlayView = ({
  settings,
  variant = "standalone",
  disableStream = false,
  initialLeaders,
  onStatusChange,
  showPlaceholders,
  mode = "full",
}: OverlayViewProps) => {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>(
    initialLeaders ?? []
  );
  const countsRef = useRef<Map<string, LeaderboardEntry>>(new Map());
  const excludedRef = useRef<Set<string>>(new Set());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<{ cancel: () => Promise<void> } | null>(null);
  const topChatterRef = useRef<string | null>(null);
  const lastContextSyncRef = useRef(0);
  const contextInFlightRef = useRef(false);

  const clientRef = useRef<AiliciaClient | null>(null);

  const hasCredentials =
    !disableStream && Boolean(settings.apiKey && settings.channelName);
  const themePreset =
    THEME_PRESETS[settings.theme] ?? THEME_PRESETS[DEFAULT_THEME];
  const layout = settings.layout ?? DEFAULT_LAYOUT;
  const showRates = settings.showRates ?? DEFAULT_SHOW_RATES;
  const showTotalRateCard =
    mode === "total-rate"
      ? true
      : settings.showTotalRateCard ?? DEFAULT_SHOW_TOTAL_RATE;
  const renderCards = mode === "full";

  const gradientVar = (rank: RankKey) => {
    const gradient = settings.customGradients[rank] ?? themePreset.gradients[rank];
    return `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`;
  };

  const styleVars = {
    "--overlay-bg": themePreset.overlayBg,
    "--overlay-border": themePreset.borderColor,
    "--card-bg": themePreset.cardBg,
    "--card-border": themePreset.borderColor,
    "--status-bg": themePreset.statusBg,
    "--footer-border": themePreset.footerBorder,
    "--gradient-rank1": gradientVar("rank1"),
    "--gradient-rank2": gradientVar("rank2"),
    "--gradient-rank3": gradientVar("rank3"),
  } as CSSProperties;

  const emitStatus = useCallback(
    (status: StreamStatus, info: string) => {
      onStatusChange?.(status, info);
    },
    [onStatusChange]
  );

  useEffect(() => {
    if (!hasCredentials) {
      emitStatus(
        "idle",
        "Add your ai_licia® API key and channel to preview live chat."
      );
    }
  }, [hasCredentials, emitStatus]);

  useEffect(() => {
    if (disableStream && initialLeaders) {
      setLeaders(initialLeaders);
    }
  }, [disableStream, initialLeaders]);

  useEffect(() => {
    if (!hasCredentials) {
      clientRef.current = null;
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
  }, [hasCredentials, settings.apiKey, settings.channelName, settings.baseUrl]);

  useEffect(() => {
    excludedRef.current = new Set(
      settings.excludedUsernames.map((name) => name.toLowerCase())
    );
    const snapshot = Array.from(countsRef.current.values())
      .filter((entry) => !excludedRef.current.has(entry.username.toLowerCase()))
      .sort((a, b) => {
        if (b.count === a.count) {
          return a.username.localeCompare(b.username);
        }
        return b.count - a.count;
      })
      .slice(0, 3);
    setLeaders(snapshot);
  }, [settings.excludedUsernames]);

  const updateLeaderboard = useCallback(() => {
    const now = Date.now();
    const snapshot = Array.from(countsRef.current.values())
      .filter((entry) => !excludedRef.current.has(entry.username.toLowerCase()))
      .map((entry) => {
        const minutes = Math.max(1 / 60, (now - entry.firstSeenAt) / 60000);
        const rate = entry.count / minutes;
        entry.messagesPerMinute = rate;
        return { ...entry };
      })
      .sort((a, b) => {
        if (b.count === a.count) {
          return a.username.localeCompare(b.username);
        }
        return b.count - a.count;
      })
      .slice(0, 3);
    setLeaders(snapshot);
  }, []);

  const processEvent = useCallback(
    (payload: PublicChatMessage) => {
      if (!payload?.username) return;
      const key = payload.username.toLowerCase();
      const current =
        countsRef.current.get(key) ?? {
          username: payload.username,
          count: 0,
          role: payload.role,
          firstSeenAt: Date.now(),
        };
      current.count += 1;
      current.role = payload.role ?? current.role;
      countsRef.current.set(key, current);
      updateLeaderboard();
    },
    [updateLeaderboard]
  );

  useEffect(() => {
    if (disableStream) {
      return;
    }

    countsRef.current.clear();
    setLeaders([]);
    topChatterRef.current = null;

    if (!hasCredentials) {
      return;
    }

    const normalizedBase = normalizeBaseUrl(settings.baseUrl);
    const params = new URLSearchParams();
    settings.roles.forEach((role) => params.append("roles", role));
    const url = `${normalizedBase}/events/chat/messages/stream${
      params.toString() ? `?${params}` : ""
    }`;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const decoder = new TextDecoder();

    let buffer = "";
    let reconnecting = false;
    let stopped = false;

    const cleanupReader = () => {
      readerRef.current
        ?.cancel()
        .catch(() => {
          /* ignore */
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
        if (!trimmed || trimmed.startsWith(":")) {
          continue;
        }

        const lines = trimmed.split("\n");
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (!dataLines.length) continue;

        try {
          const payload = JSON.parse(dataLines.join("\n")) as PublicChatMessage;
          processEvent(payload);
        } catch (error) {
          console.warn("Failed to parse SSE payload", error);
        }
      }
    };

    const connect = async () => {
      try {
        emitStatus("connecting", "Connecting to ai_licia® chat stream…");
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${settings.apiKey}`,
          },
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
          if (done) {
            break;
          }
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
      }
    };
  }, [
    disableStream,
    hasCredentials,
    processEvent,
    settings.apiKey,
    settings.baseUrl,
    settings.roles,
    settings.channelName,
    emitStatus,
  ]);

  useEffect(() => {
    if (disableStream || !leaders.length) return;
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
  }, [disableStream, leaders, settings.contextIntervalMs]);

  useEffect(() => {
    if (disableStream || !leaders.length) return;
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
  }, [disableStream, leaders]);

  const wrapperClass =
    variant === "preview" ? styles.previewWrapper : styles.fullWrapper;

  const placeholderCards = useMemo<LeaderboardEntry[]>(() => {
    const now = Date.now();
    return [
      {
        username: "waiting on activity",
        role: "configure your api",
        count: 12,
        firstSeenAt: now,
        messagesPerMinute: 0.5,
      },
      {
        username: "top chatter slot",
        role: "stays ready",
        count: 10,
        firstSeenAt: now,
        messagesPerMinute: 0.4,
      },
      {
        username: "third place glow",
        role: "warming up",
        count: 6,
        firstSeenAt: now,
        messagesPerMinute: 0.3,
      },
    ];
  }, []);

  const placeholdersActive =
    renderCards &&
    (showPlaceholders ?? variant !== "standalone") &&
    leaders.length === 0;
  const dataSource = renderCards
    ? placeholdersActive
      ? placeholderCards
      : leaders
    : leaders;

  const maxCount = useMemo(
    () =>
      dataSource.length
        ? Math.max(...dataSource.map((entry) => entry.count || 0), 1)
        : 1,
    [dataSource]
  );

  const totalRate = dataSource.reduce(
    (sum, entry) => sum + (entry.messagesPerMinute ?? 0),
    0
  );

  const cardSlots = useMemo(() => {
    if (!renderCards || !dataSource.length) {
      return [];
    }
    return (["rank1", "rank2", "rank3"] as RankKey[]).map((rank, index) => {
      const entry = dataSource[index];
      if (!entry) {
        return null;
      }
      const progress = maxCount ? entry.count / maxCount : 0;
      const placeholder = placeholdersActive;
      return { entry, rank, placeholder, progress };
    }).filter(Boolean) as Array<{
      entry: LeaderboardEntry;
      rank: RankKey;
      placeholder: boolean;
      progress: number;
    }>;
  }, [dataSource, maxCount, placeholdersActive]);

  const cardsClassName = [
    styles.cards,
    variant === "standalone" ? styles.cardsStandalone : "",
    layout === "vertical" ? styles.cardsVertical : styles.cardsHorizontal,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={`${styles.overlay} ${wrapperClass}`} style={styleVars}>
      {renderCards && cardSlots.length > 0 && (
        <div className={cardsClassName}>
          {cardSlots.map(({ entry, rank, placeholder, progress }, index) => {
            const lift = placeholder ? 18 + index * 4 : (1 - progress) * 24;
            const rate = entry.messagesPerMinute ?? 0;
            return (
              <article
                key={`${rank}-${entry.username}`}
                className={`${styles.card} ${styles[`rank${index + 1}`]} ${
                  placeholder ? styles.placeholderCard : ""
                }`}
                style={{ "--lift": `${lift}px` } as CSSProperties}
              >
                <div className={styles.cardAccent} />
                <div className={styles.cardGlow} />
                <div className={styles.cardSheen} />
                <div className={styles.cardContent}>
                  <span className={styles.rank}>#{index + 1}</span>
                  <div className={styles.identity}>
                    <span className={styles.username}>{entry.username}</span>
                    {entry.role && (
                      <span className={styles.role}>{entry.role}</span>
                    )}
                  </div>
                <span className={styles.count}>
                  {placeholder
                    ? "awaiting chat activity"
                    : `${entry.count} message${entry.count === 1 ? "" : "s"}`}
                </span>
                {showRates && (
                  <span className={styles.rate}>
                    ~{rate.toFixed(1)} msg/min
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      )}

      {showTotalRateCard && (
        <div className={styles.totalRateCard}>
          <div className={styles.totalTitle}>total message rate</div>
          <div className={styles.totalValue}>
            {totalRate > 0 ? totalRate.toFixed(1) : "--"}
            <span>msg/min</span>
          </div>
          {totalRate <= 0 && (
            <p className={styles.totalHint}>waiting for chat activity</p>
          )}
        </div>
      )}

      <footer className={styles.footer}>
        <span className={styles.brand}>powered by ai_licia®</span>
      </footer>
    </section>
  );
};

export default OverlayView;
