import type { Metadata } from "next";
import MarketingLayout from "@/components/layout/MarketingLayout";
import HeroSection from "@/components/landing/HeroSection";
import OverlayGallery from "@/components/landing/OverlayGallery";
import BenefitsSection from "@/components/landing/BenefitsSection";
import FunnelSection from "@/components/landing/FunnelSection";
import IntegrationSection from "@/components/landing/IntegrationSection";
import CTASection from "@/components/landing/CTASection";

export const metadata: Metadata = {
  title: "ai_licia® overlays | Live leaderboard & chat pulse widgets",
  description:
    "Showcase your top chatters and real-time message rate with AI overlays powered by ai_licia®. Export-ready for Twitch overlays, TikTok overlays, OBS overlays, and every streaming overlay workflow.",
  keywords: [
    "ai_licia overlays",
    "twitch overlay",
    "tiktok overlay",
    "ai overlay",
    "live chat leaderboard",
    "message rate widget",
    "obs overlay",
    "streaming overlay",
  ],
  openGraph: {
    title: "ai_licia overlays",
    description:
      "Modern, AI-powered overlays that spotlight top chatters and the live message pulse across Twitch, TikTok, and OBS.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ai_licia overlays",
    description:
      "Launch chat leaderboards and msg/min cards powered by ai_licia® for Twitch, TikTok, and OBS.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "ai_licia Overlay Studio",
  description:
    "A Next.js overlay pack that renders top chatter leaderboards and live message-rate cards powered by ai_licia for Twitch, TikTok, and OBS.",
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
  url: "https://getailicia.com/overlays",
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
