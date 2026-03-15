"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LANGUAGE_WAR_DEFAULT_BATTLE_DURATION_MS,
  LANGUAGE_WAR_DEFAULT_BATTLE_INTERVAL_MS,
  LANGUAGE_WAR_DEFAULT_EMIT_BATTLE_GENERATIONS,
  LANGUAGE_WAR_DEFAULT_HIDE_UNDETERMINED,
  LANGUAGE_WAR_DEFAULT_MAX_LANGUAGES,
  LANGUAGE_WAR_DEFAULT_SHOW_TICKER,
  LANGUAGE_WAR_DEFAULT_SURGE_WINDOW_MS,
  LANGUAGE_WAR_DEFAULT_TITLE,
  type LanguageWarOverlaySettings,
} from "@/lib/languageWarOverlay";
import { DEFAULT_BASE_URL } from "@/lib/overlay";
import type { LanguageWarPhase } from "./types";
import { buildLanguageWarDemoSnapshot } from "./demo";
import LanguageWarOverlayView from "./LanguageWarOverlayView";

interface LanguageWarShowcaseProps {
  previewPhase?: LanguageWarPhase;
  title?: string;
}

const LANDING_BATTLE_DURATION_MS = 2 * 60_000;
const LANDING_RESOLUTION_DURATION_MS = 4_000;
const LANDING_BATTLE_FINAL_COUNTS = [224, 208, 63, 28, 10] as const;
const LANDING_BATTLE_START_COUNTS = [112, 101, 28, 12, 4] as const;

const demoSettings: LanguageWarOverlaySettings = {
  apiKey: "demo",
  channelName: "demo_channel",
  baseUrl: DEFAULT_BASE_URL,
  battleIntervalMs: LANGUAGE_WAR_DEFAULT_BATTLE_INTERVAL_MS,
  battleDurationMs: LANGUAGE_WAR_DEFAULT_BATTLE_DURATION_MS,
  maxLanguages: LANGUAGE_WAR_DEFAULT_MAX_LANGUAGES,
  surgeWindowMs: LANGUAGE_WAR_DEFAULT_SURGE_WINDOW_MS,
  showTicker: LANGUAGE_WAR_DEFAULT_SHOW_TICKER,
  hideUndetermined: LANGUAGE_WAR_DEFAULT_HIDE_UNDETERMINED,
  emitBattleGenerations: LANGUAGE_WAR_DEFAULT_EMIT_BATTLE_GENERATIONS,
  title: LANGUAGE_WAR_DEFAULT_TITLE,
};

const buildLandingBattleCounts = (elapsedMs: number) => {
  const progress = Math.min(
    1,
    Math.max(0, elapsedMs / LANDING_BATTLE_DURATION_MS)
  );

  return LANDING_BATTLE_START_COUNTS.map((start, index) => {
    const final = LANDING_BATTLE_FINAL_COUNTS[index] ?? start;
    const easedProgress = Math.min(
      1,
      Math.max(0, progress + ((elapsedMs / 1000 + index) % 3) * 0.0025)
    );
    return Math.round(start + (final - start) * easedProgress);
  });
};

const LanguageWarShowcase = ({
  previewPhase,
  title = LANGUAGE_WAR_DEFAULT_TITLE,
}: LanguageWarShowcaseProps) => {
  const [landingPhase, setLandingPhase] = useState<LanguageWarPhase>("battle");
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (previewPhase) {
      return;
    }

    let cycleStartedAt = 0;
    const frame = window.requestAnimationFrame(() => {
      const nextStartedAt = Date.now();
      cycleStartedAt = nextStartedAt;
      setStartedAt(nextStartedAt);
      setNow(nextStartedAt);
      setLandingPhase("battle");
    });
    const timer = window.setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      const elapsed = currentNow - (cycleStartedAt || currentNow);

      if (elapsed >= LANDING_BATTLE_DURATION_MS + LANDING_RESOLUTION_DURATION_MS) {
        setLandingPhase("podium");
        window.clearInterval(timer);
        return;
      }

      if (elapsed >= LANDING_BATTLE_DURATION_MS) {
        setLandingPhase("resolution");
        return;
      }

      setLandingPhase("battle");
    }, 1000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [previewPhase]);

  const activePhase = previewPhase ?? landingPhase;
  const elapsedMs = startedAt === 0 ? 0 : Math.max(0, now - startedAt);
  const showcaseCounts = useMemo(() => {
    if (activePhase === "battle") {
      return buildLandingBattleCounts(elapsedMs);
    }
    if (activePhase === "idle") {
      return [0, 0, 0, 0, 0];
    }
    return [...LANDING_BATTLE_FINAL_COUNTS];
  }, [activePhase, elapsedMs]);
  const snapshot = useMemo(
    () =>
      buildLanguageWarDemoSnapshot(activePhase, title, {
        battleDurationMs: LANDING_BATTLE_DURATION_MS,
        battleTimeRemainingMs: Math.max(
          0,
          LANDING_BATTLE_DURATION_MS - elapsedMs
        ),
        podiumTimeRemainingMs: Math.max(
          0,
          LANDING_BATTLE_DURATION_MS +
            LANDING_RESOLUTION_DURATION_MS -
            elapsedMs
        ),
        counts: showcaseCounts,
      }),
    [activePhase, elapsedMs, showcaseCounts, title]
  );
  const settings = useMemo(
    () => ({
      ...demoSettings,
      title,
    }),
    [title]
  );

  return (
    <LanguageWarOverlayView
      settings={settings}
      variant="preview"
      disableStream
      initialSnapshot={snapshot}
    />
  );
};

export default LanguageWarShowcase;
