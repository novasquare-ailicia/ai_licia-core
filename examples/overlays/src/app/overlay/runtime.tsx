'use client';

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import OverlayView from "@/components/overlay/OverlayView";
import { parseOverlaySettings } from "@/lib/overlay";

interface RuntimeProps {
  initialParams: Record<string, string | string[] | undefined>;
  mode?: "full" | "total-rate";
}

const OverlayRuntime = ({ initialParams, mode = "full" }: RuntimeProps) => {
  const params = useSearchParams();

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.add("overlay-mode");
      return () => document.body.classList.remove("overlay-mode");
    }
  }, []);

  const mergedParams = useMemo(() => {
    const current: Record<string, string | string[] | undefined> = {};
    params.forEach((value, key) => {
      current[key] = value;
    });
    return Object.keys(current).length ? current : initialParams;
  }, [params, initialParams]);

  const settings = useMemo(
    () => parseOverlaySettings(mergedParams),
    [mergedParams]
  );

  return (
    <div className="overlay-page">
      <OverlayView settings={settings} variant="standalone" mode={mode} />
    </div>
  );
};

export default OverlayRuntime;
