import type {
  EventSubChannelEventPayload,
  EventSubEventType,
  Platform,
} from "ai_licia-client";
import { DEFAULT_BASE_URL } from "@/lib/overlay";

export const JOINT_CHAT_SUPPORTED_PLATFORMS = [
  "TWITCH",
  "KICK",
  "YOUTUBE",
  "TIKTOK",
] as const satisfies readonly Platform[];

export const JOINT_CHAT_EVENT_TYPES = [
  "chat.message",
  "chat.ai_message",
  "chat.first_message",
  "ai.thoughts",
  "ai.tts.generated",
  "channel.event",
  "channel.go_live",
  "channel.go_offline",
  "ai.moderation",
  "system.join",
  "system.left",
  "character.updated",
] as const satisfies readonly EventSubEventType[];

export type JointChatEventType = (typeof JOINT_CHAT_EVENT_TYPES)[number];

export type JointChatEventToggles = Record<JointChatEventType, boolean>;

export const JOINT_CHAT_EVENT_LABELS: Record<JointChatEventType, string> = {
  "chat.message": "Chat message",
  "chat.ai_message": "AI message",
  "chat.first_message": "First message",
  "ai.thoughts": "AI thoughts",
  "ai.tts.generated": "AI TTS generated",
  "channel.event": "Channel event",
  "channel.go_live": "Go live",
  "channel.go_offline": "Go offline",
  "ai.moderation": "Moderation",
  "system.join": "System join",
  "system.left": "System leave",
  "character.updated": "Character update",
};

export const JOINT_CHAT_CHANNEL_EVENT_CATEGORIES = [
  "follow",
  "subscription",
  "cheer",
  "raid",
] as const;

export type JointChatChannelEventCategory =
  (typeof JOINT_CHAT_CHANNEL_EVENT_CATEGORIES)[number];

export type JointChatChannelEventToggles = Record<
  JointChatChannelEventCategory,
  boolean
>;

export const JOINT_CHAT_CHANNEL_EVENT_LABELS: Record<
  JointChatChannelEventCategory,
  string
> = {
  follow: "Follow",
  subscription: "Subscription",
  cheer: "Cheer",
  raid: "Raid",
};

export const JOINT_CHAT_DEFAULT_MAX_ITEMS = 12;
export const JOINT_CHAT_DEFAULT_CHAT_VISIBLE_MS = 9000;
export const JOINT_CHAT_DEFAULT_EVENT_VISIBLE_MS = 12000;
export const JOINT_CHAT_DEFAULT_ENTRY_ANIMATION_MS = 280;
export const JOINT_CHAT_DEFAULT_EXIT_ANIMATION_MS = 280;
export const JOINT_CHAT_DEFAULT_SHOW_STATUS_CHIPS = true;
export const JOINT_CHAT_DEFAULT_PROFANITY_FILTER = false;
export const JOINT_CHAT_DEFAULT_HIDE_STREAMER_MESSAGES = false;
export const JOINT_CHAT_USERNAME_COLORS = [
  "#f97316",
  "#22d3ee",
  "#f59e0b",
  "#84cc16",
  "#38bdf8",
  "#f472b6",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#60a5fa",
  "#fbbf24",
  "#2dd4bf",
] as const;

export interface JointChatOverlaySettings {
  apiKey: string;
  channelName: string;
  baseUrl: string;
  platforms: Platform[];
  showStatusChips: boolean;
  hideStreamerMessages: boolean;
  maxItems: number;
  chatVisibleMs: number;
  eventVisibleMs: number;
  entryAnimationMs: number;
  exitAnimationMs: number;
  profanityFilterEnabled: boolean;
  eventToggles: JointChatEventToggles;
  channelEventToggles: JointChatChannelEventToggles;
}

export const buildEnabledToggleMap = <TItem extends string>(
  items: readonly TItem[]
) =>
  items.reduce(
    (acc, item) => ({
      ...acc,
      [item]: true,
    }),
    {} as Record<TItem, boolean>
  );

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parseNumberInRange = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const parseList = (value?: string | null) =>
  value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const buildDefaultEventToggles = (): JointChatEventToggles =>
  buildEnabledToggleMap(JOINT_CHAT_EVENT_TYPES);

const buildDefaultChannelEventToggles = (): JointChatChannelEventToggles =>
  buildEnabledToggleMap(JOINT_CHAT_CHANNEL_EVENT_CATEGORIES);

export const resolveJointChatUsernameColor = (username: string) => {
  let hash = 0;
  const normalized = username.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % JOINT_CHAT_USERNAME_COLORS.length;
  return JOINT_CHAT_USERNAME_COLORS[index];
};

const normalizeBaseUrl = (value?: string) => {
  const raw = (value ?? DEFAULT_BASE_URL).trim();
  if (!raw) return DEFAULT_BASE_URL;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

const normalizeChannelEventType = (eventType?: string | null) =>
  (eventType ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.\s-]+/g, "_");

export const normalizeJointChatIdentity = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();

export const isStreamerCaptionChannelEvent = (eventType?: string | null) => {
  const normalized = normalizeChannelEventType(eventType);
  if (!normalized) return false;
  return (
    normalized.includes("caption") &&
    (normalized.includes("streamer") ||
      normalized.includes("subtitle") ||
      normalized.includes("closed"))
  );
};

export const resolveChannelEventCategory = (
  eventType?: string | null
): JointChatChannelEventCategory | null => {
  const normalized = normalizeChannelEventType(eventType);
  if (!normalized) return null;
  if (normalized === "follow") return "follow";
  if (normalized === "subscription") {
    return "subscription";
  }
  if (normalized === "raid") return "raid";
  if (normalized === "cheer") return "cheer";
  return null;
};

export const formatChannelEventMessage = (
  payload: EventSubChannelEventPayload
) => {
  const category = resolveChannelEventCategory(payload.eventType);
  if (!category) return null;
  const actor = payload.username ?? payload.gifter ?? "A viewer";
  const value = payload.value ?? payload.count;
  const count = payload.count ?? payload.value;
  const raidViewers = payload.raidViewers ?? payload.value ?? payload.count;

  switch (category) {
    case "follow":
      return `${actor} just followed`;
    case "subscription":
      if (count && count > 1) return `${actor} subscribed (${count} months)`;
      return `${actor} subscribed`;
    case "cheer":
      if (value && value > 0) return `${actor} cheered ${value} bits`;
      return `${actor} sent bits`;
    case "raid":
      if (raidViewers && raidViewers > 0) {
        return `${actor} raided with ${raidViewers} viewers`;
      }
      return `${actor} raided the channel`;
  }
};

const parseEventToggles = (
  disabledEventsParam: string
): JointChatEventToggles => {
  const disabled = new Set(
    parseList(disabledEventsParam).filter((entry): entry is JointChatEventType =>
      JOINT_CHAT_EVENT_TYPES.includes(entry as JointChatEventType)
    )
  );
  const toggles = buildDefaultEventToggles();
  JOINT_CHAT_EVENT_TYPES.forEach((eventType) => {
    toggles[eventType] = !disabled.has(eventType);
  });
  return toggles;
};

const parseChannelEventToggles = (
  disabledCategoriesParam: string
): JointChatChannelEventToggles => {
  const disabled = new Set(
    parseList(disabledCategoriesParam).filter(
      (entry): entry is JointChatChannelEventCategory =>
        JOINT_CHAT_CHANNEL_EVENT_CATEGORIES.includes(
          entry as JointChatChannelEventCategory
        )
    )
  );
  const toggles = buildDefaultChannelEventToggles();
  JOINT_CHAT_CHANNEL_EVENT_CATEGORIES.forEach((category) => {
    toggles[category] = !disabled.has(category);
  });
  return toggles;
};

const parsePlatforms = (value?: string) => {
  const parsed = parseList(value).filter((entry): entry is Platform =>
    JOINT_CHAT_SUPPORTED_PLATFORMS.includes(entry as Platform)
  );
  return parsed.length ? parsed : [...JOINT_CHAT_SUPPORTED_PLATFORMS];
};

const serializeDisabledToggles = <TKey extends string>(
  toggleMap: Partial<Record<TKey, boolean>>,
  keys: readonly TKey[]
) =>
  keys.filter((key) => toggleMap[key] === false).join(",");

const allEnabled = <TKey extends string>(
  toggleMap: Partial<Record<TKey, boolean>>,
  keys: readonly TKey[]
) => keys.every((key) => toggleMap[key] !== false);

const samePlatformSet = (a: Platform[], b: readonly Platform[]) =>
  a.length === b.length &&
  a.every((platform) => b.includes(platform)) &&
  b.every((platform) => a.includes(platform));

export const buildJointChatOverlayQuery = (
  settings: JointChatOverlaySettings
) => {
  const params = new URLSearchParams();

  if (settings.apiKey) params.set("apiKey", settings.apiKey);
  if (settings.channelName) params.set("channel", settings.channelName);
  if (settings.baseUrl && settings.baseUrl !== DEFAULT_BASE_URL) {
    params.set("baseUrl", settings.baseUrl);
  }
  if (
    settings.platforms.length &&
    !samePlatformSet(settings.platforms, JOINT_CHAT_SUPPORTED_PLATFORMS)
  ) {
    params.set("platforms", settings.platforms.join(","));
  }
  if (settings.maxItems !== JOINT_CHAT_DEFAULT_MAX_ITEMS) {
    params.set("maxItems", `${settings.maxItems}`);
  }
  if (settings.chatVisibleMs !== JOINT_CHAT_DEFAULT_CHAT_VISIBLE_MS) {
    params.set("chatMs", `${settings.chatVisibleMs}`);
  }
  if (settings.eventVisibleMs !== JOINT_CHAT_DEFAULT_EVENT_VISIBLE_MS) {
    params.set("eventMs", `${settings.eventVisibleMs}`);
  }
  if (settings.entryAnimationMs !== JOINT_CHAT_DEFAULT_ENTRY_ANIMATION_MS) {
    params.set("enterMs", `${settings.entryAnimationMs}`);
  }
  if (settings.exitAnimationMs !== JOINT_CHAT_DEFAULT_EXIT_ANIMATION_MS) {
    params.set("exitMs", `${settings.exitAnimationMs}`);
  }
  if (settings.showStatusChips !== JOINT_CHAT_DEFAULT_SHOW_STATUS_CHIPS) {
    params.set("showStatus", settings.showStatusChips ? "1" : "0");
  }
  if (
    settings.profanityFilterEnabled !== JOINT_CHAT_DEFAULT_PROFANITY_FILTER
  ) {
    params.set("profanity", settings.profanityFilterEnabled ? "1" : "0");
  }
  if (
    settings.hideStreamerMessages !== JOINT_CHAT_DEFAULT_HIDE_STREAMER_MESSAGES
  ) {
    params.set("hideStreamerMessages", settings.hideStreamerMessages ? "1" : "0");
  }
  if (!allEnabled(settings.eventToggles, JOINT_CHAT_EVENT_TYPES)) {
    const disabled = serializeDisabledToggles(
      settings.eventToggles,
      JOINT_CHAT_EVENT_TYPES
    );
    if (disabled) params.set("disabledEvents", disabled);
  }
  if (
    !allEnabled(
      settings.channelEventToggles,
      JOINT_CHAT_CHANNEL_EVENT_CATEGORIES
    )
  ) {
    const disabled = serializeDisabledToggles(
      settings.channelEventToggles,
      JOINT_CHAT_CHANNEL_EVENT_CATEGORIES
    );
    if (disabled) params.set("disabledChannelEvents", disabled);
  }

  return params.toString();
};

export const parseJointChatOverlaySettings = (
  params: Record<string, string | string[] | undefined>
): JointChatOverlaySettings => {
  const pull = (key: string) => {
    const raw = params[key];
    if (Array.isArray(raw)) return raw.at(-1) ?? "";
    return raw ?? "";
  };

  const eventToggles = parseEventToggles(pull("disabledEvents"));
  const channelEventToggles = parseChannelEventToggles(
    pull("disabledChannelEvents")
  );

  return {
    apiKey: pull("apiKey"),
    channelName: pull("channel"),
    baseUrl: normalizeBaseUrl(pull("baseUrl")),
    platforms: parsePlatforms(pull("platforms")),
    showStatusChips: parseBoolean(
      pull("showStatus"),
      JOINT_CHAT_DEFAULT_SHOW_STATUS_CHIPS
    ),
    hideStreamerMessages: parseBoolean(
      pull("hideStreamerMessages"),
      JOINT_CHAT_DEFAULT_HIDE_STREAMER_MESSAGES
    ),
    maxItems: parseNumberInRange(
      pull("maxItems"),
      JOINT_CHAT_DEFAULT_MAX_ITEMS,
      3,
      40
    ),
    chatVisibleMs: parseNumberInRange(
      pull("chatMs"),
      JOINT_CHAT_DEFAULT_CHAT_VISIBLE_MS,
      1500,
      60000
    ),
    eventVisibleMs: parseNumberInRange(
      pull("eventMs"),
      JOINT_CHAT_DEFAULT_EVENT_VISIBLE_MS,
      1500,
      60000
    ),
    entryAnimationMs: parseNumberInRange(
      pull("enterMs"),
      JOINT_CHAT_DEFAULT_ENTRY_ANIMATION_MS,
      80,
      3000
    ),
    exitAnimationMs: parseNumberInRange(
      pull("exitMs"),
      JOINT_CHAT_DEFAULT_EXIT_ANIMATION_MS,
      80,
      3000
    ),
    profanityFilterEnabled: parseBoolean(
      pull("profanity"),
      JOINT_CHAT_DEFAULT_PROFANITY_FILTER
    ),
    eventToggles,
    channelEventToggles,
  };
};
