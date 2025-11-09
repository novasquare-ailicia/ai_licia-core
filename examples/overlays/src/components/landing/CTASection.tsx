import Link from "next/link";
import styles from "./LandingSections.module.css";

const CTASection = () => (
  <section className={`${styles.section} ${styles.ctaWrapper}`}>
    <div className={styles.ctaGrid}>
      <article className={`${styles.ctaCard} ${styles.ctaPrimary}`}>
        <h2 className={styles.sectionTitle}>Ready to energize your chat?</h2>
        <p className={`${styles.sectionLead} ${styles.cardBody}`}>
          Ship overlays that look like the future and react in realtime. ai_licia
          keeps everyone informed, competitive, and smiling.
        </p>
        <div className={styles.cardActions}>
          <Link href="/configure" className={styles.primaryButton}>
            Launch the configurator
          </Link>
          <Link
            href="https://docs.getailicia.com"
            className={styles.ghostButton}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the docs
          </Link>
        </div>
      </article>

      <article className={`${styles.ctaCard} ${styles.ctaSecondary}`}>
        <h2 className={styles.sectionTitle}>Join the builders club</h2>
        <p className={`${styles.sectionLead} ${styles.cardBody}`}>
          Want to build a custom overlay powered by ai_licia? Create your own
          integration and take over your Twitch or TikTok overlay workflow.
        </p>
        <div className={styles.cardActions}>
          <Link
            href="https://docs.getailicia.com"
            className={styles.primaryButton}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get started
          </Link>
          <Link
            href="https://discord.gg/Pbh7bYPJKt"
            className={`${styles.ghostButton} ${styles.smallButton}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Join the community
          </Link>
        </div>
      </article>
    </div>
    <p className={styles.ctaNote}>Powered by ai_licia® - tuned for creators.</p>
  </section>
);

export default CTASection;
