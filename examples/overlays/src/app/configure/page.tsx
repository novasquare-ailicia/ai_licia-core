import type { Metadata } from "next";
import MarketingLayout from "@/components/layout/MarketingLayout";
import Configurator from "@/components/Configurator";

export const metadata: Metadata = {
  title: "Configure ai_licia® top chatters overlay",
  description:
    "Generate a modern leaderboard overlay that highlights your most active viewers, powered by ai_licia®.",
};

const ConfigurePage = () => (
  <MarketingLayout>
    <Configurator variant="leaderboard" />
  </MarketingLayout>
);

export default ConfigurePage;
