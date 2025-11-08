'use client';

import { useEffect, useMemo, useState } from "react";
import OverlayView from "./overlay/OverlayView";
import {
  DEFAULT_BASE_URL,
  DEFAULT_CONTEXT_INTERVAL,
  DEFAULT_THEME,
  OverlaySettings,
  ROLE_OPTIONS,
} from "@/lib/overlay";
import styles from "./Configurator.module.css";

type DemoEntry = {
  username: string;
  role?: string;
  count: number;
  rate: number;
  firstSeenAt: number;
};

const demoSettings: OverlaySettings = {
  apiKey: "",
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
};

const initialDemoData: DemoEntry[] = [
  { username: "Youbarbapapa", role: "Viewer", count: 97, rate: 2, firstSeenAt: Date.now() - 120000 },
  { username: "Jellabn", role: "Streamer", count: 96, rate: 4, firstSeenAt: Date.now() - 90000 },
  { username: "FunFamilyGaming", role: "VIP", count: 85, rate: 3, firstSeenAt: Date.now() - 150000 },
];

const OverlayShowcase = () => {
  const [demoEntries, setDemoEntries] = useState<DemoEntry[]>(initialDemoData);

  useEffect(() => {
    const intervalMs = 4000;
    const timer = setInterval(() => {
      setDemoEntries((prev) =>
        prev
          .map((entry) => ({
            ...entry,
            count: entry.count + entry.rate * (intervalMs / 60000),
          }))
          .sort((a, b) => b.count - a.count)
      );
    }, intervalMs);

    return () => clearInterval(timer);
  }, []);

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

  return (
    <div className={styles.demoSection}>
      <OverlayView
        settings={demoSettings}
        variant="preview"
        disableStream
        initialLeaders={leaders}
        showPlaceholders={false}
      />
      <p className={styles.demoCaption}>
        Example data — Youbarbapapa (97 total · 2 msg/min), Jellabn (96 total · 4 msg/min),
        FunFamilyGaming (85 total · 3 msg/min).
      </p>
    </div>
  );
};

export default OverlayShowcase;
