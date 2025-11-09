'use client';

import { useEffect, useMemo } from "react";
import OverlayView from "@/components/overlay/OverlayView";
import { parseOverlaySettings } from "@/lib/overlay";

interface RuntimeProps {
  initialParams?: Record<string, string | string[] | undefined>;
  mode?: "full" | "total-rate";
}

const OverlayRuntime = ({ initialParams = {}, mode = "full" }: RuntimeProps) => {
  const clientParams = useMemo(() => {
    if (typeof window === "undefined") {
      return initialParams;
    }
    const searchParams = new URLSearchParams(window.location.search);
    if (!searchParams.size) {
      return initialParams;
    }
    const next: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      next[key] = value;
    });
    return next;
  }, [initialParams]);

  const settings = useMemo(
    () => parseOverlaySettings(clientParams),
    [clientParams]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("overlay-mode");
    document.documentElement.classList.add("overlay-mode");
    return () => {
      document.body.classList.remove("overlay-mode");
      document.documentElement.classList.remove("overlay-mode");
    };
  }, []);

  return (
    <div className="overlay-page">
      <OverlayView settings={settings} variant="standalone" mode={mode} />
    </div>
  );
};

export default OverlayRuntime;
