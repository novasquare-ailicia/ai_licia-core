import Link from "next/link";
import OverlayShowcase from "@/components/OverlayShowcase";
import type { OverlayLayout } from "@/lib/overlay";
import styles from "./LandingSections.module.css";

type OverlayCard = {
  id: string;
  pill: string;
  title: string;
  description: string;
  bullets: string[];
  cta: { href: string; label: string };
  variant: "leaderboard" | "message-rate";
  layoutOverride?: OverlayLayout;
};

const overlayCards: OverlayCard[] = [
  {
    id: "leaderboard",
    pill: "Top chatters",
    title: "Realtime leaderboard overlay",
    description:
      "Ai_licia spotlights the fastest chatters, rotates glow states, and syncs with ai_licia for personalised callouts.",
    bullets: [
      "Configurable roles (AI, Streamer, VIP, Mods, Viewers)",
      "Customisable theme and orientation",
      "Auto-trigger ai_licia shout-outs as the ranking changes",
    ],
    cta: { href: "/configure", label: "Configure leaderboard" },
    layoutOverride: "vertical" as const,
    variant: "leaderboard" as const,
  },
  {
    id: "message-rate",
    pill: "Message pulse",
    title: "Standalone msg/min card",
    description:
      "Drop the rate card into any scene or embed it inside the leaderboard overlay to show the current hype level.",
    bullets: [
      "Ambient glow reacts to the total message rate",
      "Perfect for BRB scenes, hype trains, and watch parties",
      "Powered by the same ai_licia® overlay query builder",
    ],
    cta: { href: "/configure/message-rate", label: "Configure rate cards" },
    variant: "message-rate" as const,
  },
];

const OverlayGallery = () => (
  <section className={`${styles.section} ${styles.gallery}`} id="gallery">
    <div>
      <h2 className={styles.sectionTitle}>Overlay gallery</h2>
      <p className={styles.sectionLead}>
        Two overlays, one workflow. Mix and match the leaderboard and message
        pulse to gamify your chat without extra browser sources-ideal as a
        Twitch overlay, TikTok overlay, or any AI overlay you drop into OBS.
      </p>
    </div>
    <div className={styles.galleryGrid}>
      {overlayCards.map((overlay) => (
        <article key={overlay.id} className={styles.galleryCard}>
          <span className={styles.cardPill}>{overlay.pill}</span>
          <h3>{overlay.title}</h3>
          <p>{overlay.description}</p>
          <div className={styles.galleryPreview}>
            <OverlayShowcase
              variant={overlay.variant}
              showCaption={false}
              compact
              layoutOverride={overlay.layoutOverride}
            />
          </div>
          <ul className={styles.benefitList}>
            {overlay.bullets.map((bullet) => (
              <li key={bullet}>• {bullet}</li>
            ))}
          </ul>
          <Link href={overlay.cta.href} className={styles.primaryButton}>
            {overlay.cta.label}
          </Link>
        </article>
      ))}
    </div>
  </section>
);

export default OverlayGallery;
