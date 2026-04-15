import styles from "./LandingSections.module.css";

const benefits = [
  {
    title: "Friendly competition",
    description:
      "Reward regulars and lurkers with a visible race to the top. ai_licia keeps the tone playful and on-brand.",
  },
  {
    title: "Unleash the power of ai_licia",
    description:
      "ai_licia keep track of the different Leaderboards in real time, and can react to updates to them.",
  },
  {
    title: "Export-ready for OBS/XSplit",
    description:
      "Every overlay ships as a single browser-source link optimized for 16:9 and tall layouts.",
  },
  {
    title: "Easy to Customize",
    description:
      "Customise our Overlays to make them your Own! Adjust the colors to your brand and select the right interaction settings for your Community.",
  },
];

const BenefitsSection = () => (
  <section className={`${styles.section} ${styles.benefits}`} id="benefits">
    <div>
      <h2 className={styles.sectionTitle}>Why overlays matter</h2>
      <p className={styles.sectionLead}>
        Great overlays turn viewers into community members. Whether you&apos;re
        shipping a Twitch, Kick, YouTube, or TikTok overlay flow in OBS, keep
        the funnel tight: awareness → participation → loyalty, while ai_licia
        narrates the action in realtime.
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
