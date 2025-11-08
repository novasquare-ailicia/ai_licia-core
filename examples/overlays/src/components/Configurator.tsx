'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicChatRole } from "ai_licia-client";
import {
  DEFAULT_BASE_URL,
  DEFAULT_CONTEXT_INTERVAL,
  OverlaySettings,
  ROLE_OPTIONS,
  RankKey,
  THEME_PRESETS,
  DEFAULT_THEME,
  buildOverlayQuery,
  normalizeBaseUrl,
} from "@/lib/overlay";
import OverlayView from "./overlay/OverlayView";
import OverlayShowcase from "./OverlayShowcase";
import styles from "./Configurator.module.css";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
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
    .map((entry) => entry.trim())
    .filter(Boolean);

const Configurator = () => {
  const [apiKey, setApiKey] = useState("");
  const [channel, setChannel] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [roles, setRoles] = useState<PublicChatRole[]>(ROLE_OPTIONS);
  const [contextInterval, setContextInterval] = useState(
    DEFAULT_CONTEXT_INTERVAL
  );
  const [excluded, setExcluded] = useState("");
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [customGradients, setCustomGradients] = useState<
    OverlaySettings["customGradients"]
  >({});
  const [layout, setLayout] = useState<OverlaySettings["layout"]>(
    "horizontal"
  );
  const [showRates, setShowRates] = useState(true);
  const [showTotalRateCard, setShowTotalRateCard] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    state: string;
    message: string;
  }>({ state: "idle", message: "Waiting for credentials" });

  useEffect(() => {
    setCustomGradients({});
  }, [theme]);

  const handleGradientChange = (
    rank: RankKey,
    key: "from" | "to",
    value: string
  ) => {
    setCustomGradients((prev) => {
      const next = { ...prev };
      const existing = next[rank] ?? {
        from: THEME_PRESETS[theme].gradients[rank].from,
        to: THEME_PRESETS[theme].gradients[rank].to,
      };
      next[rank] = { ...existing, [key]: value };
      return next;
    });
  };

  const resetColors = () => setCustomGradients({});

  const overlaySettings: OverlaySettings = useMemo(
    () => ({
      apiKey,
      channelName: channel,
      baseUrl: normalizeBaseUrl(baseUrl),
      roles,
      excludedUsernames: parseExcluded(excluded),
      contextIntervalMs: contextInterval,
      theme,
      customGradients,
      layout,
      showRates,
      showTotalRateCard,
    }),
    [
      apiKey,
      channel,
      baseUrl,
      roles,
      excluded,
      contextInterval,
      theme,
      customGradients,
      layout,
      showRates,
      showTotalRateCard,
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

  const [shareableUrl, setShareableUrl] = useState(overlayPath);
  const [shareableTotalUrl, setShareableTotalUrl] = useState(totalOverlayPath);

  useEffect(() => {
    setShareableUrl(overlayPath);
    setShareableTotalUrl(totalOverlayPath);
  }, [overlayPath, totalOverlayPath]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    setShareableUrl(`${origin}${overlayPath}`);
    setShareableTotalUrl(`${origin}${totalOverlayPath}`);
  }, [overlayPath, totalOverlayPath]);

  const toggleRole = (role: PublicChatRole) => {
    setRoles((prev) => {
      if (prev.includes(role)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== role);
      }
      return [...prev, role];
    });
  };

  const handleCopy = async (value: string, target: "main" | "total") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      setTimeout(() => setCopied(null), 1500);
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
          <Typography className="tagline">ai_licia® overlays</Typography>
          <Typography className={styles.heroTitle} variant="h3" gutterBottom>
            Build a glassy leaderboard overlay in seconds.
          </Typography>
          <Typography className={styles.heroLead} variant="body1">
            Drop your ai_licia® credentials, choose which roles matter, then
            paste the generated browser-source link inside OBS or any studio.
          </Typography>
        </Box>

        <OverlayShowcase />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={3}
          className={styles.muiGrid}
          sx={{ flexWrap: "wrap", alignItems: "stretch" }}
        >
          <Box sx={{ flex: { xs: "1 1 100%", md: "0 0 60%" }, minWidth: 0 }}>
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
                              onClick={() => setTheme(preset.id)}
                              sx={{ textTransform: "none", minWidth: 150 }}
                            >
                              {preset.name}
                            </Button>
                          );
                        })}
                      </Stack>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Orientation
                      </Typography>
                      <ToggleButtonGroup
                        value={layout}
                        exclusive
                        onChange={(_, value) => value && setLayout(value)}
                      >
                        <ToggleButton value="horizontal">
                          Horizontal
                        </ToggleButton>
                        <ToggleButton value="vertical">Vertical</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>

                    <Stack spacing={1}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={showRates}
                            onChange={(event) =>
                              setShowRates(event.target.checked)
                            }
                          />
                        }
                        label="Show per-chatter message rate"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={showTotalRateCard}
                            onChange={(event) =>
                              setShowTotalRateCard(event.target.checked)
                            }
                          />
                        }
                        label="Display total message rate card"
                      />
                    </Stack>

                    <TextField
                      label="Context sync frequency (ms)"
                      type="number"
                      value={contextInterval}
                      onChange={(event) =>
                        setContextInterval(
                          Math.max(15000, Number(event.target.value) || 0)
                        )
                      }
                      helperText="We ping ai_licia® this often with leaderboard context"
                      fullWidth
                    />
                  </Stack>
                </CardContent>
              </Card>

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
                        const custom = customGradients[rank];
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
                              <Typography variant="caption" color="text.secondary">
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
                                  handleGradientChange(rank, "to", event.target.value)
                                }
                              />
                            </Stack>
                          </Stack>
                        );
                      }
                    )}
                  </Stack>
                  <Button sx={{ mt: 2 }} variant="outlined" onClick={resetColors}>
                    Reset colors to theme defaults
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Share links
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2">
                        Browser source link
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box className={styles.shareLink}>{shareableUrl}</Box>
                        <Button
                          variant="contained"
                          onClick={() => handleCopy(shareableUrl, "main")}
                        >
                          {copied === "main" ? "Copied" : "Copy"}
                        </Button>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Paste inside an OBS browser source (recommended 800×500)
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2">
                        Total message rate overlay
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box className={styles.shareLink}>{shareableTotalUrl}</Box>
                        <Button
                          variant="outlined"
                          onClick={() => handleCopy(shareableTotalUrl, "total")}
                        >
                          {copied === "total" ? "Copied" : "Copy"}
                        </Button>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Standalone card for stream-wide msg/min stats.
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
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          <Box sx={{ flex: { xs: "1 1 100%", md: "0 0 40%" }, minWidth: 0 }}>
            <Card className={styles.previewPanel}>
              <CardContent>
                <OverlayView
                  settings={overlaySettings}
                  variant="preview"
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

export default Configurator;
