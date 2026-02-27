import type { Metadata } from "next";
import MarketingLayout from "@/components/layout/MarketingLayout";
import HeroSection from "@/components/landing/HeroSection";
import OverlayGallery from "@/components/landing/OverlayGallery";
import BenefitsSection from "@/components/landing/BenefitsSection";
import FunnelSection from "@/components/landing/FunnelSection";
import IntegrationSection from "@/components/landing/IntegrationSection";
import CTASection from "@/components/landing/CTASection";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://overlays.getailicia.com";
const SHARE_IMAGE = `${SITE_URL}/logo.png`;

export const metadata: Metadata = {
  title: "ai_licia® overlays | Leaderboard, message pulse, and joint chat",
  description:
    "Showcase top chatters, real-time message rate, and a unified cross-platform joint-chat feed with AI overlays powered by ai_licia®.",
  keywords: [
    "ai_licia overlays",
    "twitch overlay",
    "tiktok overlay",
    "kick overlay",
    "youtube overlay",
    "ai overlay",
    "live chat leaderboard",
    "message rate widget",
    "joint chat overlay",
    "obs overlay",
    "streaming overlay",
  ],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "ai_licia overlays",
    description:
      "Modern AI-powered overlays for leaderboard, live message pulse, and unified EventSub chat/events across Twitch, Kick, YouTube, and TikTok.",
    url: SITE_URL,
    images: [
      {
        url: SHARE_IMAGE,
        width: 1200,
        height: 630,
        alt: "ai_licia overlays preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ai_licia overlays",
    description:
      "Launch leaderboard, msg/min, and joint-chat overlays powered by ai_licia® for Twitch, Kick, YouTube, TikTok, and OBS.",
    images: [SHARE_IMAGE],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "ai_licia Overlay Studio",
  description:
    "A Next.js overlay pack with top chatter leaderboards, message-rate cards, and a unified multi-platform joint-chat/EventSub feed.",
  brand: {
    "@type": "Brand",
    name: "ai_licia",
  },
  category: "SoftwareApplication",
  operatingSystem: "Any (browser source)",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  url: SITE_URL,
  image: SHARE_IMAGE,
  logo: `${SITE_URL}/logo-icon-purple.svg`,
};

export default function Home() {
  return (
    <MarketingLayout>
      <HeroSection />
      <OverlayGallery />
      <BenefitsSection />
      <FunnelSection />
      <IntegrationSection />
      <CTASection />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </MarketingLayout>
  );
}
