import Link from "next/link";
import OverlayShowcase from "@/components/OverlayShowcase";
import SmoothAnchor from "@/components/SmoothAnchor";
import styles from "./LandingSections.module.css";

const HeroSection = () => (
  <section className={`${styles.section} ${styles.hero}`} id="hero">
    <div className={styles.heroContent}>
      <span className="tagline">Realtime AI overlays for creators</span>
      <h1 className={styles.heroTitle}>
        Increase your chat engagement with the ai_licia® overlays!
      </h1>
      <p className={styles.heroLead}>
        Customise our OBS-ready overlays that work for Twitch, Kick, YouTube, and TikTok and support Multi Stream.
        Create engagement games, keep track of your chat, and create a more interactive experience for your viewers!
      </p>
      <div className={styles.heroActions}>
        <Link href="/configure" className={styles.primaryButton}>
          Get Started with our overlays →
        </Link>
        <Link href="/configure/language-war" className={styles.primaryButton}>
          Configure language war
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
          <div className={styles.statLabel}>ai-enhanced experience</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>Seconds</div>
          <div className={styles.statLabel}>to customise overlays</div>
        </div>
      </div>
    </div>
    <div className={styles.heroVisual}>
      <OverlayShowcase showCaption={false} layoutOverride="vertical" />
    </div>
  </section>
);

export default HeroSection;
