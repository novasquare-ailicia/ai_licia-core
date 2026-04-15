import Link from "next/link";
import OverlayShowcase from "@/components/OverlayShowcase";
import JointChatShowcase from "@/components/joint-chat/JointChatShowcase";
import LanguageWarShowcase from "@/components/language-war/LanguageWarShowcase";
import type { OverlayLayout } from "@/lib/overlay";
import styles from "./LandingSections.module.css";

type OverlayCard = {
  id: string;
  pill: string;
  badge?: string;
  title: string;
  description: string;
  bullets: string[];
  cta: { href: string; label: string };
  variant: "leaderboard" | "message-rate" | "joint-chat" | "language-war";
  layoutOverride?: OverlayLayout;
};

const overlayCards: OverlayCard[] = [
  {
    id: "joint-chat",
    pill: "Unified chat + events",
    title: "Joint chat overlay",
    description:
      "Merge Twitch, Kick, YouTube, and TikTok chat with ai_licia events in one feed, with typed toggles and animation timing controls.",
    bullets: [
      "Platform icon chips and optional status chips per row",
      "ai_licia event filters, including channel-event category toggles",
      "Profanity masking toggle and deterministic username colors",
    ],
    cta: { href: "/configure/joint-chat", label: "Configure joint chat" },
    variant: "joint-chat" as const,
  },
  {
    id: "language-war",
    pill: "Timed language battle",
    badge: "Beta",
    title: "Language war overlay",
    description:
      "Multilingual stream? Activate your community with a friendly battle to see which language wins the round.",
    bullets: [
      "Chat Messages language counts with timed round resets",
      "Language Leaderboard updating in real time",
      "Ideal for multilingual communities, watch parties, and community contests",
    ],
    cta: { href: "/configure/language-war", label: "Configure language war" },
    variant: "language-war" as const,
  },
  {
    id: "leaderboard",
    pill: "Top chatters",
    title: "Realtime leaderboard overlay",
    description:
      "ai_licia spotlights the fastest chatters, rotates glow states, and syncs with ai_licia for personalised callouts.",
    bullets: [
      "Configurable roles (like VIP, Mods, Viewers)",
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
      "Include the activity of your chat into your content",
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
        Three overlays, one workflow. Mix leaderboard cards, message pulse, and
        the unified joint-chat feed to cover every scene without duplicate
        browser sources.
      </p>
    </div>
    <div className={styles.galleryGrid}>
      {overlayCards.map((overlay) => (
        <article
          key={overlay.id}
          className={`${styles.galleryCard} ${
            overlay.id === "joint-chat" ? styles.galleryCardFeatured : ""
          }`}
        >
          <span className={styles.cardPill}>{overlay.pill}</span>
          <div className={styles.cardHeading}>
            <h3>{overlay.title}</h3>
            {overlay.badge ? (
              <span className={styles.cardBadge}>{overlay.badge}</span>
            ) : null}
          </div>
          <p>{overlay.description}</p>
          <div className={styles.galleryPreview}>
            {overlay.variant === "joint-chat" ? (
              <JointChatShowcase />
            ) : overlay.variant === "language-war" ? (
              <LanguageWarShowcase />
            ) : (
              <OverlayShowcase
                variant={overlay.variant}
                showCaption={false}
                layoutOverride={overlay.layoutOverride}
              />
            )}
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
