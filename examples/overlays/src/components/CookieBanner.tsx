'use client';

import { useEffect, useState } from "react";

const STORAGE_KEY = "ai_licia_cookie_consent";

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      const consent = window.localStorage.getItem(STORAGE_KEY);
      setVisible(!consent);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const acceptCookies = () => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookieBanner" role="dialog" aria-live="polite">
      <p>
        We use cookies to measure product usage and keep improving the overlay
        experience. By continuing, you agree to our analytics tracking.
      </p>
      <button type="button" onClick={acceptCookies}>
        Got it
      </button>
    </div>
  );
};

export default CookieBanner;
