import type { Metadata } from "next";
import MarketingLayout from "@/components/layout/MarketingLayout";
import Configurator from "@/components/Configurator";

export const metadata: Metadata = {
  title: "Configure ai_licia® message rate cards",
  description:
    "Build a standalone message-per-minute card to signal chat hype or embed it inside the leaderboard overlay.",
};

const MessageRatePage = () => (
  <MarketingLayout>
    <Configurator variant="message-rate" />
  </MarketingLayout>
);

export default MessageRatePage;
