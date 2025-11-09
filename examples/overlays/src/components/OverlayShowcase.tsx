'use client';

import { useEffect, useMemo, useState } from "react";
import OverlayView from "./overlay/OverlayView";
import {
  DEFAULT_BASE_URL,
  DEFAULT_CONTEXT_INTERVAL,
  DEFAULT_THEME,
  OverlaySettings,
  OverlayLayout,
  ROLE_OPTIONS,
  DEFAULT_PULSE_GLOW,
} from "@/lib/overlay";
import styles from "./OverlayShowcase.module.css";

type DemoEntry = {
  username: string;
  role?: string;
  count: number;
  rate: number;
  firstSeenAt: number;
};

const initialDemoData: DemoEntry[] = [
  {
    username: "Youbarbapapa",
    role: "Viewer",
    count: 97,
    rate: 2,
    firstSeenAt: Date.now() - 120000,
  },
  {
    username: "Jellabn",
    role: "Streamer",
    count: 96,
    rate: 4,
    firstSeenAt: Date.now() - 90000,
  },
  {
    username: "FunFamilyGaming",
    role: "VIP",
    count: 85,
    rate: 3,
    firstSeenAt: Date.now() - 150000,
  },
];

interface OverlayShowcaseProps {
  variant?: "leaderboard" | "message-rate";
  caption?: string;
  className?: string;
  compact?: boolean;
  showCaption?: boolean;
  layoutOverride?: OverlayLayout;
}

const baseSettings: OverlaySettings = {
  apiKey: "demo-preview",
  channelName: "demo_channel",
  baseUrl: DEFAULT_BASE_URL,
  roles: ROLE_OPTIONS,
  excludedUsernames: [],
  contextIntervalMs: DEFAULT_CONTEXT_INTERVAL,
  theme: DEFAULT_THEME,
  customGradients: {},
  layout: "horizontal",
  showRates: true,
  showTotalRateCard: false,
  pulseGlow: { ...DEFAULT_PULSE_GLOW, minRate: 8, maxRate: 25 },
};

const messageRateEntries: DemoEntry[] = [
  {
    username: "Catalyst",
    role: "VIP",
    count: 54,
    rate: 2.6,
    firstSeenAt: Date.now() - 110000,
  },
  {
    username: "NeonNova",
    role: "Viewer",
    count: 48,
    rate: 2.1,
    firstSeenAt: Date.now() - 120000,
  },
  {
    username: "ModSquad",
    role: "Mod",
    count: 42,
    rate: 1.9,
    firstSeenAt: Date.now() - 90000,
  },
];

const OverlayShowcase = ({
  variant = "leaderboard",
  caption,
  className,
  compact,
  showCaption = true,
  layoutOverride,
}: OverlayShowcaseProps) => {
  const [demoEntries, setDemoEntries] = useState<DemoEntry[]>(() =>
    (variant === "leaderboard" ? initialDemoData : messageRateEntries).map(
      (entry) => ({ ...entry })
    )
  );

  useEffect(() => {
    let tick = 0;
    const intervalMs = 4000;
    const timer = setInterval(() => {
      tick += 1;
      setDemoEntries((prev) =>
        prev
          .map((entry) => {
            const inPromoWindow = variant === "message-rate" && tick > 2;
            const rateJitter =
              variant === "message-rate" ? (Math.random() - 0.5) * 0.4 : 0;
            const baseRate = inPromoWindow ? entry.rate + 0.6 : entry.rate;
            const nextRate = Math.max(
              0.3,
              Math.min(inPromoWindow ? 6 : 3.5, baseRate + rateJitter)
            );
            const nextCount = entry.count + nextRate * (intervalMs / 60000);
            return { ...entry, rate: nextRate, count: nextCount };
          })
          .sort((a, b) => b.count - a.count)
      );
    }, intervalMs);

    return () => clearInterval(timer);
  }, [variant]);

  const leaders = useMemo(
    () =>
      demoEntries.slice(0, 3).map((entry) => ({
        username: entry.username,
        role: entry.role,
        count: Math.round(entry.count),
        firstSeenAt: entry.firstSeenAt,
        messagesPerMinute: entry.rate,
      })),
    [demoEntries]
  );

  const mode = variant === "message-rate" ? "total-rate" : "full";
  const settings = useMemo(() => {
    const layout =
      layoutOverride ??
      (variant === "message-rate" ? "vertical" : ("horizontal" as OverlayLayout));
    return {
      ...baseSettings,
      layout,
      showTotalRateCard: variant === "message-rate",
    };
  }, [layoutOverride, variant]);

  const wrapperClass = [
    styles.wrapper,
    compact ? styles.compact : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const fallbackCaption =
    variant === "message-rate"
      ? "Example signal - stream pulsing at 6.6 msg/min across the card."
      : "Example data - top three adjust dynamically with your audience.";

  return (
    <div className={wrapperClass}>
      <OverlayView
        settings={settings}
        variant="preview"
        disableStream
        initialLeaders={leaders}
        showPlaceholders={false}
        mode={mode}
      />
      {showCaption && (
        <p className={styles.caption}>{caption ?? fallbackCaption}</p>
      )}
    </div>
  );
};

export default OverlayShowcase;
