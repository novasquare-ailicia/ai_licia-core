import type { Metadata } from "next";
import MarketingLayout from "@/components/layout/MarketingLayout";
import JointChatConfigurator from "@/components/JointChatConfigurator";

export const metadata: Metadata = {
  title: "Configure ai_licia® joint chat overlay",
  description:
    "Build a unified cross-platform chat and EventSub overlay with typed controls for filters, timing, and animations.",
};

const JointChatConfigurePage = () => (
  <MarketingLayout>
    <JointChatConfigurator />
  </MarketingLayout>
);

export default JointChatConfigurePage;
