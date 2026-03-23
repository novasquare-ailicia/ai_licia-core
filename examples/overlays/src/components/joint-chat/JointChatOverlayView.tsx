"use client";

import { CSSProperties } from "react";
import type { StreamStatus } from "@/components/overlay/types";
import type { JointChatOverlaySettings } from "@/lib/jointChatOverlay";
import PlatformIcon from "./PlatformIcon";
import type { JointChatFeedItem } from "./types";
import { useJointChatStream } from "./useJointChatStream";
import styles from "./JointChatOverlayView.module.css";

interface JointChatOverlayViewProps {
  settings: JointChatOverlaySettings;
  variant?: "standalone" | "preview";
  disableStream?: boolean;
  initialItems?: JointChatFeedItem[];
  onStatusChange?: (status: StreamStatus, info: string) => void;
}

const JointChatOverlayView = ({
  settings,
  variant = "standalone",
  disableStream = false,
  initialItems,
  onStatusChange,
}: JointChatOverlayViewProps) => {
  const { items: liveItems, status, statusMessage } = useJointChatStream({
    settings,
    disabled: disableStream,
    onStatusChange,
  });

  const sourceItems = disableStream ? initialItems ?? [] : liveItems;
  const items = sourceItems.slice(
    Math.max(0, sourceItems.length - settings.maxItems)
  );
  const showStatusOverlay = variant === "standalone" && status !== "connected";
  const connectionLabel = status === "connecting" ? "connecting..." : "disconnected";

  const styleVars = {
    "--joint-enter-ms": `${settings.entryAnimationMs}ms`,
    "--joint-exit-ms": `${settings.exitAnimationMs}ms`,
  } as CSSProperties;

  return (
    <section
      className={styles.overlay}
      data-connection={status}
      data-preview={variant === "preview" ? "true" : "false"}
      style={styleVars}
    >
      {items.length === 0 ? (
        <p className={styles.waitingMessage}>Waiting for chat messages</p>
      ) : (
        <ol className={styles.feed}>
          {items.map((item) => (
            <li
              key={item.id}
              className={`${styles.row} ${item.emphasized ? styles.eventRow : ""} ${
                item.leaving ? styles.leaving : styles.entering
              }`}
            >
              <div className={styles.rowHeader}>
                <span
                  className={styles.username}
                  style={{ color: item.usernameColor }}
                >
                  {item.username}
                </span>
                <span className={`${styles.chip} ${styles.platformChip}`} data-platform={item.platform}>
                  <PlatformIcon platform={item.platform} />
                </span>
                {item.statusChips.map((chip) => (
                  <span
                    key={`${item.id}-${chip}`}
                    className={`${styles.chip} ${styles.statusChip}`}
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <p className={styles.message}>{item.message}</p>
            </li>
          ))}
        </ol>
      )}

      <footer className={styles.footer}>powered by ai_licia®</footer>

      {showStatusOverlay && (
        <div className={styles.connectionOverlay} role="status" aria-live="polite">
          <div className={styles.connectionBadge}>{connectionLabel}</div>
          <p className={styles.connectionMessage}>{statusMessage}</p>
        </div>
      )}
    </section>
  );
};

export default JointChatOverlayView;
