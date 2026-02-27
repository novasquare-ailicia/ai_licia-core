import type { Platform } from "ai_licia-client";
import styles from "./JointChatOverlayView.module.css";

interface PlatformIconProps {
  platform: Platform;
}

const PlatformIcon = ({ platform }: PlatformIconProps) => {
  if (platform === "TWITCH") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={styles.platformIcon}
        aria-hidden="true"
      >
        <path
          d="M4 3h17v11l-4 4h-4l-3 3v-3H4z"
          fill="currentColor"
        />
        <rect x="9" y="7" width="2" height="5" fill="#0b0d16" />
        <rect x="14" y="7" width="2" height="5" fill="#0b0d16" />
      </svg>
    );
  }

  if (platform === "YOUTUBE") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={styles.platformIcon}
        aria-hidden="true"
      >
        <rect x="2.5" y="6.5" width="19" height="11" rx="4" fill="currentColor" />
        <path d="M10 9.5v5l5-2.5z" fill="#ffffff" />
      </svg>
    );
  }

  if (platform === "TIKTOK") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={styles.platformIcon}
        aria-hidden="true"
      >
        <path
          d="M14.7 4v3.4a4.4 4.4 0 0 0 3.2 1.2v2.9a7.1 7.1 0 0 1-3.2-.8v5.6a5.5 5.5 0 1 1-4.7-5.4v2.9a2.6 2.6 0 1 0 1.8 2.5V4z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={styles.platformIcon}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" />
      <path
        d="M9 7h3v5l3-5h3l-3.6 5.8L18 17h-3.1l-2.9-3.7V17H9z"
        fill="#0b0d16"
      />
    </svg>
  );
};

export default PlatformIcon;
