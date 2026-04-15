"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Platform } from "ai_licia-client";
import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import JointChatOverlayView from "@/components/joint-chat/JointChatOverlayView";
import JointChatShowcase from "@/components/joint-chat/JointChatShowcase";
import type { StreamStatus } from "@/components/overlay/types";
import { trackEvent } from "@/lib/analytics";
import {
  buildEnabledToggleMap,
  buildJointChatOverlayQuery,
  JOINT_CHAT_CHANNEL_EVENT_CATEGORIES,
  JOINT_CHAT_CHANNEL_EVENT_LABELS,
  JOINT_CHAT_DEFAULT_CHAT_VISIBLE_SECONDS,
  JOINT_CHAT_DEFAULT_ENTRY_ANIMATION_MS,
  JOINT_CHAT_DEFAULT_EVENT_VISIBLE_SECONDS,
  JOINT_CHAT_DEFAULT_EXIT_ANIMATION_MS,
  JOINT_CHAT_DEFAULT_HIDE_STREAMER_MESSAGES,
  JOINT_CHAT_DEFAULT_MAX_ITEMS,
  JOINT_CHAT_DEFAULT_PROFANITY_FILTER,
  JOINT_CHAT_DEFAULT_SHOW_STATUS_CHIPS,
  JOINT_CHAT_EVENT_LABELS,
  JOINT_CHAT_EVENT_TYPES,
  JOINT_CHAT_MAX_VISIBLE_SECONDS,
  JOINT_CHAT_MIN_VISIBLE_SECONDS,
  JOINT_CHAT_SUPPORTED_PLATFORMS,
  type JointChatChannelEventToggles,
  type JointChatEventToggles,
  type JointChatOverlaySettings,
} from "@/lib/jointChatOverlay";
import { DEFAULT_BASE_URL } from "@/lib/overlay";
import styles from "./Configurator.module.css";

const STORAGE_KEY = "ailicia-joint-chat-config-v1";

const DEFAULT_EVENT_TOGGLES: JointChatEventToggles = buildEnabledToggleMap(
  JOINT_CHAT_EVENT_TYPES
);
const DEFAULT_CHANNEL_EVENT_TOGGLES: JointChatChannelEventToggles =
  buildEnabledToggleMap(JOINT_CHAT_CHANNEL_EVENT_CATEGORIES);

const platformLabel: Record<Platform, string> = {
  TWITCH: "Twitch",
  KICK: "Kick",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
};

const JointChatConfigurator = () => {
  const [apiKey, setApiKey] = useState("");
  const [channel, setChannel] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [platforms, setPlatforms] = useState<Platform[]>([
    ...JOINT_CHAT_SUPPORTED_PLATFORMS,
  ]);
  const [maxItems, setMaxItems] = useState(JOINT_CHAT_DEFAULT_MAX_ITEMS);
  const [chatVisibleSeconds, setChatVisibleSeconds] = useState(
    JOINT_CHAT_DEFAULT_CHAT_VISIBLE_SECONDS
  );
  const [eventVisibleSeconds, setEventVisibleSeconds] = useState(
    JOINT_CHAT_DEFAULT_EVENT_VISIBLE_SECONDS
  );
  const [entryAnimationMs, setEntryAnimationMs] = useState(
    JOINT_CHAT_DEFAULT_ENTRY_ANIMATION_MS
  );
  const [exitAnimationMs, setExitAnimationMs] = useState(
    JOINT_CHAT_DEFAULT_EXIT_ANIMATION_MS
  );
  const [showStatusChips, setShowStatusChips] = useState(
    JOINT_CHAT_DEFAULT_SHOW_STATUS_CHIPS
  );
  const [profanityFilterEnabled, setProfanityFilterEnabled] = useState(
    JOINT_CHAT_DEFAULT_PROFANITY_FILTER
  );
  const [hideStreamerMessages, setHideStreamerMessages] = useState(
    JOINT_CHAT_DEFAULT_HIDE_STREAMER_MESSAGES
  );
  const [eventToggles, setEventToggles] = useState<JointChatEventToggles>(
    DEFAULT_EVENT_TOGGLES
  );
  const [channelEventToggles, setChannelEventToggles] =
    useState<JointChatChannelEventToggles>(DEFAULT_CHANNEL_EVENT_TOGGLES);
  const [connectionStatus, setConnectionStatus] = useState<{
    state: StreamStatus;
    message: string;
  }>({ state: "idle", message: "Waiting for credentials" });
  const [copied, setCopied] = useState(false);
  const [didHydrate, setDidHydrate] = useState(false);

  const emitConfiguratorEvent = useCallback(
    (eventName: string, extra?: Record<string, unknown>) => {
      trackEvent(eventName, {
        variant: "joint-chat",
        platformsCount: platforms.length,
        hideStreamerMessages,
        maxItems,
        profanityFilterEnabled,
        ...extra,
      });
    },
    [hideStreamerMessages, maxItems, platforms.length, profanityFilterEnabled]
  );

  useEffect(() => {
    if (didHydrate || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (typeof stored.apiKey === "string") setApiKey(stored.apiKey);
      if (typeof stored.channel === "string") setChannel(stored.channel);
      if (typeof stored.baseUrl === "string") setBaseUrl(stored.baseUrl);
      if (Array.isArray(stored.platforms) && stored.platforms.length) {
        const nextPlatforms = stored.platforms.filter(
          (value: string): value is Platform =>
            JOINT_CHAT_SUPPORTED_PLATFORMS.includes(value as Platform)
        );
        if (nextPlatforms.length) {
          setPlatforms(nextPlatforms);
        }
      }
      if (typeof stored.maxItems === "number") setMaxItems(stored.maxItems);
      if (typeof stored.chatVisibleSeconds === "number") {
        setChatVisibleSeconds(
          Math.min(
            JOINT_CHAT_MAX_VISIBLE_SECONDS,
            Math.max(JOINT_CHAT_MIN_VISIBLE_SECONDS, stored.chatVisibleSeconds)
          )
        );
      } else if (typeof stored.chatVisibleMs === "number") {
        setChatVisibleSeconds(
          Math.min(
            JOINT_CHAT_MAX_VISIBLE_SECONDS,
            Math.max(
              JOINT_CHAT_MIN_VISIBLE_SECONDS,
              Math.round(stored.chatVisibleMs / 1000)
            )
          )
        );
      }
      if (typeof stored.eventVisibleSeconds === "number") {
        setEventVisibleSeconds(
          Math.min(
            JOINT_CHAT_MAX_VISIBLE_SECONDS,
            Math.max(JOINT_CHAT_MIN_VISIBLE_SECONDS, stored.eventVisibleSeconds)
          )
        );
      } else if (typeof stored.eventVisibleMs === "number") {
        setEventVisibleSeconds(
          Math.min(
            JOINT_CHAT_MAX_VISIBLE_SECONDS,
            Math.max(
              JOINT_CHAT_MIN_VISIBLE_SECONDS,
              Math.round(stored.eventVisibleMs / 1000)
            )
          )
        );
      }
      if (typeof stored.entryAnimationMs === "number")
        setEntryAnimationMs(stored.entryAnimationMs);
      if (typeof stored.exitAnimationMs === "number")
        setExitAnimationMs(stored.exitAnimationMs);
      if (typeof stored.showStatusChips === "boolean")
        setShowStatusChips(stored.showStatusChips);
      if (typeof stored.profanityFilterEnabled === "boolean") {
        setProfanityFilterEnabled(stored.profanityFilterEnabled);
      }
      if (typeof stored.hideStreamerMessages === "boolean") {
        setHideStreamerMessages(stored.hideStreamerMessages);
      }
      if (stored.eventToggles) {
        setEventToggles((prev) => ({
          ...prev,
          ...stored.eventToggles,
        }));
      }
      if (stored.channelEventToggles) {
        setChannelEventToggles((prev) => ({
          ...prev,
          ...stored.channelEventToggles,
        }));
      }
    } catch (error) {
      console.warn("Failed to load joint chat settings from storage", error);
    } finally {
      setDidHydrate(true);
    }
  }, [didHydrate]);

  useEffect(() => {
    if (!didHydrate || typeof window === "undefined") return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          apiKey,
          channel,
          baseUrl,
          platforms,
          maxItems,
          chatVisibleSeconds,
          eventVisibleSeconds,
          entryAnimationMs,
          exitAnimationMs,
          showStatusChips,
          profanityFilterEnabled,
          hideStreamerMessages,
          eventToggles,
          channelEventToggles,
        })
      );
    } catch (error) {
      console.warn("Failed to persist joint chat settings", error);
    }
  }, [
    apiKey,
    baseUrl,
    channel,
    chatVisibleSeconds,
    channelEventToggles,
    didHydrate,
    entryAnimationMs,
    eventToggles,
    eventVisibleSeconds,
    exitAnimationMs,
    hideStreamerMessages,
    maxItems,
    platforms,
    profanityFilterEnabled,
    showStatusChips,
  ]);

  const settings: JointChatOverlaySettings = useMemo(
    () => ({
      apiKey,
      channelName: channel,
      baseUrl: baseUrl.trim().replace(/\/$/, "") || DEFAULT_BASE_URL,
      platforms,
      maxItems,
      chatVisibleSeconds,
      eventVisibleSeconds,
      entryAnimationMs,
      exitAnimationMs,
      showStatusChips,
      hideStreamerMessages,
      profanityFilterEnabled,
      eventToggles,
      channelEventToggles,
    }),
    [
      apiKey,
      baseUrl,
      channel,
      chatVisibleSeconds,
      channelEventToggles,
      entryAnimationMs,
      eventToggles,
      eventVisibleSeconds,
      exitAnimationMs,
      hideStreamerMessages,
      maxItems,
      platforms,
      profanityFilterEnabled,
      showStatusChips,
    ]
  );

  const overlayPath = useMemo(() => {
    const params = buildJointChatOverlayQuery(settings);
    return `/overlay/joint-chat${params ? `?${params}` : ""}`;
  }, [settings]);

  const shareableUrl = useMemo(() => {
    if (typeof window === "undefined") return overlayPath;
    return `${window.location.origin}${overlayPath}`;
  }, [overlayPath]);

  const togglePlatform = (platform: Platform) => {
    const isEnabled = platforms.includes(platform);
    if (isEnabled && platforms.length === 1) return;
    const nextPlatforms = isEnabled
      ? platforms.filter((entry) => entry !== platform)
      : [...platforms, platform];
    setPlatforms(nextPlatforms);
    emitConfiguratorEvent("overlay_joint_chat_platform_toggle", {
      platform,
      enabled: !isEnabled,
      platformsCount: nextPlatforms.length,
    });
  };

  const toggleEvent = (eventType: (typeof JOINT_CHAT_EVENT_TYPES)[number]) => {
    setEventToggles((prev) => {
      const next = { ...prev, [eventType]: !prev[eventType] };
      emitConfiguratorEvent("overlay_joint_chat_event_toggle", {
        eventType,
        enabled: next[eventType],
      });
      return next;
    });
  };

  const toggleChannelEvent = (
    category: (typeof JOINT_CHAT_CHANNEL_EVENT_CATEGORIES)[number]
  ) => {
    setChannelEventToggles((prev) => {
      const next = { ...prev, [category]: !prev[category] };
      emitConfiguratorEvent("overlay_joint_chat_channel_event_toggle", {
        category,
        enabled: next[category],
      });
      return next;
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      emitConfiguratorEvent("overlay_copy_link", {
        target: "joint-chat",
        urlLength: shareableUrl.length,
      });
    } catch (error) {
      console.warn("Failed to copy joint chat link", error);
    }
  };

  const handleStatusChange = useCallback((state: StreamStatus, message: string) => {
    setConnectionStatus({ state, message });
  }, []);

  return (
    <div className="page-shell">
      <section className="page-content">
        <Box>
          <Typography className="tagline">ai_licia® overlays</Typography>
          <Typography className={styles.heroTitle} variant="h3" gutterBottom>
            Build a unified cross-platform joint chat overlay.
          </Typography>
          <Typography className={styles.heroLead} variant="body1">
            Combine Twitch, Kick, YouTube, and TikTok chat plus ai_licia channel
            events in one feed. Tune animations, lifecycle timing, event toggles,
            and optional profanity filtering from a fully typed frontend config.
          </Typography>
        </Box>

        <JointChatShowcase />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={3}
          className={styles.muiGrid}
          sx={{ flexWrap: { xs: "wrap", md: "nowrap" }, alignItems: "stretch" }}
        >
          <Box sx={{ flex: { xs: "1 1 100%", md: "0 0 50%" }, minWidth: 0 }}>
            <Stack spacing={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    General configuration
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="Channel API Key"
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Channel name"
                      value={channel}
                      onChange={(event) => setChannel(event.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="API Base URL"
                      type="url"
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      fullWidth
                    />
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Platforms
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {JOINT_CHAT_SUPPORTED_PLATFORMS.map((platform) => {
                          const enabled = platforms.includes(platform);
                          return (
                            <Chip
                              key={platform}
                              label={platformLabel[platform]}
                              color={enabled ? "primary" : "default"}
                              variant={enabled ? "filled" : "outlined"}
                              onClick={() => togglePlatform(platform)}
                              sx={{ mb: 1 }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Max on-screen items
                      </Typography>
                      <Slider
                        min={3}
                        max={30}
                        step={1}
                        value={maxItems}
                        valueLabelDisplay="auto"
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setMaxItems(next);
                          emitConfiguratorEvent("overlay_joint_chat_max_items", {
                            maxItems: next,
                          });
                        }}
                      />
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showStatusChips}
                          onChange={(event) => {
                            setShowStatusChips(event.target.checked);
                            emitConfiguratorEvent(
                              "overlay_joint_chat_status_chips_toggle",
                              { enabled: event.target.checked }
                            );
                          }}
                        />
                      }
                      label="Show status chips"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={profanityFilterEnabled}
                          onChange={(event) => {
                            setProfanityFilterEnabled(event.target.checked);
                            emitConfiguratorEvent(
                              "overlay_joint_chat_profanity_toggle",
                              { enabled: event.target.checked }
                            );
                          }}
                        />
                      }
                      label="Enable profanity masking"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={hideStreamerMessages}
                          onChange={(event) => {
                            setHideStreamerMessages(event.target.checked);
                            emitConfiguratorEvent(
                              "overlay_joint_chat_hide_streamer_toggle",
                              { enabled: event.target.checked }
                            );
                          }}
                        />
                      }
                      label="Hide streamer messages"
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Timing and animation
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="Chat visible time (seconds)"
                      type="number"
                      value={chatVisibleSeconds}
                      onChange={(event) =>
                        setChatVisibleSeconds(
                          Math.min(
                            JOINT_CHAT_MAX_VISIBLE_SECONDS,
                            Math.max(
                              JOINT_CHAT_MIN_VISIBLE_SECONDS,
                              Number(event.target.value) ||
                                JOINT_CHAT_MIN_VISIBLE_SECONDS
                            )
                          )
                        )
                      }
                      fullWidth
                    />
                    <TextField
                      label="Event visible time (seconds)"
                      type="number"
                      value={eventVisibleSeconds}
                      onChange={(event) =>
                        setEventVisibleSeconds(
                          Math.min(
                            JOINT_CHAT_MAX_VISIBLE_SECONDS,
                            Math.max(
                              JOINT_CHAT_MIN_VISIBLE_SECONDS,
                              Number(event.target.value) ||
                                JOINT_CHAT_MIN_VISIBLE_SECONDS
                            )
                          )
                        )
                      }
                      fullWidth
                    />
                    <TextField
                      label="Entry animation (ms)"
                      type="number"
                      value={entryAnimationMs}
                      onChange={(event) =>
                        setEntryAnimationMs(
                          Math.max(80, Number(event.target.value) || 80)
                        )
                      }
                      fullWidth
                    />
                    <TextField
                      label="Exit animation (ms)"
                      type="number"
                      value={exitAnimationMs}
                      onChange={(event) =>
                        setExitAnimationMs(
                          Math.max(80, Number(event.target.value) || 80)
                        )
                      }
                      fullWidth
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Event filters
                  </Typography>
                  <Stack spacing={1}>
                    {JOINT_CHAT_EVENT_TYPES.map((eventType) => (
                      <FormControlLabel
                        key={eventType}
                        control={
                          <Switch
                            checked={eventToggles[eventType]}
                            onChange={() => toggleEvent(eventType)}
                          />
                        }
                        label={JOINT_CHAT_EVENT_LABELS[eventType]}
                      />
                    ))}
                  </Stack>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Channel event categories
                  </Typography>
                  <Stack spacing={1}>
                    {JOINT_CHAT_CHANNEL_EVENT_CATEGORIES.map((category) => (
                      <FormControlLabel
                        key={category}
                        control={
                          <Switch
                            checked={channelEventToggles[category]}
                            onChange={() => toggleChannelEvent(category)}
                          />
                        }
                        label={JOINT_CHAT_CHANNEL_EVENT_LABELS[category]}
                      />
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Share link
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2">Joint chat overlay</Typography>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        alignItems={{ xs: "stretch", sm: "center" }}
                      >
                        <Box className={styles.shareLink}>{shareableUrl}</Box>
                        <Button variant="contained" onClick={handleCopy}>
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Paste this into OBS browser source (recommended 940x680).
                      </Typography>
                    </Box>
                    <Chip
                      label={connectionStatus.message}
                      color={
                        connectionStatus.state === "connected"
                          ? "success"
                          : connectionStatus.state === "error"
                          ? "error"
                          : "default"
                      }
                      variant="outlined"
                      sx={{ alignSelf: "flex-start" }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Need top chatters too? <Link href="/configure">Open leaderboard.</Link>
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: { xs: "1 1 100%", md: "0 0 50%" },
              minWidth: 0,
              position: { md: "sticky" },
              top: { md: 24 },
              alignSelf: "flex-start",
            }}
          >
            <Card className={styles.previewPanel}>
              <CardContent>
                <JointChatOverlayView
                  settings={settings}
                  variant="standalone"
                  onStatusChange={handleStatusChange}
                />
              </CardContent>
            </Card>
          </Box>
        </Stack>
      </section>
    </div>
  );
};

export default JointChatConfigurator;
