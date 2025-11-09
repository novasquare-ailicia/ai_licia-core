import styles from "./LandingSections.module.css";

const benefits = [
  {
    title: "Friendly competition",
    description:
      "Reward regulars and lurkers with a visible race to the top. ai_licia keeps the tone playful and on-brand.",
  },
  {
    title: "AI-powered context",
    description:
      "Leaderboard updates are shared with ai_licia so her responses always reference who is climbing.",
  },
  {
    title: "Export-ready for OBS/XSplit",
    description:
      "Every overlay ships as a single browser-source link optimized for 16:9 and tall layouts.",
  },
  {
    title: "Secure + role-aware",
    description:
      "Filter VIPs, Mods, Viewers, or even ai_licia herself. Exclude bots with a comma-separated list.",
  },
];

const BenefitsSection = () => (
  <section className={`${styles.section} ${styles.benefits}`} id="benefits">
    <div>
      <h2 className={styles.sectionTitle}>Why overlays matter</h2>
      <p className={styles.sectionLead}>
        Great overlays turn viewers into community members. Whether you&apos;re
        shipping a Twitch overlay, TikTok overlay, AI overlay, OBS overlay, or
        any hybrid streaming overlay, keep the funnel tight: awareness → participation
        → loyalty, all while ai_licia narrates the action.
      </p>
    </div>
    <div className={styles.benefitGrid}>
      {benefits.map((benefit) => (
        <article key={benefit.title} className={styles.benefitCard}>
          <h3>{benefit.title}</h3>
          <p>{benefit.description}</p>
        </article>
      ))}
    </div>
  </section>
);

export default BenefitsSection;
