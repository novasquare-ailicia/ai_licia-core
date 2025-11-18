import Link from "next/link";
import OverlayShowcase from "@/components/OverlayShowcase";
import SmoothAnchor from "@/components/SmoothAnchor";
import styles from "./LandingSections.module.css";

const HeroSection = () => (
  <section className={`${styles.section} ${styles.hero}`} id="hero">
    <div className={styles.heroContent}>
      <span className="tagline">Realtime AI overlays for creators</span>
      <h1 className={styles.heroTitle}>
        Spotlight your most dedicated chatters with ai_licia®.
      </h1>
      <p className={styles.heroLead}>
        Build an AI overlay, for OBS, that speaks to Twitch and TikTok communities.
        ai_licia turns every stream into an interactive competition. perfect for
        Twitch overlays, TikTok overlays, OBS overlays, and any
        high-energy streams.
      </p>
      <div className={styles.heroActions}>
        <Link href="/configure" className={styles.primaryButton}>
          Start with overlays →
        </Link>
        <SmoothAnchor targetId="gallery" className={styles.ghostButton}>
          See overlays in action
        </SmoothAnchor>
        <Link
          href="https://getailicia.com"
          className={styles.gradientButton}
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn about ai_licia
        </Link>
      </div>
      <div className={styles.heroStats}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>+64%</div>
          <div className={styles.statLabel}>chat engagement</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>Live</div>
          <div className={styles.statLabel}>ai-driven callouts</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>Seconds</div>
          <div className={styles.statLabel}>to publish overlays</div>
        </div>
      </div>
    </div>
    <div className={styles.heroVisual}>
      <OverlayShowcase showCaption={false} layoutOverride="vertical" />
    </div>
  </section>
);

export default HeroSection;
