import styles from "./LandingSections.module.css";

const steps = [
  {
    title: "Connect ai_licia",
    description:
      "Add your API key & channel slug. We normalize the endpoint so your overlays stay portable.",
  },
  {
    title: "Design the vibe",
    description:
      "Choose a preset, tweak gradients, and decide whether to surface roles, rates, or both.",
  },
  {
    title: "Drop into OBS",
    description:
      "Copy the export-ready link. Top chatters, total msg/min, and ai_licia triggers go live instantly.",
  },
];

const FunnelSection = () => (
  <section className={`${styles.section} ${styles.funnel}`}>
    <div>
      <h2 className={styles.sectionTitle}>A funnel that nudges participation</h2>
      <p className={styles.sectionLead}>
        Turn passive viewers into featured supporters. The overlay keeps score,
        ai_licia keeps the banter flowing.
      </p>
    </div>
    <div className={styles.funnelSteps}>
      {steps.map((step, index) => (
        <article key={step.title} className={styles.funnelCard}>
          <span className={styles.stepBadge}>{index + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </article>
      ))}
    </div>
  </section>
);

export default FunnelSection;
