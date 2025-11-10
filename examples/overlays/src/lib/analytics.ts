type GTag = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GTag;
  }
}

export const trackEvent = (
  name: string,
  params?: Record<string, unknown>
) => {
  if (typeof window === "undefined") return;
  window.gtag?.("event", name, params ?? {});
};

export const trackTimedEvent = (
  name: string,
  params?: Record<string, unknown>
) => {
  if (typeof performance === "undefined") {
    trackEvent(name, params);
    return;
  }

  trackEvent(name, {
    event_time: Math.round(performance.now()),
    ...params,
  });
};

export const trackConsentUpdate = (state: "granted" | "denied") => {
  if (typeof window === "undefined") return;
  window.gtag?.("consent", "update", {
    ad_storage: state,
    analytics_storage: state,
  });
};
