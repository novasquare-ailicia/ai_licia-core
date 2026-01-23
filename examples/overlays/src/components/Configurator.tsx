'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicChatRole } from "ai_licia-client";
import {
  DEFAULT_BASE_URL,
  DEFAULT_CONTEXT_INTERVAL,
  DEFAULT_OVERTAKE_NOTIFICATION_INTERVAL_MS,
  DEFAULT_OVERTAKE_NOTIFICATIONS_ENABLED,
  OverlaySettings,
  ROLE_OPTIONS,
  RankKey,
  THEME_PRESETS,
  THEME_OPTIONS,
  DEFAULT_THEME,
  OverlayThemeId,
  buildOverlayQuery,
  normalizeBaseUrl,
  DEFAULT_PULSE_GLOW,
  DEFAULT_OVERLAY_OPACITY,
  DEFAULT_BRAND_GRADIENT,
  DEFAULT_DENSITY,
} from "@/lib/overlay";
import type { GradientPair } from "@/lib/overlay";
import OverlayView from "./overlay/OverlayView";
import OverlayShowcase from "./OverlayShowcase";
import styles from "./Configurator.module.css";
import { trackEvent } from "@/lib/analytics";
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

const parseExcluded = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const STORAGE_KEY = "ailicia-overlay-config-v1";

type ConfiguratorVariant = "leaderboard" | "message-rate";

interface ConfiguratorProps {
  variant?: ConfiguratorVariant;
}

type ShareLinkConfig = {
  key: "main" | "total";
  label: string;
  hint: string;
  buttonVariant: "contained" | "outlined";
};

type GradientOverridesState = Partial<
  Record<OverlayThemeId, Partial<Record<RankKey, GradientPair>>>
>;

const copyByVariant: Record<
  ConfiguratorVariant,
  {
    tagline: string;
    title: string;
    lead: string;
    previewCaption: string;
    share: {
      mainLabel: string;
      mainHint: string;
      totalLabel: string;
      totalHint: string;
    };
  }
> = {
  leaderboard: {
    tagline: "ai_licia® overlays",
    title: "Build an AI leaderboard overlay in seconds.",
    lead:
      "Drop your ai_licia® credentials, choose which roles matter, then paste the generated browser-source link inside OBS or any studio.",
    previewCaption:
      "Example data - Your top chatters animate automatically to keep the competition heated.",
    share: {
      mainLabel: "Browser source link",
      mainHint: "Paste inside OBS (recommended 800×500).",
      totalLabel: "Total message rate overlay",
      totalHint: "Standalone card for stream-wide msg/min stats.",
    },
  },
  "message-rate": {
    tagline: "ai_licia® message pulses",
    title: "Surface real-time message rate cards.",
    lead:
      "Let ai_licia keep your community informed with a live msg/min pulse. Drop the card on top of any scene or nest it in the leaderboard.",
    previewCaption:
      "Example signal - The rate card glows brighter as your community speeds up.",
    share: {
      mainLabel: "Top chatter overlay",
      mainHint: "Use when you want both leaderboard and rate card.",
      totalLabel: "Message rate card",
      totalHint: "Minimal card perfect for hype alerts or BRB scenes.",
    },
  },
};

const Configurator = ({ variant = "leaderboard" }: ConfiguratorProps) => {
  const isMessageRate = variant === "message-rate";
  const copy = copyByVariant[variant];
  const contextHelperText = isMessageRate
    ? "We sync ai_licia® with your message pulse using this interval."
    : "We ping ai_licia® this often with leaderboard context.";
  const [apiKey, setApiKey] = useState("");
  const [channel, setChannel] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [roles, setRoles] = useState<PublicChatRole[]>(ROLE_OPTIONS);
  const [contextInterval, setContextInterval] = useState(
    DEFAULT_CONTEXT_INTERVAL
  );
  const [overtakeNotificationsEnabled, setOvertakeNotificationsEnabled] =
    useState(DEFAULT_OVERTAKE_NOTIFICATIONS_ENABLED);
  const [overtakeNotificationIntervalMs, setOvertakeNotificationIntervalMs] =
    useState(DEFAULT_OVERTAKE_NOTIFICATION_INTERVAL_MS);
  const [excluded, setExcluded] = useState("");
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [gradientOverrides, setGradientOverrides] = useState<GradientOverridesState>({});
  const [brandGradient, setBrandGradient] = useState<GradientPair>(
    DEFAULT_BRAND_GRADIENT
  );
  const activeGradients = useMemo(
    () => gradientOverrides[theme] ?? {},
    [gradientOverrides, theme]
  );
  const [layout, setLayout] = useState<OverlaySettings["layout"]>(
    isMessageRate ? "vertical" : "horizontal"
  );
  const [compact, setCompact] = useState(
    DEFAULT_DENSITY === "compact"
  );
  const [showRates, setShowRates] = useState(true);
  const [showTotalRateCard, setShowTotalRateCard] = useState(
    isMessageRate ? true : false
  );
  const rolesCount = roles.length;
  const excludedCount = useMemo(
    () => parseExcluded(excluded).length,
    [excluded]
  );
  const [pulseGlowEnabled, setPulseGlowEnabled] = useState(
    DEFAULT_PULSE_GLOW.enabled
  );
  const [pulseGlowMin, setPulseGlowMin] = useState(DEFAULT_PULSE_GLOW.minRate);
  const [pulseGlowMax, setPulseGlowMax] = useState(DEFAULT_PULSE_GLOW.maxRate);
  const [pulseGlowColor, setPulseGlowColor] = useState(
    DEFAULT_PULSE_GLOW.color
  );
  const [overlayOpacity, setOverlayOpacity] = useState(
    DEFAULT_OVERLAY_OPACITY
  );
  const baseEventData = useMemo(
    () => ({
      variant,
      layout,
      compact,
      theme,
      showRates,
      showTotalRateCard,
      rolesCount,
      excludedCount,
      overlayOpacity,
      overtakeNotificationsEnabled,
      overtakeNotificationIntervalMs,
    }),
    [
      variant,
      layout,
      compact,
      theme,
      showRates,
      showTotalRateCard,
      rolesCount,
      excludedCount,
      overlayOpacity,
      overtakeNotificationsEnabled,
      overtakeNotificationIntervalMs,
    ]
  );
  const emitConfiguratorEvent = useCallback(
    (eventName: string, extra?: Record<string, unknown>) => {
      trackEvent(eventName, { ...baseEventData, ...extra });
    },
    [baseEventData]
  );
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsClient(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const [didHydrateFromStorage, setDidHydrateFromStorage] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    state: string;
    message: string;
  }>({ state: "idle", message: "Waiting for credentials" });

  useEffect(() => {
    if (!isClient || didHydrateFromStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (typeof stored.apiKey === "string") setApiKey(stored.apiKey);
      if (typeof stored.channel === "string") setChannel(stored.channel);
      if (typeof stored.baseUrl === "string") setBaseUrl(stored.baseUrl);
      if (Array.isArray(stored.roles) && stored.roles.length) setRoles(stored.roles);
      if (typeof stored.contextInterval === "number")
        setContextInterval(stored.contextInterval);
      if (typeof stored.overtakeNotificationsEnabled === "boolean")
        setOvertakeNotificationsEnabled(stored.overtakeNotificationsEnabled);
      if (typeof stored.overtakeNotificationIntervalMs === "number")
        setOvertakeNotificationIntervalMs(
          stored.overtakeNotificationIntervalMs
        );
      if (typeof stored.excluded === "string") setExcluded(stored.excluded);
      if (stored.theme && THEME_OPTIONS.includes(stored.theme)) setTheme(stored.theme);
      if (stored.gradientOverrides) setGradientOverrides(stored.gradientOverrides);
      if (stored.brandGradient?.from && stored.brandGradient?.to)
        setBrandGradient(stored.brandGradient);
      if (stored.layout === "horizontal" || stored.layout === "vertical")
        setLayout(stored.layout);
      if (typeof stored.compact === "boolean") setCompact(stored.compact);
      if (typeof stored.showRates === "boolean") setShowRates(stored.showRates);
      if (typeof stored.showTotalRateCard === "boolean")
        setShowTotalRateCard(stored.showTotalRateCard);
      if (typeof stored.pulseGlowEnabled === "boolean")
        setPulseGlowEnabled(stored.pulseGlowEnabled);
      if (typeof stored.pulseGlowMin === "number") setPulseGlowMin(stored.pulseGlowMin);
      if (typeof stored.pulseGlowMax === "number") setPulseGlowMax(stored.pulseGlowMax);
      if (typeof stored.pulseGlowColor === "string") setPulseGlowColor(stored.pulseGlowColor);
      if (typeof stored.overlayOpacity === "number")
        setOverlayOpacity(stored.overlayOpacity);
    } catch (error) {
      console.warn("Failed to load overlay settings from storage", error);
    } finally {
      setDidHydrateFromStorage(true);
    }
  }, [isClient, didHydrateFromStorage]);

  useEffect(() => {
    if (!isClient || !didHydrateFromStorage) return;
    const snapshot = {
      apiKey,
      channel,
      baseUrl,
      roles,
      contextInterval,
      overtakeNotificationsEnabled,
      overtakeNotificationIntervalMs,
      excluded,
      theme,
      gradientOverrides,
      brandGradient,
      layout,
      compact,
      showRates,
      showTotalRateCard,
      pulseGlowEnabled,
      pulseGlowMin,
      pulseGlowMax,
      pulseGlowColor,
      overlayOpacity,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn("Failed to persist overlay settings", error);
    }
  }, [
    isClient,
    didHydrateFromStorage,
    apiKey,
    channel,
    baseUrl,
    roles,
    contextInterval,
    overtakeNotificationsEnabled,
    overtakeNotificationIntervalMs,
    excluded,
    theme,
    gradientOverrides,
    layout,
    brandGradient,
    compact,
    showRates,
    showTotalRateCard,
    pulseGlowEnabled,
    pulseGlowMin,
    pulseGlowMax,
    pulseGlowColor,
    overlayOpacity,
  ]);
  const handleGradientChange = (
    rank: RankKey,
    key: "from" | "to",
    value: string
  ) => {
    setGradientOverrides((prev) => {
      const next = { ...prev };
      const currentTheme = { ...(next[theme] ?? {}) };
      const existing = currentTheme[rank] ?? {
        from: THEME_PRESETS[theme].gradients[rank].from,
        to: THEME_PRESETS[theme].gradients[rank].to,
      };
      currentTheme[rank] = { ...existing, [key]: value };
      next[theme] = currentTheme;
      return next;
    });
  };

  const handleBrandGradientChange = (
    key: "from" | "to",
    value: string
  ) => {
    setBrandGradient((prev) => ({ ...prev, [key]: value }));
  };

  const resetColors = () => {
    setGradientOverrides((prev) => {
      if (!prev[theme]) return prev;
      const next = { ...prev };
      delete next[theme];
      return next;
    });
    setBrandGradient(DEFAULT_BRAND_GRADIENT);
  };

  const overlaySettings: OverlaySettings = useMemo(
    () => ({
      apiKey,
      channelName: channel,
      baseUrl: normalizeBaseUrl(baseUrl),
      roles,
      excludedUsernames: parseExcluded(excluded),
      contextIntervalMs: contextInterval,
      overtakeNotificationsEnabled,
      overtakeNotificationIntervalMs,
      theme,
      customGradients: activeGradients,
      brandGradient,
      layout,
      compact,
      showRates,
      showTotalRateCard,
      pulseGlow: {
        enabled: pulseGlowEnabled,
        minRate: pulseGlowMin,
        maxRate: Math.max(pulseGlowMin + 0.5, pulseGlowMax),
        color: pulseGlowColor,
      },
      overlayOpacity,
    }),
    [
      apiKey,
      channel,
      baseUrl,
      roles,
      excluded,
      contextInterval,
      overtakeNotificationsEnabled,
      overtakeNotificationIntervalMs,
      theme,
      activeGradients,
      brandGradient,
      layout,
      showRates,
      showTotalRateCard,
      pulseGlowEnabled,
      pulseGlowMin,
      pulseGlowMax,
      pulseGlowColor,
      overlayOpacity,
      compact,
    ]
  );

  const overlayPath = useMemo(() => {
    const params = buildOverlayQuery(overlaySettings);
    return `/overlay${params ? `?${params}` : ""}`;
  }, [overlaySettings]);

  const totalOverlayPath = useMemo(
    () => overlayPath.replace(/^\/overlay/, "/overlay/total"),
    [overlayPath]
  );

  const shareableUrl = useMemo(() => {
    if (typeof window === "undefined") return overlayPath;
    return `${window.location.origin}${overlayPath}`;
  }, [overlayPath]);

  const shareableTotalUrl = useMemo(() => {
    if (typeof window === "undefined") return totalOverlayPath;
    return `${window.location.origin}${totalOverlayPath}`;
  }, [totalOverlayPath]);

  const shareLinkConfigs: ShareLinkConfig[] = isMessageRate
    ? [
        {
          key: "total",
          label: copy.share.totalLabel,
          hint: copy.share.totalHint,
          buttonVariant: "contained",
        },
      ]
    : [
        {
          key: "main",
          label: copy.share.mainLabel,
          hint: copy.share.mainHint,
          buttonVariant: "contained",
        },
        {
          key: "total",
          label: copy.share.totalLabel,
          hint: copy.share.totalHint,
          buttonVariant: "outlined",
        },
      ];

  const toggleRole = (role: PublicChatRole) => {
    const active = roles.includes(role);
    if (active) {
      if (roles.length === 1) return;
      const nextRoles = roles.filter((item) => item !== role);
      setRoles(nextRoles);
      emitConfiguratorEvent("overlay_roles_update", {
        action: "removed",
        role,
        rolesCount: nextRoles.length,
      });
    } else {
      const nextRoles = [...roles, role];
      setRoles(nextRoles);
      emitConfiguratorEvent("overlay_roles_update", {
        action: "added",
        role,
        rolesCount: nextRoles.length,
      });
    }
  };

  const handleCopy = async (value: string, target: "main" | "total") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      setTimeout(() => setCopied(null), 1500);
      emitConfiguratorEvent("overlay_copy_link", {
        target,
        hasCredentials: Boolean(apiKey && channel),
        urlLength: value.length,
      });
    } catch (error) {
      console.warn("Failed to copy overlay link", error);
    }
  };

  const handleStatusChange = useCallback(
    (state: string, message: string) => {
      setConnectionStatus({ state, message });
    },
    []
  );

  return (
    <div className="page-shell">
      <section className="page-content">
        <Box>
          <Typography className="tagline">{copy.tagline}</Typography>
          <Typography className={styles.heroTitle} variant="h3" gutterBottom>
            {copy.title}
          </Typography>
          <Typography className={styles.heroLead} variant="body1">
            {copy.lead}
          </Typography>
        </Box>

        <OverlayShowcase
          variant={isMessageRate ? "message-rate" : "leaderboard"}
          caption={copy.previewCaption}
        />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={3}
          className={styles.muiGrid}
          sx={{ flexWrap: { xs: "wrap", md: "nowrap" }, alignItems: "stretch" }}
        >
          <Box sx={{ flex: { xs: "1 1 100%", md: "0 0 48%" }, minWidth: 0 }}>
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
                      placeholder="Paste your ai_licia® API key"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Channel Name"
                      placeholder="your_twitch_channel"
                      value={channel}
                      onChange={(event) => setChannel(event.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="API Base URL"
                      type="url"
                      placeholder={DEFAULT_BASE_URL}
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      fullWidth
                    />
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Include Roles
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {ROLE_OPTIONS.map((role) => {
                          const active = roles.includes(role);
                          return (
                            <Chip
                              key={role}
                              label={role}
                              color={active ? "primary" : "default"}
                              variant={active ? "filled" : "outlined"}
                              onClick={() => toggleRole(role)}
                              sx={{ mb: 1 }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                    <TextField
                      label="Exclude usernames"
                      placeholder="nightbot, streamelements"
                      value={excluded}
                      onChange={(event) => setExcluded(event.target.value)}
                      onBlur={() =>
                        emitConfiguratorEvent("overlay_exclusions_update", {
                          excludedCount,
                        })
                      }
                      helperText="Comma separated list"
                      fullWidth
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Overlay configuration
                  </Typography>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Choose a style
                      </Typography>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        flexWrap="wrap"
                      >
                        {Object.values(THEME_PRESETS).map((preset) => {
                          const active = theme === preset.id;
                          return (
                            <Button
                              key={preset.id}
                              variant={active ? "contained" : "outlined"}
                              onClick={() => {
                                if (preset.id === theme) return;
                                setTheme(preset.id);
                                emitConfiguratorEvent(
                                  "overlay_theme_change",
                                  {
                                    previousTheme: theme,
                                    newTheme: preset.id,
                                  }
                                );
                              }}
                              sx={{ textTransform: "none", minWidth: 150 }}
                            >
                              {preset.name}
                            </Button>
                          );
                        })}
                      </Stack>
                    </Box>

                    {!isMessageRate && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Orientation
                        </Typography>
                        <ToggleButtonGroup
                          value={layout}
                          exclusive
                          onChange={(_, value) => {
                            if (!value || value === layout) return;
                            setLayout(value);
                            emitConfiguratorEvent("overlay_layout_change", {
                              newLayout: value,
                            });
                          }}
                        >
                          <ToggleButton value="horizontal">
                            Horizontal
                          </ToggleButton>
                          <ToggleButton value="vertical">Vertical</ToggleButton>
                        </ToggleButtonGroup>
                      </Box>
                    )}

                    {!isMessageRate && (
                      <Stack spacing={1}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={compact}
                              onChange={(event) => {
                                setCompact(event.target.checked);
                                emitConfiguratorEvent("overlay_compact_toggle", {
                                  enabled: event.target.checked,
                                });
                              }}
                            />
                          }
                          label="Use compact leaderboard cards"
                        />
                        <Typography variant="caption" color="text.secondary">
                          Slims the cards down to rank and username for tight layouts or stacked overlays.
                        </Typography>
                      </Stack>
                    )}

                    {!isMessageRate && (
                      <Stack spacing={1}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={showRates}
                              onChange={(event) => {
                                setShowRates(event.target.checked);
                                emitConfiguratorEvent(
                                  "overlay_show_rates_toggle",
                                  { enabled: event.target.checked }
                                );
                              }}
                            />
                          }
                          label="Show per-chatter message rate"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={showTotalRateCard}
                              onChange={(event) => {
                                setShowTotalRateCard(event.target.checked);
                                emitConfiguratorEvent(
                                  "overlay_show_total_toggle",
                                  { enabled: event.target.checked }
                                );
                              }}
                            />
                          }
                          label="Display total message rate card"
                        />
                      </Stack>
                    )}

                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Background opacity
                      </Typography>
                      <Slider
                        min={0.2}
                        max={1}
                        step={0.05}
                        value={overlayOpacity}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setOverlayOpacity(next);
                          emitConfiguratorEvent("overlay_opacity_change", {
                            opacity: next,
                          });
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Controls how solid the cards appear. Lower values keep the classic glass look;
                        higher values make them fully opaque for bright scenes.
                      </Typography>
                    </Box>

                    <Card variant="outlined">
                      <CardContent>
                        <Stack spacing={2}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={pulseGlowEnabled}
                                onChange={(event) => {
                                  setPulseGlowEnabled(event.target.checked);
                                  emitConfiguratorEvent(
                                    "overlay_pulse_glow_toggle",
                                    { enabled: event.target.checked }
                                  );
                                }}
                              />
                            }
                            label="Pulse glow on total message rate card"
                          />
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <TextField
                              label="Glow min msg/min"
                              type="number"
                              value={pulseGlowMin}
                              onChange={(event) => {
                                setPulseGlowMin(
                                  Math.max(0, Number(event.target.value) || 0)
                                );
                              }}
                              onBlur={() =>
                                emitConfiguratorEvent(
                                  "overlay_pulse_glow_update",
                                  {
                                    enabled: pulseGlowEnabled,
                                    minRate: pulseGlowMin,
                                    maxRate: pulseGlowMax,
                                    color: pulseGlowColor,
                                  }
                                )
                              }
                              fullWidth
                              disabled={!pulseGlowEnabled}
                            />
                            <TextField
                              label="Glow max msg/min"
                              type="number"
                              value={pulseGlowMax}
                              onChange={(event) => {
                                setPulseGlowMax(
                                  Math.max(
                                    0.5,
                                    Number(event.target.value) ||
                                      DEFAULT_PULSE_GLOW.maxRate
                                  )
                                );
                              }}
                              onBlur={() =>
                                emitConfiguratorEvent(
                                  "overlay_pulse_glow_update",
                                  {
                                    enabled: pulseGlowEnabled,
                                    minRate: pulseGlowMin,
                                    maxRate: pulseGlowMax,
                                    color: pulseGlowColor,
                                  }
                                )
                              }
                              fullWidth
                              disabled={!pulseGlowEnabled}
                            />
                          </Stack>
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Pulse color
                            </Typography>
                            <input
                              type="color"
                              value={pulseGlowColor}
                              disabled={!pulseGlowEnabled}
                              onChange={(event) => {
                                setPulseGlowColor(event.target.value);
                                emitConfiguratorEvent(
                                  "overlay_pulse_glow_update",
                                  {
                                    enabled: pulseGlowEnabled,
                                    minRate: pulseGlowMin,
                                    maxRate: pulseGlowMax,
                                    color: event.target.value,
                                  }
                                );
                              }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            We scale the glow between these msg/min thresholds so you can match the
                            energy of your stream.
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>

                    <TextField
                      label="Context sync frequency (ms)"
                      type="number"
                      value={contextInterval}
                      onChange={(event) => {
                        const next = Math.max(
                          15000,
                          Number(event.target.value) || 0
                        );
                        setContextInterval(next);
                        emitConfiguratorEvent(
                          "overlay_context_interval_change",
                          { intervalMs: next }
                        );
                      }}
                      helperText={contextHelperText}
                      fullWidth
                    />
                    {!isMessageRate && (
                      <Stack spacing={1}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={overtakeNotificationsEnabled}
                              onChange={(event) => {
                                setOvertakeNotificationsEnabled(event.target.checked);
                                emitConfiguratorEvent(
                                  "overlay_overtake_notifications_toggle",
                                  { enabled: event.target.checked }
                                );
                              }}
                            />
                          }
                          label="Send top-chatter overtake notifications"
                        />
                        <TextField
                          label="Overtake digest interval (seconds)"
                          type="number"
                          value={overtakeNotificationIntervalMs / 1000}
                          onChange={(event) => {
                            const nextSeconds = Math.max(
                              0,
                              Number(event.target.value) || 0
                            );
                            const nextMs = Math.round(nextSeconds * 1000);
                            setOvertakeNotificationIntervalMs(nextMs);
                            emitConfiguratorEvent(
                              "overlay_overtake_interval_change",
                              { intervalMs: nextMs }
                            );
                          }}
                          helperText={
                            overtakeNotificationsEnabled
                              ? "Set to 0 to send immediately. Higher values batch overtakes and send a digest only when changes occur."
                              : "Enable overtake notifications to adjust digest sampling."
                          }
                          fullWidth
                          disabled={!overtakeNotificationsEnabled}
                        />
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              {!isMessageRate && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Advanced styling
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      Override each rank’s gradient to perfectly match your brand.
                    </Typography>
                    <Stack spacing={2}>
                      {(["rank1", "rank2", "rank3"] as RankKey[]).map(
                        (rank, idx) => {
                          const preset = THEME_PRESETS[theme].gradients[rank];
                        const custom = activeGradients[rank];
                          const from = custom?.from ?? preset.from;
                          const to = custom?.to ?? preset.to;
                          return (
                            <Stack
                              key={rank}
                              direction={{ xs: "column", sm: "row" }}
                              spacing={2}
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Box>
                                <Typography variant="subtitle2">
                                  #{idx + 1} card
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {rank === "rank1"
                                    ? "Leader highlight"
                                    : rank === "rank2"
                                    ? "Second place"
                                    : "Third place"}
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={2}>
                                <input
                                  type="color"
                                  value={from}
                                  onChange={(event) =>
                                    handleGradientChange(
                                      rank,
                                      "from",
                                      event.target.value
                                    )
                                  }
                                />
                                <input
                                  type="color"
                                  value={to}
                                  onChange={(event) =>
                                    handleGradientChange(
                                      rank,
                                      "to",
                                      event.target.value
                                    )
                                  }
                                />
                              </Stack>
                            </Stack>
                          );
                        }
                      )}

                      <Divider />
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Box>
                          <Typography variant="subtitle2">
                            Footer brand gradient
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Colors for the footer line and ai_licia® mark.
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={2}>
                          <input
                            type="color"
                            value={brandGradient.from}
                            onChange={(event) =>
                              handleBrandGradientChange("from", event.target.value)
                            }
                          />
                          <input
                            type="color"
                            value={brandGradient.to}
                            onChange={(event) =>
                              handleBrandGradientChange("to", event.target.value)
                            }
                          />
                        </Stack>
                      </Stack>
                    </Stack>
                    <Button
                      sx={{ mt: 2 }}
                      variant="outlined"
                      onClick={resetColors}
                    >
                      Reset colors to theme defaults
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Share links
                  </Typography>
                  <Stack spacing={2}>
                    {shareLinkConfigs.map((shareConfig, index) => {
                      const url =
                        shareConfig.key === "main"
                          ? shareableUrl
                          : shareableTotalUrl;
                      const fallback =
                        shareConfig.key === "main"
                          ? overlayPath
                          : totalOverlayPath;
                      const displayUrl = isClient ? url : fallback;
                      return (
                        <div key={shareConfig.key}>
                          <Box>
                            <Typography variant="subtitle2">
                              {shareConfig.label}
                            </Typography>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              alignItems={{ xs: "stretch", sm: "center" }}
                            >
                              <Box className={styles.shareLink}>{displayUrl}</Box>
                              <Button
                                variant={shareConfig.buttonVariant}
                                onClick={() => handleCopy(url, shareConfig.key)}
                              >
                                {copied === shareConfig.key ? "Copied" : "Copy"}
                              </Button>
                            </Stack>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {shareConfig.hint}
                            </Typography>
                          </Box>
                          {index < shareLinkConfigs.length - 1 && <Divider />}
                        </div>
                      );
                    })}
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
                    {isMessageRate && (
                      <Typography variant="caption" color="text.secondary">
                        Want the leaderboard and rate card together?{" "}
                        <Link href="/configure">Open the full configurator.</Link>
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: { xs: "1 1 100%", md: "0 0 52%" },
              minWidth: 0,
              position: { md: "sticky" },
              top: { md: 24 },
              alignSelf: "flex-start",
            }}
          >
            <Card className={styles.previewPanel}>
              <CardContent>
                <OverlayView
                  settings={overlaySettings}
                  variant="preview"
                  onStatusChange={handleStatusChange}
                  mode={isMessageRate ? "total-rate" : "full"}
                />
              </CardContent>
            </Card>
          </Box>
        </Stack>
      </section>
    </div>
  );
};

export default Configurator;
