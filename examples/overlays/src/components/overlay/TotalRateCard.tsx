import styles from "./OverlayView.module.css";

interface TotalRateCardProps {
  totalRate: number;
}

const TotalRateCard = ({ totalRate }: TotalRateCardProps) => (
  <div className={styles.totalRateCard}>
    <div className={styles.totalTitle}>total message rate</div>
    <div className={styles.totalValue}>
      {totalRate > 0 ? totalRate.toFixed(1) : "--"}
      <span>msg/min</span>
    </div>
    {totalRate <= 0 && (
      <p className={styles.totalHint}>waiting for chat activity</p>
    )}
  </div>
);

export default TotalRateCard;
