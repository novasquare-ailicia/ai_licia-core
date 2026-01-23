'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import OverlayView from "./OverlayView";
import {
  DEFAULT_BASE_URL,
  DEFAULT_BRAND_GRADIENT,
  DEFAULT_CONTEXT_INTERVAL,
  DEFAULT_OVERLAY_OPACITY,
  DEFAULT_OVERTAKE_NOTIFICATION_INTERVAL_MS,
  DEFAULT_OVERTAKE_NOTIFICATIONS_ENABLED,
  DEFAULT_PULSE_GLOW,
  DEFAULT_THEME,
  OverlayLayout,
  OverlaySettings,
  ROLE_OPTIONS,
} from "@/lib/overlay";
import type { LeaderboardEntry } from "./types";
import styles from "./OverlayDemoWall.module.css";

type SimulatedEntry = LeaderboardEntry & { active: boolean };

const PARTICIPANTS: Array<Pick<LeaderboardEntry, "username" | "role">> = [
  { username: "Jellabn", role: "Streamer" },
  { username: "DasheryFails", role: "Mod" },
  { username: "FunFamilyGaming", role: "VIP" },
  { username: "Youbarbapapa", role: "Viewer" },
  { username: "NeonNova", role: "VIP" },
  { username: "PixelPilot", role: "Viewer" },
  { username: "GlitchGoddess", role: "Mod" },
  { username: "QuantumQuokka", role: "Viewer" },
  { username: "EchoBlade", role: "AI" },
  { username: "SolarSling", role: "Streamer" },
  { username: "MythicMara", role: "VIP" },
  { username: "SyntaxSage", role: "Mod" },
  { username: "VibeRaider", role: "Viewer" },
  { username: "KoiNebula", role: "Viewer" },
];

const buildBaseSettings = (layout: OverlayLayout, compact: boolean, theme = DEFAULT_THEME): OverlaySettings => ({
  apiKey: "demo-only",
  channelName: "overlay_demo",
  baseUrl: DEFAULT_BASE_URL,
  roles: ROLE_OPTIONS,
  excludedUsernames: [],
  contextIntervalMs: DEFAULT_CONTEXT_INTERVAL,
  overtakeNotificationsEnabled: DEFAULT_OVERTAKE_NOTIFICATIONS_ENABLED,
  overtakeNotificationIntervalMs: DEFAULT_OVERTAKE_NOTIFICATION_INTERVAL_MS,
  theme,
  customGradients: {},
  brandGradient: DEFAULT_BRAND_GRADIENT,
  layout,
  compact,
  showRates: true,
  showTotalRateCard: false,
  pulseGlow: { ...DEFAULT_PULSE_GLOW, minRate: 6, maxRate: 140 },
  overlayOpacity: 1,
});

const seedEntries = (): SimulatedEntry[] => {
  const now = Date.now();
  return PARTICIPANTS.map((participant, index) => ({
    ...participant,
    count: 0,
    firstSeenAt: now - index * 3500,
    messagesPerMinute: 0,
    active: false,
  }));
};

const useSimulatedLeaders = () => {
  const [entries, setEntries] = useState<SimulatedEntry[]>(() => seedEntries());
  const tickRef = useRef(0);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("overlay-mode");
    document.documentElement.classList.add("overlay-mode");
    return () => {
      document.body.classList.remove("overlay-mode");
      document.documentElement.classList.remove("overlay-mode");
    };
  }, []);

  useEffect(() => {
    const intervalMs = 850;
    const timer = setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;
      setEntries((prev) => {
        if (!prev.length) return prev;

        const activeCount = Math.min(prev.length, Math.max(2, Math.floor(tick / 2)));
        const order = [...prev.keys()].sort(() => Math.random() - 0.5);
        const activeIndices = new Set(order.slice(0, activeCount));
        const heat = Math.min(1, tick / 22);
        const activePool = order.slice(0, Math.max(1, Math.floor(order.length * 0.6)));
        const surgeIndex = activePool[Math.floor(Math.random() * activePool.length)];
        const shakeUp = Math.random() < 0.32;
        const easterEggSet = new Set(["jellabn", "dasheryfails", "funfamilygaming", "youbarbapapa"]);

        return prev.map((entry, index) => {
          const wasActive = entry.active;
          const active = activeIndices.has(index);
          const currentRate = entry.messagesPerMinute ?? 0;
          const baseline = active
            ? currentRate * 0.55 +
              3 +
              heat * 14 +
              Math.random() * 6 +
              Math.random() * (activeCount * 0.35)
            : Math.max(0.25, currentRate * 0.5);
          const isEasterEgg = easterEggSet.has(entry.username.toLowerCase());
          const burst =
            active && (surgeIndex === index || shakeUp || isEasterEgg)
              ? 10 + heat * 38 + Math.random() * 14 + (isEasterEgg ? 12 : 0)
              : 0;
          const nextRate = active
            ? Math.min(200, baseline + burst)
            : baseline;

          const growth = active
            ? (nextRate * (intervalMs / 60000)) * (1 + heat * 1.1 + Math.random() * 0.8)
            : 0;
          const decayedCount = wasActive && !active ? entry.count * 0.86 : entry.count;
          const nextCount = active ? decayedCount + growth : decayedCount * 0.94;

          return {
            ...entry,
            active,
            messagesPerMinute: nextRate,
            count: nextCount,
          };
        });
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, []);

  const leaders = useMemo(() => {
    const ranked = [...entries]
      .filter((entry) => entry.active || entry.count > 1)
      .sort((a, b) => {
        if (b.count === a.count) {
          return (b.messagesPerMinute ?? 0) - (a.messagesPerMinute ?? 0);
        }
        return b.count - a.count;
      })
      .slice(0, 3);

    return ranked.map((entry) => ({
      username: entry.username,
      role: entry.role,
      count: Math.max(1, Math.round(entry.count)),
      firstSeenAt: entry.firstSeenAt,
      messagesPerMinute: Number((entry.messagesPerMinute ?? 0).toFixed(1)),
    }));
  }, [entries]);

  return { leaders };
};

const OverlayDemoWall = () => {
  const { leaders } = useSimulatedLeaders();

  const verticalFull = useMemo(
    () => ({
      ...buildBaseSettings("vertical", false, "aurora"),
      showTotalRateCard: true,
    }),
    []
  );
  const horizontalFull = useMemo(
    () => ({
      ...buildBaseSettings("horizontal", false, "ember"),
      showTotalRateCard: true,
    }),
    []
  );
  const verticalCompact = useMemo(
    () => buildBaseSettings("vertical", true, "lumen"),
    []
  );
  const horizontalCompact = useMemo(
    () => buildBaseSettings("horizontal", true, "aurora"),
    []
  );
  const messageRate = useMemo(
    () => ({
      ...buildBaseSettings("vertical", false, "ember"),
      showTotalRateCard: true,
      pulseGlow: { ...DEFAULT_PULSE_GLOW, minRate: 8, maxRate: 160, color: "#ff5f6d" },
    }),
    []
  );

  return (
    <div className={styles.page}>
      <div className={styles.canvas}>
        <div className={styles.row}>
          <div className={styles.label}>Full leaderboard · vertical</div>
          <div className={styles.overlayFrame}>
            <OverlayView
              settings={verticalFull}
              variant="preview"
              disableStream
              initialLeaders={leaders}
              showPlaceholders={false}
            />
          </div>
        </div>

        <div className={`${styles.row} ${styles.dual}`}>
          <div>
            <div className={styles.label}>Full leaderboard · horizontal</div>
            <div className={styles.overlayFrame}>
              <OverlayView
                settings={horizontalFull}
                variant="preview"
                disableStream
                initialLeaders={leaders}
                showPlaceholders={false}
              />
            </div>
          </div>

          <div>
            <div className={styles.label}>Message rate · pulse only</div>
            <div className={styles.overlayFrame}>
              <OverlayView
                settings={messageRate}
                variant="preview"
                disableStream
                initialLeaders={leaders}
                showPlaceholders={false}
                mode="total-rate"
              />
            </div>
          </div>
        </div>

        <div className={`${styles.row} ${styles.dual}`}>
          <div>
            <div className={styles.label}>Compact leaderboard · vertical</div>
            <div className={styles.overlayFrame}>
              <OverlayView
                settings={verticalCompact}
                variant="preview"
                disableStream
                initialLeaders={leaders}
                showPlaceholders={false}
              />
            </div>
          </div>

          <div>
            <div className={styles.label}>Compact leaderboard · horizontal</div>
            <div className={styles.overlayFrame}>
              <OverlayView
                settings={horizontalCompact}
                variant="preview"
                disableStream
                initialLeaders={leaders}
                showPlaceholders={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverlayDemoWall;
