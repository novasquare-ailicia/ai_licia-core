"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JointChatOverlayView from "@/components/joint-chat/JointChatOverlayView";
import { trackEvent } from "@/lib/analytics";
import { parseJointChatOverlaySettings } from "@/lib/jointChatOverlay";

interface JointChatRuntimeProps {
  initialParams?: Record<string, string | string[] | undefined>;
}

const JointChatRuntime = ({ initialParams = {} }: JointChatRuntimeProps) => {
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
    () => parseJointChatOverlaySettings(clientParams),
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
      mode: "joint-chat",
      hasCredentials: Boolean(settings.apiKey && settings.channelName),
      maxItems: settings.maxItems,
      profanityFilterEnabled: settings.profanityFilterEnabled,
      enabledPlatforms: settings.platforms.length,
    });
  }, [
    settings.apiKey,
    settings.channelName,
    settings.maxItems,
    settings.platforms.length,
    settings.profanityFilterEnabled,
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
    <div className="overlay-page">
      <JointChatOverlayView settings={settings} variant="standalone" />
    </div>
  );
};

export default JointChatRuntime;
