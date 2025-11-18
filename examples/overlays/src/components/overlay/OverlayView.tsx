'use client';

import { CSSProperties } from "react";
import {
  OverlaySettings,
  DEFAULT_THEME,
  THEME_PRESETS,
  RankKey,
  DEFAULT_LAYOUT,
  DEFAULT_DENSITY,
  DEFAULT_SHOW_RATES,
  DEFAULT_SHOW_TOTAL_RATE,
  DEFAULT_PULSE_GLOW,
  DEFAULT_OVERLAY_OPACITY,
} from "@/lib/overlay";
import { useLeaderboardStream } from "./useLeaderboardStream";
import { useCardTransitions } from "./useCardTransitions";
import LeaderboardCard from "./LeaderboardCard";
import TotalRateCard from "./TotalRateCard";
import type { LeaderboardEntry, StreamStatus } from "./types";
import styles from "./OverlayView.module.css";

const PLACEHOLDER_REFERENCE = Date.now();
const PLACEHOLDER_CARDS: LeaderboardEntry[] = [
  {
    username: "waiting on activity",
    role: "configure your api",
    count: 12,
    firstSeenAt: PLACEHOLDER_REFERENCE,
    messagesPerMinute: 0.5,
  },
  {
    username: "top chatter slot",
    role: "stays ready",
    count: 10,
    firstSeenAt: PLACEHOLDER_REFERENCE - 30000,
    messagesPerMinute: 0.4,
  },
  {
    username: "third place glow",
    role: "warming up",
    count: 6,
    firstSeenAt: PLACEHOLDER_REFERENCE - 60000,
    messagesPerMinute: 0.3,
  },
];

type OverlayMode = "full" | "total-rate";

interface OverlayViewProps {
  settings: OverlaySettings;
  variant?: "standalone" | "preview";
  disableStream?: boolean;
  initialLeaders?: LeaderboardEntry[];
  onStatusChange?: (status: StreamStatus, info: string) => void;
  showPlaceholders?: boolean;
  mode?: OverlayMode;
}

const OverlayView = ({
  settings,
  variant = "standalone",
  disableStream = false,
  initialLeaders,
  onStatusChange,
  showPlaceholders,
  mode = "full",
}: OverlayViewProps) => {
  const themePreset =
    THEME_PRESETS[settings.theme] ?? THEME_PRESETS[DEFAULT_THEME];
  const layout = settings.layout ?? DEFAULT_LAYOUT;
  const compact = settings.compact ?? DEFAULT_DENSITY === "compact";
  const showRates = settings.showRates ?? DEFAULT_SHOW_RATES;
  const showTotalRateCard =
    mode === "total-rate"
      ? true
      : settings.showTotalRateCard ?? DEFAULT_SHOW_TOTAL_RATE;
  const renderCards = mode === "full";

  const { leaders, totalRate, status, statusMessage } = useLeaderboardStream({
    settings,
    disabled: disableStream,
    initialLeaders,
    onStatusChange,
    enableGenerations: mode === "full",
  });

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const connectionState = isConnected
    ? "connected"
    : isConnecting
      ? "connecting"
      : "disconnected";
  const connectionUiEnabled = variant === "standalone";
  const connectionAttrValue = connectionUiEnabled ? connectionState : "connected";
  const showStatusOverlay = connectionUiEnabled && connectionState !== "connected";
  const statusBadgeLabel = isConnecting ? "connecting…" : "disconnected";

  const gradientVar = (rank: RankKey) => {
    const gradient =
      settings.customGradients[rank] ?? themePreset.gradients[rank];
    return `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`;
  };

  const toSolidColor = (value: string) => {
    const match = value.match(/rgba?\(([^)]+)\)/i);
    if (!match) return value;
    const parts = match[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      const [r, g, b] = parts;
      return `rgba(${r}, ${g}, ${b}, 1)`;
    }
    return value;
  };

  const cardSolidBg = toSolidColor(themePreset.cardBg);
  const cardOpacityValue = settings.overlayOpacity ?? DEFAULT_OVERLAY_OPACITY;
  const cardOpacityPercent = `${Math.round(cardOpacityValue * 100)}%`;

  const styleVars = {
    "--overlay-bg": themePreset.overlayBg,
    "--overlay-border": themePreset.borderColor,
    "--card-bg": themePreset.cardBg,
    "--card-solid-bg": cardSolidBg,
    "--card-border": themePreset.borderColor,
    "--status-bg": themePreset.statusBg,
    "--footer-border": themePreset.footerBorder,
    "--gradient-rank1": gradientVar("rank1"),
    "--gradient-rank2": gradientVar("rank2"),
    "--gradient-rank3": gradientVar("rank3"),
    "--card-opacity": `${cardOpacityValue}`,
    "--card-opacity-percent": cardOpacityPercent,
    "--overlay-opacity": 0.6,
  } as CSSProperties;

  const wrapperClass =
    variant === "preview" ? styles.previewWrapper : styles.fullWrapper;

  const overlayAttrs = {
    "data-compact": compact ? "true" : "false",
  };

  const placeholderCards = PLACEHOLDER_CARDS;

  const placeholdersEnabled =
    showPlaceholders !== undefined ? showPlaceholders : variant !== "standalone";

  const placeholdersActive =
    renderCards && placeholdersEnabled && leaders.length === 0;

  const cardSource = renderCards
    ? placeholdersActive
      ? placeholderCards
      : leaders
    : [];

  const cardSlots = useCardTransitions({
    leaders: cardSource,
    placeholdersActive,
  });

  const cardsClassName = [
    styles.cards,
    variant === "standalone" ? styles.cardsStandalone : "",
    layout === "vertical" ? styles.cardsVertical : styles.cardsHorizontal,
    compact ? styles.cardsCompact : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hasCards = cardSlots.length > 0;
  const shouldRenderCards = renderCards && hasCards;
  const showWaitingMessage =
    variant === "standalone" &&
    mode === "full" &&
    connectionAttrValue === "connected" &&
    !hasCards &&
    !showStatusOverlay;
  const isOverlayEmpty =
    renderCards && !hasCards && !showStatusOverlay && !showWaitingMessage;
  const showFooter = true;
  const showTotals =
    showTotalRateCard && (hasCards || mode === "total-rate" || variant === "preview");

  return (
    <section
      className={`${styles.overlay} ${wrapperClass}`}
      style={styleVars}
      data-empty={isOverlayEmpty}
      data-connection={connectionAttrValue}
      {...overlayAttrs}
    >
      {shouldRenderCards && (
        <div
          className={cardsClassName}
          data-layout={layout}
          data-compact={compact ? "true" : "false"}
        >
          {cardSlots.map((card, index) => (
            <LeaderboardCard
              key={card.id}
              card={card}
              index={index}
              showRates={showRates}
              layout={layout}
              compact={compact}
            />
          ))}
        </div>
      )}
      {showWaitingMessage && (
        <div className={styles.waitingMessage}>Waiting for the first message to arrive…</div>
      )}

      {showTotals && (
        <TotalRateCard
          totalRate={totalRate}
          pulseGlow={settings.pulseGlow ?? DEFAULT_PULSE_GLOW}
        />
      )}

      {showFooter && (
        <footer className={styles.footer}>
          <span className={styles.brand}>powered by ai_licia®</span>
        </footer>
      )}

      {showStatusOverlay && (
        <div
          className={styles.connectionOverlay}
          role="status"
          aria-live="polite"
        >
          <div className={styles.connectionBadge}>{statusBadgeLabel}</div>
          {statusMessage && (
            <p className={styles.connectionMessage}>{statusMessage}</p>
          )}
        </div>
      )}
    </section>
  );
};

export default OverlayView;
