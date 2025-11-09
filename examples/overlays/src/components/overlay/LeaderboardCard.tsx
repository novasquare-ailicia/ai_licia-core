import { CSSProperties } from "react";
import type { AnimatedCard } from "./types";
import type { OverlayLayout, RankKey } from "@/lib/overlay";
import styles from "./OverlayView.module.css";

type CSSVarProperties = CSSProperties & Record<`--${string}`, string | number>;

interface LeaderboardCardProps {
  card: AnimatedCard;
  index: number;
  showRates: boolean;
  layout: OverlayLayout;
}

const horizontalSizeVars: Record<RankKey | "base", CSSVarProperties> = {
  base: {
    "--card-height": "clamp(120px, 16vw, 175px)",
  },
  rank1: {
    "--card-height": "clamp(135px, 18vw, 190px)",
  },
  rank2: {},
  rank3: {
    "--card-height": "clamp(110px, 14vw, 155px)",
  },
};

const verticalSizeVars: Record<RankKey | "base", CSSVarProperties> = {
  base: {
    "--card-max-width": "clamp(320px, 56vw, 480px)",
    "--card-justify": "center",
  },
  rank1: {
    "--card-max-width": "clamp(360px, 62vw, 540px)",
  },
  rank2: {},
  rank3: {
    "--card-max-width": "clamp(280px, 50vw, 420px)",
  },
};

const LeaderboardCard = ({ card, index, showRates, layout }: LeaderboardCardProps) => {
  const { entry, placeholder, progress, state, countKey } = card;
  const rate = entry.messagesPerMinute ?? 0;
  const lift = placeholder ? 6 + index * 2 : (1 - progress) * 6;
  const sizeBase = layout === "horizontal" ? horizontalSizeVars.base : verticalSizeVars.base;
  const rankVars =
    layout === "horizontal"
      ? horizontalSizeVars[card.rank]
      : verticalSizeVars[card.rank];
  const sizeStyle = { ...sizeBase, ...rankVars };

  const className = [
    styles.card,
    styles[`rank${index + 1}`],
    placeholder ? styles.placeholderCard : "",
    styles[`state-${state}`],
  ]
    .filter(Boolean)
    .join(" ");

  const styleVars: CSSVarProperties = {
    "--lift": `${lift}px`,
    ...sizeStyle,
  };

  return (
    <article className={className} style={styleVars}>
      <div className={styles.cardAccent} />
      <div className={styles.cardGlow} />
      <div className={styles.cardSheen} />
      <div className={styles.cardContent}>
        <span className={styles.rank}>#{index + 1}</span>
        <div className={styles.identity}>
          <span className={styles.username}>{entry.username}</span>
          {entry.role && <span className={styles.role}>{entry.role}</span>}
        </div>
        <span key={countKey} className={`${styles.count} ${styles.countPop}`}>
          {placeholder
            ? "awaiting chat activity"
            : `${entry.count} message${entry.count === 1 ? "" : "s"}`}
        </span>
        {showRates && !placeholder && (
          <span className={styles.rate}>~{rate.toFixed(1)} msg/min</span>
        )}
      </div>
    </article>
  );
};

export default LeaderboardCard;
