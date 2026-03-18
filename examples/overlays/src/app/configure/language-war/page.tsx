import type { Metadata } from "next";
import MarketingLayout from "@/components/layout/MarketingLayout";
import LanguageWarConfigurator from "@/components/LanguageWarConfigurator";

export const metadata: Metadata = {
  title: "Configure ai_licia® language war overlay",
  description:
    "Build a timed language battle overlay powered by ai_licia chat message language detection.",
};

const LanguageWarConfigurePage = () => (
  <MarketingLayout>
    <LanguageWarConfigurator />
  </MarketingLayout>
);

export default LanguageWarConfigurePage;
