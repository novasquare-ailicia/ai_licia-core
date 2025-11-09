import { CSSProperties, useEffect, useRef, useState } from "react";
import { PulseGlowSettings } from "@/lib/overlay";
import styles from "./OverlayView.module.css";

interface TotalRateCardProps {
  totalRate: number;
  pulseGlow: PulseGlowSettings;
}

const TotalRateCard = ({ totalRate, pulseGlow }: TotalRateCardProps) => {
  const [displayRate, setDisplayRate] = useState(totalRate);
  const rafRef = useRef<number | null>(null);
  const currentValueRef = useRef(totalRate);

  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    const duration = 600;
    const startValue = currentValueRef.current;
    const delta = totalRate - startValue;
    const startTime = performance.now();

    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const nextValue = startValue + delta * ease(progress);
      currentValueRef.current = nextValue;
      setDisplayRate(nextValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [totalRate]);

  const normalized = (() => {
    if (!pulseGlow?.enabled) return 0;
    const { minRate, maxRate } = pulseGlow;
    if (maxRate <= minRate) return 0;
    const clamped = Math.min(Math.max(totalRate, minRate), maxRate);
    return (clamped - minRate) / (maxRate - minRate);
  })();

  const style = {
    "--pulse-strength": normalized.toString(),
    "--pulse-color": pulseGlow?.color ?? "#29ffc6",
  } as CSSProperties;

  return (
    <div className={styles.totalRateCard} style={style}>
      <div className={styles.totalTitle}>total message rate</div>
      <div className={styles.totalValue}>
        {displayRate > 0 ? displayRate.toFixed(1) : "--"}
        <span>msg/min</span>
      </div>
      {totalRate <= 0 && (
        <p className={styles.totalHint}>waiting for chat activity</p>
      )}
    </div>
  );
};

export default TotalRateCard;
