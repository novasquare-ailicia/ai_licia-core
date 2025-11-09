import styles from "./LandingSections.module.css";

const integrationPoints = [
  {
    title: "Live context for ai_licia",
    body: "We sync the top three chatters and total msg/min so ai_licia can reference them in greetings, promo reads, or hype moments.",
  },
  {
    title: "Overlay + automation",
    body: "Trigger branded shout-outs when someone steals rank #1, or ping ai_licia to celebrate a milestone.",
  },
  {
    title: "Flexible layouts",
    body: "Toggle between horizontal or stacked cards, or isolate the total pulse for clean overlays and widget stacks.",
  },
];

const IntegrationSection = () => (
  <section className={`${styles.section} ${styles.integration}`}>
    {integrationPoints.map((point) => (
      <article key={point.title} className={styles.integrationCard}>
        <h3>{point.title}</h3>
        <p>{point.body}</p>
      </article>
    ))}
  </section>
);

export default IntegrationSection;
