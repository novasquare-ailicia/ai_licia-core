"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  EventSubAiModerationPayload,
  EventSubAiThoughtsPayload,
  EventSubAiTtsGeneratedPayload,
  EventSubApiEventPayload,
  EventSubChannelEventPayload,
  EventSubCharacterUpdatedPayload,
  EventSubChatAiMessagePayload,
  EventSubChatFirstMessagePayload,
  EventSubChatMessagePayload,
  EventSubEvent,
  EventSubEventType,
  EventSubSystemJoinPayload,
  EventSubSystemLeftPayload,
  Platform,
} from "ai_licia-client";
import { AiliciaClient } from "ai_licia-client";
import {
  formatChannelEventMessage,
  isStreamerCaptionChannelEvent,
  JOINT_CHAT_CHANNEL_EVENT_LABELS,
  JOINT_CHAT_EVENT_LABELS,
  JOINT_CHAT_EVENT_TYPES,
  resolveJointChatUsernameColor,
  type JointChatOverlaySettings,
  resolveChannelEventCategory,
} from "@/lib/jointChatOverlay";
import type { StreamStatus } from "@/components/overlay/types";
import type { JointChatFeedItem } from "./types";

const DEFAULT_PROFANITY_LIST = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "damn",
  "wtf",
];

const MAX_MESSAGE_LENGTH = 240;

interface JointChatHookOptions {
  settings: JointChatOverlaySettings;
  disabled?: boolean;
  onStatusChange?: (status: StreamStatus, info: string) => void;
}

const truncate = (value: string, maxLength = MAX_MESSAGE_LENGTH) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;

const sanitizeProfanity = (value: string, enabled: boolean) => {
  if (!enabled || !value.trim()) return value;

  return DEFAULT_PROFANITY_LIST.reduce((output, term) => {
    const expression = new RegExp(`\\b${term}\\b`, "gi");
    return output.replace(expression, (match) => "*".repeat(match.length));
  }, value);
};

const resolvePlatform = (event: EventSubEvent): Platform => {
  if (event.type === "chat.message") {
    const payload = event.payload as EventSubChatMessagePayload;
    return payload.platform;
  }
  return event.channel.platform;
};

const buildStatusChips = (event: EventSubEvent): string[] => {
  switch (event.type) {
    case "chat.message": {
      const payload = event.payload as EventSubChatMessagePayload;
      const chips: string[] = [];
      if (payload.isSubscriber) chips.push("Sub");
      if (payload.isVip) chips.push("VIP");
      if (payload.isModerator) chips.push("Mod");
      return chips;
    }
    case "chat.ai_message":
      return ["AI"];
    case "chat.first_message":
      return ["First"];
    case "channel.event": {
      const payload = event.payload as EventSubChannelEventPayload;
      const category = resolveChannelEventCategory(payload.eventType);
      if (!category) return [];
      return [JOINT_CHAT_CHANNEL_EVENT_LABELS[category]];
    }
    case "ai.moderation": {
      const payload = event.payload as EventSubAiModerationPayload;
      return [payload.isAppropriate ? "Allowed" : "Flagged"];
    }
    default:
      return [JOINT_CHAT_EVENT_LABELS[event.type]];
  }
};

const toFeedItem = (
  event: EventSubEvent,
  settings: JointChatOverlaySettings
): JointChatFeedItem | null => {
  const platform = resolvePlatform(event);
  if (!settings.platforms.includes(platform)) return null;
  if (!settings.eventToggles[event.type]) return null;

  let username = event.channel.name;
  let message = "";
  let kind: JointChatFeedItem["kind"] = "event";
  let emphasized = false;

  switch (event.type) {
    case "chat.message": {
      const payload = event.payload as EventSubChatMessagePayload;
      username = payload.username;
      message = payload.message;
      kind = "chat";
      break;
    }
    case "chat.ai_message": {
      const payload = event.payload as EventSubChatAiMessagePayload;
      username = payload.username || "ai_licia";
      message = payload.message;
      kind = "chat";
      break;
    }
    case "chat.first_message": {
      const payload = event.payload as EventSubChatFirstMessagePayload;
      username = payload.username;
      message = payload.greeting || `${payload.username} says hello`;
      emphasized = true;
      break;
    }
    case "channel.event": {
      const payload = event.payload as EventSubChannelEventPayload;
      if (isStreamerCaptionChannelEvent(payload.eventType)) {
        return null;
      }
      const category = resolveChannelEventCategory(payload.eventType);
      if (!category || !settings.channelEventToggles[category]) return null;
      username = payload.username || payload.gifter || event.channel.name;
      message = formatChannelEventMessage(payload) ?? "";
      if (!message) return null;
      emphasized = true;
      break;
    }
    case "channel.go_live":
      username = event.channel.name;
      message = `${event.channel.name} just went live`;
      emphasized = true;
      break;
    case "channel.go_offline":
      username = event.channel.name;
      message = `${event.channel.name} ended the stream`;
      emphasized = true;
      break;
    case "ai.moderation": {
      const payload = event.payload as EventSubAiModerationPayload;
      username = payload.username;
      message = payload.isAppropriate
        ? "Message approved by moderation"
        : `Flagged message: ${payload.originalMessage}`;
      break;
    }
    case "ai.thoughts": {
      const payload = event.payload as EventSubAiThoughtsPayload;
      username = "ai_licia";
      message = payload.reasoning;
      break;
    }
    case "ai.tts.generated": {
      const payload = event.payload as EventSubAiTtsGeneratedPayload;
      username = payload.username;
      message = `Generated TTS clip (${payload.audioFormat})`;
      break;
    }
    case "api.event": {
      const payload = event.payload as EventSubApiEventPayload;
      username = "API";
      message = payload.content || payload.eventType;
      break;
    }
    case "system.join": {
      const payload = event.payload as EventSubSystemJoinPayload;
      username = payload.channelName;
      message = "ai_licia joined the channel";
      break;
    }
    case "system.left": {
      const payload = event.payload as EventSubSystemLeftPayload;
      username = payload.channelName;
      message = "ai_licia left the channel";
      break;
    }
    case "character.updated": {
      const payload = event.payload as EventSubCharacterUpdatedPayload;
      username = "Character";
      message = `Switched to ${payload.displayName}`;
      break;
    }
    default:
      return null;
  }

  const ingestedAt = Date.now();
  const cleanedMessage = truncate(
    sanitizeProfanity(message, settings.profanityFilterEnabled)
  );
  const statusChips = settings.showStatusChips ? buildStatusChips(event) : [];

  return {
    id: `${event.id}-${ingestedAt}-${Math.random().toString(16).slice(2)}`,
    kind,
    platform,
    username,
    usernameColor: resolveJointChatUsernameColor(username),
    message: cleanedMessage,
    statusChips,
    emphasized,
    ingestedAt,
    leaving: false,
  };
};

export const useJointChatStream = ({
  settings,
  disabled = false,
  onStatusChange,
}: JointChatHookOptions) => {
  const [items, setItems] = useState<JointChatFeedItem[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Add your ai_licia API key and channel to start EventSub."
  );
  const timersRef = useRef<
    Map<string, { leaveTimer: ReturnType<typeof setTimeout>; removeTimer: ReturnType<typeof setTimeout> }>
  >(new Map());

  const hasCredentials = useMemo(
    () => Boolean(settings.apiKey && settings.channelName),
    [settings.apiKey, settings.channelName]
  );

  const emitStatus = useCallback(
    (nextStatus: StreamStatus, info: string) => {
      setStatus(nextStatus);
      setStatusMessage(info);
      onStatusChange?.(nextStatus, info);
    },
    [onStatusChange]
  );

  const clearItemTimers = useCallback((id: string) => {
    const active = timersRef.current.get(id);
    if (!active) return;
    clearTimeout(active.leaveTimer);
    clearTimeout(active.removeTimer);
    timersRef.current.delete(id);
  }, []);

  const scheduleLifecycle = useCallback(
    (item: JointChatFeedItem) => {
      const visibleMs =
        item.kind === "chat" ? settings.chatVisibleMs : settings.eventVisibleMs;
      const leaveTimer = setTimeout(() => {
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id ? { ...entry, leaving: true } : entry
          )
        );
      }, visibleMs);
      const removeTimer = setTimeout(() => {
        setItems((prev) => prev.filter((entry) => entry.id !== item.id));
        timersRef.current.delete(item.id);
      }, visibleMs + settings.exitAnimationMs);
      timersRef.current.set(item.id, { leaveTimer, removeTimer });
    },
    [settings.chatVisibleMs, settings.eventVisibleMs, settings.exitAnimationMs]
  );

  const pushItem = useCallback(
    (item: JointChatFeedItem) => {
      scheduleLifecycle(item);
      setItems((prev) => {
        const sorted = [...prev, item].sort((a, b) => a.ingestedAt - b.ingestedAt);
        if (sorted.length <= settings.maxItems) return sorted;
        const overflow = sorted.length - settings.maxItems;
        const dropped = sorted.slice(0, overflow);
        dropped.forEach((entry) => clearItemTimers(entry.id));
        return sorted.slice(overflow);
      });
    },
    [clearItemTimers, scheduleLifecycle, settings.maxItems]
  );

  useEffect(() => {
    if (disabled) {
      const frame = requestAnimationFrame(() =>
        emitStatus("idle", "Preview mode")
      );
      return () => cancelAnimationFrame(frame);
    }

    if (!hasCredentials) {
      const frame = requestAnimationFrame(() =>
        emitStatus("idle", "Add your ai_licia API key and channel to connect.")
      );
      return () => cancelAnimationFrame(frame);
    }

    const connectFrame = requestAnimationFrame(() =>
      emitStatus("connecting", "Connecting to EventSub...")
    );

    const client = new AiliciaClient(
      settings.apiKey,
      settings.channelName,
      settings.baseUrl
    );
    const stream = client.streamEventSub(
      { type: "apiKey", key: settings.apiKey },
      {
        types: [...(JOINT_CHAT_EVENT_TYPES as readonly EventSubEventType[])],
        onConnectionStateChange: (connectionState) => {
          if (connectionState === "reconnecting") {
            emitStatus("connecting", "Reconnecting to EventSub...");
            return;
          }
          emitStatus("connecting", "Connecting to EventSub...");
        },
        onOpen: () => emitStatus("connected", "Connected to EventSub"),
        onError: (error) => emitStatus("error", error.message),
        onClose: () => emitStatus("idle", "Disconnected from EventSub"),
      }
    );

    const handler = (event: EventSubEvent) => {
      const item = toFeedItem(event, settings);
      if (!item) return;
      pushItem(item);
    };

    stream.onAny(handler);

    return () => {
      cancelAnimationFrame(connectFrame);
      stream.offAny(handler);
      stream.close();
    };
  }, [
    disabled,
    emitStatus,
    hasCredentials,
    pushItem,
    settings,
  ]);

  useEffect(
    () => () => {
      timersRef.current.forEach((entry) => {
        clearTimeout(entry.leaveTimer);
        clearTimeout(entry.removeTimer);
      });
      timersRef.current.clear();
    },
    []
  );

  return {
    items,
    status,
    statusMessage,
  };
};
