"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LanguageWarOverlayView from "@/components/language-war/LanguageWarOverlayView";
import { trackEvent } from "@/lib/analytics";
import { parseLanguageWarOverlaySettings } from "@/lib/languageWarOverlay";

interface LanguageWarRuntimeProps {
  initialParams?: Record<string, string | string[] | undefined>;
}

const LanguageWarRuntime = ({ initialParams = {} }: LanguageWarRuntimeProps) => {
  const clientParams = useMemo(() => {
    if (typeof window === "undefined") {
      return initialParams;
    }
    const parsed = new URLSearchParams(window.location.search);
    if (!parsed.size) return initialParams;
    const next: Record<string, string> = {};
    parsed.forEach((value, key) => {
      next[key] = value;
    });
    return next;
  }, [initialParams]);

  const settings = useMemo(
    () => parseLanguageWarOverlaySettings(clientParams),
    [clientParams]
  );
  const trackedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackEvent("overlay_visit", {
      mode: "language-war",
      hasCredentials: Boolean(settings.apiKey && settings.channelName),
      battleIntervalMs: settings.battleIntervalMs,
      battleDurationMs: settings.battleDurationMs,
      maxLanguages: settings.maxLanguages,
      showTicker: settings.showTicker,
      hideUndetermined: settings.hideUndetermined,
      emitBattleGenerations: settings.emitBattleGenerations,
    });
  }, [
    settings.apiKey,
    settings.battleDurationMs,
    settings.battleIntervalMs,
    settings.channelName,
    settings.emitBattleGenerations,
    settings.hideUndetermined,
    settings.maxLanguages,
    settings.showTicker,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("overlay-mode");
    document.documentElement.classList.add("overlay-mode");
    return () => {
      document.body.classList.remove("overlay-mode");
      document.documentElement.classList.remove("overlay-mode");
    };
  }, []);

  if (!isReady) return null;

  return (
    <div className="overlay-page overlay-page-language-war">
      <LanguageWarOverlayView settings={settings} variant="standalone" />
    </div>
  );
};

export default LanguageWarRuntime;
