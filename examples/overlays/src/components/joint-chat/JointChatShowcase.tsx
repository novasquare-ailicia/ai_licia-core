"use client";

import { useEffect, useMemo, useState } from "react";
import type { Platform } from "ai_licia-client";
import {
  buildEnabledToggleMap,
  JOINT_CHAT_CHANNEL_EVENT_CATEGORIES,
  JOINT_CHAT_DEFAULT_CHAT_VISIBLE_MS,
  JOINT_CHAT_DEFAULT_ENTRY_ANIMATION_MS,
  JOINT_CHAT_DEFAULT_EVENT_VISIBLE_MS,
  JOINT_CHAT_DEFAULT_EXIT_ANIMATION_MS,
  JOINT_CHAT_EVENT_TYPES,
  resolveJointChatUsernameColor,
  type JointChatOverlaySettings,
} from "@/lib/jointChatOverlay";
import { DEFAULT_BASE_URL } from "@/lib/overlay";
import JointChatOverlayView from "./JointChatOverlayView";
import type { JointChatFeedItem } from "./types";

const DEMO_USERS = [
  "Youbarbapapa",
  "Jellabn",
  "FunFamilyGaming",
  "VibeRaider",
  "PixelPilot",
  "MythicMara",
  "EchoBlade",
  "KoiNebula",
];

const PLATFORM_ORDER: Platform[] = ["TWITCH", "KICK", "YOUTUBE", "TIKTOK"];

const CHANNEL_EVENT_MESSAGES = [
  "follow",
  "subscription",
  "cheer",
  "raid",
] as const;

const CHAT_MESSAGES = [
  "This overlay is clean.",
  "Love the combined chat feed.",
  "Cross-platform chat is finally readable.",
  "That event animation is smooth.",
  "Can we keep this on the main scene?",
  "LFG team!",
  "This looks awesome on OBS.",
];

const buildDemoItem = (index: number): JointChatFeedItem => {
  const username = DEMO_USERS[index % DEMO_USERS.length];
  const platform = PLATFORM_ORDER[index % PLATFORM_ORDER.length];
  const chatMode = index % 4 !== 0;
  const status = index % 3 === 0 ? ["VIP"] : [];

  if (chatMode) {
    return {
      id: `demo-chat-${index}-${Date.now()}`,
      kind: "chat",
      platform,
      username,
      usernameColor: resolveJointChatUsernameColor(username),
      message: CHAT_MESSAGES[index % CHAT_MESSAGES.length],
      statusChips: status,
      emphasized: false,
      ingestedAt: Date.now(),
      leaving: false,
    };
  }

  const category = CHANNEL_EVENT_MESSAGES[index % CHANNEL_EVENT_MESSAGES.length];
  return {
    id: `demo-event-${index}-${Date.now()}`,
    kind: "event",
    platform,
    username,
    usernameColor: resolveJointChatUsernameColor(username),
    message: `New ${category.replace("_", " ")} event`,
    statusChips: [category.replace("_", " ")],
    emphasized: true,
    ingestedAt: Date.now(),
    leaving: false,
  };
};

const demoSettings: JointChatOverlaySettings = {
  apiKey: "demo",
  channelName: "demo_channel",
  baseUrl: DEFAULT_BASE_URL,
  platforms: PLATFORM_ORDER,
  showStatusChips: true,
  maxItems: 6,
  chatVisibleMs: JOINT_CHAT_DEFAULT_CHAT_VISIBLE_MS,
  eventVisibleMs: JOINT_CHAT_DEFAULT_EVENT_VISIBLE_MS,
  entryAnimationMs: JOINT_CHAT_DEFAULT_ENTRY_ANIMATION_MS,
  exitAnimationMs: JOINT_CHAT_DEFAULT_EXIT_ANIMATION_MS,
  hideStreamerMessages: false,
  profanityFilterEnabled: false,
  eventToggles: buildEnabledToggleMap(JOINT_CHAT_EVENT_TYPES),
  channelEventToggles: buildEnabledToggleMap(JOINT_CHAT_CHANNEL_EVENT_CATEGORIES),
};

const JointChatShowcase = () => {
  const [items, setItems] = useState<JointChatFeedItem[]>(() =>
    Array.from({ length: 4 }, (_, index) => buildDemoItem(index))
  );

  useEffect(() => {
    let tick = 4;
    const timer = setInterval(() => {
      tick += 1;
      const next = buildDemoItem(tick);
      setItems((prev) => {
        const combined = [...prev, next];
        if (combined.length <= demoSettings.maxItems) return combined;
        return combined.slice(combined.length - demoSettings.maxItems);
      });
    }, 1900);

    return () => clearInterval(timer);
  }, []);

  const previewItems = useMemo(() => items, [items]);

  return (
    <JointChatOverlayView
      settings={demoSettings}
      variant="preview"
      disableStream
      initialItems={previewItems}
    />
  );
};

export default JointChatShowcase;
