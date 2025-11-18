'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import OverlayView from "@/components/overlay/OverlayView";
import { parseOverlaySettings } from "@/lib/overlay";
import { trackEvent } from "@/lib/analytics";

interface RuntimeProps {
  initialParams?: Record<string, string | string[] | undefined>;
  mode?: "full" | "total-rate";
}

const OverlayRuntime = ({ initialParams = {}, mode = "full" }: RuntimeProps) => {
  const clientParams = useMemo(() => {
    if (typeof window === "undefined") {
      return initialParams;
    }

    const fallbackParse = (raw: string, source: string) => {
      const manual: Record<string, string> = {};
      raw.split("&").forEach((pair) => {
        if (!pair) return;
        const [k, v = ""] = pair.split("=");
        const key = decodeURIComponent(k);
        const value = decodeURIComponent(v);
        manual[key] = value;
      });
      if (Object.keys(manual).length === 0) {
        console.warn(
          "[OverlayRuntime] Manual parsing could not recover params for",
          source,
          raw
        );
        return null;
      }
      console.info(
        "[OverlayRuntime] Parsed query params via manual fallback from",
        source,
        JSON.stringify(manual)
      );
      return manual;
    };

    const buildParams = (queryString: string | null, source: string) => {
      if (!queryString) return null;
      const trimmed = queryString.startsWith("?")
        ? queryString.slice(1)
        : queryString;
      if (!trimmed.trim()) return null;

      try {
        const params = new URLSearchParams(trimmed);
        if (!params.size) {
          console.warn(
            "[OverlayRuntime] URLSearchParams returned empty result for",
            source,
            trimmed,
            "- attempting manual fallback"
          );
          return fallbackParse(trimmed, source);
        }
        const next: Record<string, string> = {};
        params.forEach((value, key) => {
          next[key] = value;
        });
        console.info(
          "[OverlayRuntime] Parsed query params from",
          source,
          JSON.stringify(next)
        );
        return next;
      } catch (error) {
        console.warn(
          "[OverlayRuntime] URLSearchParams threw, falling back to manual parsing for",
          source,
          trimmed,
          error
        );
        return fallbackParse(trimmed, source);
      }
    };

    const primary = buildParams(window.location.search, "window.location.search");
    if (primary) {
      return primary;
    }

    const href = window.location.href;
    const questionMarkIndex = href.indexOf("?");
    if (questionMarkIndex !== -1) {
      const hashIndex = href.indexOf("#", questionMarkIndex);
      const fallbackQuery =
        hashIndex === -1 ? href.slice(questionMarkIndex) : href.slice(questionMarkIndex, hashIndex);
      const fallback = buildParams(fallbackQuery, "window.location.href (fallback)");
      if (fallback) {
        return fallback;
      }
    }

    const hash = window.location.hash;
    if (hash) {
      const hashQueryIndex = hash.indexOf("?");
      if (hashQueryIndex !== -1) {
        const hashQuery = hash.slice(hashQueryIndex);
        const hashParams = buildParams(hashQuery, "window.location.hash");
        if (hashParams) {
          return hashParams;
        }
      }
    }

    console.warn("[OverlayRuntime] Falling back to initial params from server render.");
    return initialParams;
  }, [initialParams]);

  const settings = useMemo(
    () => parseOverlaySettings(clientParams),
    [clientParams]
  );
  const visitTrackedRef = useRef(false);
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsClientReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (visitTrackedRef.current) return;
    visitTrackedRef.current = true;
    const hasCredentials = Boolean(settings.apiKey && settings.channelName);
    trackEvent("overlay_visit", {
      mode,
      layout: settings.layout,
      theme: settings.theme,
      compact: settings.compact,
      hasCredentials,
      rolesCount: settings.roles.length,
      showRates: settings.showRates,
      showTotalRateCard: settings.showTotalRateCard,
    });
  }, [
    mode,
    settings.apiKey,
    settings.channelName,
    settings.layout,
    settings.theme,
    settings.compact,
    settings.roles.length,
    settings.showRates,
    settings.showTotalRateCard,
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

  if (!isClientReady) {
    return null;
  }

  return (
    <div className="overlay-page">
      <OverlayView settings={settings} variant="standalone" mode={mode} />
    </div>
  );
};

export default OverlayRuntime;
