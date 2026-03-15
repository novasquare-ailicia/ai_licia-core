"use client";

import { CSSProperties, useMemo } from "react";
import type { StreamStatus } from "@/components/overlay/types";
import {
  resolveLanguageWarName,
  type LanguageWarOverlaySettings,
} from "@/lib/languageWarOverlay";
import type { LanguageWarSnapshot, LanguageWarStanding } from "./types";
import { useLanguageWarStream } from "./useLanguageWarStream";
import styles from "./LanguageWarOverlayView.module.css";

interface LanguageWarOverlayViewProps {
  settings: LanguageWarOverlaySettings;
  variant?: "standalone" | "preview";
  disableStream?: boolean;
  initialSnapshot?: LanguageWarSnapshot;
  onStatusChange?: (status: StreamStatus, info: string) => void;
}

const SVG_SIZE = 460;
const CENTER = SVG_SIZE / 2;
const SEGMENT_RADIUS = 154;
const SEGMENT_WIDTH = 46;
const TIMER_RADIUS = 198;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;
const LABEL_RADIUS = 154;
const START_ANGLE = -90;
const GAP_DEGREES = 3.5;

const polarToCartesian = (
  cx: number,
  cy: number,
  radius: number,
  angleInDegrees: number
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
) => {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

const buildRingSegments = (standings: LanguageWarStanding[]) => {
  let cursor = START_ANGLE;
  return standings.map((standing) => {
    const sweep = Math.max(standing.share * 360 - GAP_DEGREES, 10);
    const start = cursor + GAP_DEGREES / 2;
    const end = start + sweep;
    const mid = start + sweep / 2;
    cursor += standing.share * 360;
    const labelPosition = polarToCartesian(CENTER, CENTER, LABEL_RADIUS, mid);
    return {
      ...standing,
      midAngle: mid,
      path: describeArc(CENTER, CENTER, SEGMENT_RADIUS, start, end),
      labelX: labelPosition.x,
      labelY: labelPosition.y,
    };
  });
};

const buildProgressStroke = (snapshot: LanguageWarSnapshot) =>
  TIMER_CIRCUMFERENCE * Math.min(1, Math.max(0, snapshot.progressRatio));

const formatTrendArrow = (trend: LanguageWarStanding["trend"]) => {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
};

const formatPercentage = (share: number) => `${Math.round(share * 100)}%`;

const formatCount = (count: number) => `${count} msgs`;

const LanguageWarOverlayView = ({
  settings,
  variant = "standalone",
  disableStream = false,
  initialSnapshot,
  onStatusChange,
}: LanguageWarOverlayViewProps) => {
  const liveState = useLanguageWarStream({
    settings,
    disabled: disableStream,
    onStatusChange,
  });

  const snapshot =
    disableStream && initialSnapshot ? initialSnapshot : liveState.snapshot;
  const status = disableStream ? "connected" : liveState.status;
  const statusMessage = disableStream ? "Preview mode" : liveState.statusMessage;
  const ringSegments = useMemo(
    () => buildRingSegments(snapshot.standings),
    [snapshot.standings]
  );
  const showStatusOverlay = variant === "standalone" && status !== "connected";
  const timerLabel = snapshot.timerLabel;
  const progressStroke = buildProgressStroke(snapshot);
  const showBattleTimer = snapshot.phase === "battle";
  const showCenterCrown =
    snapshot.showWinnerCrown &&
    (snapshot.phase === "resolution" || snapshot.phase === "podium");

  return (
    <section
      className={styles.overlay}
      data-preview={variant === "preview" ? "true" : "false"}
      data-connection={status}
      data-phase={snapshot.phase}
    >
      <div className={styles.board}>
        <div className={styles.ringPanel}>
          <p className={styles.panelTitle}>{snapshot.title}</p>
          <div className={styles.ringShell}>
            <svg
              className={styles.svg}
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              aria-hidden="true"
            >
              <circle
                className={styles.outerRing}
                cx={CENTER}
                cy={CENTER}
                r={214}
              />
              {showBattleTimer ? (
                <>
                  <circle
                    className={styles.timerTrack}
                    cx={CENTER}
                    cy={CENTER}
                    r={TIMER_RADIUS}
                    strokeDasharray={`${TIMER_CIRCUMFERENCE} ${TIMER_CIRCUMFERENCE}`}
                    transform={`rotate(-90 ${CENTER} ${CENTER})`}
                  />
                  <circle
                    className={styles.timerProgress}
                    cx={CENTER}
                    cy={CENTER}
                    r={TIMER_RADIUS}
                    strokeDasharray={`${progressStroke} ${TIMER_CIRCUMFERENCE}`}
                    transform={`rotate(-90 ${CENTER} ${CENTER})`}
                  />
                </>
              ) : null}
              <circle
                className={styles.ringTrack}
                cx={CENTER}
                cy={CENTER}
                r={SEGMENT_RADIUS}
                strokeWidth={SEGMENT_WIDTH}
              />
              {ringSegments.map((segment) => (
                <g key={segment.code}>
                  <path
                    className={styles.segment}
                    d={segment.path}
                    stroke={segment.color}
                    strokeWidth={SEGMENT_WIDTH}
                    style={
                      {
                        "--segment-color": segment.color,
                      } as CSSProperties
                    }
                  />
                  <text
                    className={styles.segmentLabel}
                    x={segment.labelX}
                    y={segment.labelY}
                  >
                    {segment.code}
                  </text>
                </g>
              ))}
              {showBattleTimer ? (
                <text className={styles.timerLabel} x={CENTER} y={24}>
                  {timerLabel}
                </text>
              ) : null}
            </svg>

            <div className={styles.center}>
              {showCenterCrown ? (
                <div
                  className={`${styles.centerCrown} ${
                    snapshot.phase === "resolution"
                      ? styles.centerCrownAnimated
                      : ""
                  }`}
                  style={
                    {
                      "--winner-color": snapshot.winner?.color ?? "#ffd56a",
                    } as CSSProperties
                  }
                  aria-hidden="true"
                />
              ) : null}
              <p className={styles.roundTitle}>{snapshot.eyebrowLabel}</p>
              {snapshot.supportLabel ? (
                <p className={styles.roundLabel}>{snapshot.supportLabel}</p>
              ) : null}
              <p className={styles.stateLabel}>{snapshot.stateLabel}</p>
              {snapshot.stateDescription ? (
                <p className={styles.stateDescription}>
                  {snapshot.stateDescription}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.rail}>
          {snapshot.standings.map((standing, index) => (
            <div
              key={standing.code}
              className={`${styles.row} ${index === 0 ? styles.rowLeader : ""}`}
              style={
                {
                  "--row-color": standing.color,
                } as CSSProperties
              }
            >
              <span className={styles.swatch} />
              <span className={styles.languageName}>
                {resolveLanguageWarName(standing.code)}
              </span>
              <span
                className={`${styles.trend} ${
                  standing.trend === "up"
                    ? styles.trendUp
                    : standing.trend === "down"
                    ? styles.trendDown
                    : styles.trendFlat
                }`}
              >
                {formatTrendArrow(standing.trend)}
              </span>
              <span className={styles.share}>{formatPercentage(standing.share)}</span>
              <span className={styles.count}>{formatCount(standing.count)}</span>
            </div>
          ))}

          {settings.showTicker &&
          snapshot.phase === "battle" &&
          snapshot.surge ? (
            <div
              className={styles.ticker}
              style={
                {
                  "--ticker-color":
                    snapshot.standings.find(
                      (standing) => standing.code === snapshot.surge?.code
                    )?.color ?? "#49d66d",
                } as CSSProperties
              }
            >
              <span className={styles.tickerCode}>{snapshot.surge.code}</span>
              <span className={styles.tickerText}>
                surging{" "}
                <span className={styles.tickerDelta}>+{snapshot.surge.delta}</span>{" "}
                in last {Math.round(snapshot.surge.windowMs / 1000)}s
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <footer className={styles.footer}>powered by ai_licia®</footer>

      {showStatusOverlay ? (
        <div className={styles.connectionOverlay} role="status" aria-live="polite">
          <div className={styles.connectionBadge}>
            {status === "connecting" ? "connecting..." : "disconnected"}
          </div>
          <p className={styles.connectionMessage}>{statusMessage}</p>
        </div>
      ) : null}
    </section>
  );
};

export default LanguageWarOverlayView;
