"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import LanguageWarOverlayView from "@/components/language-war/LanguageWarOverlayView";
import LanguageWarShowcase from "@/components/language-war/LanguageWarShowcase";
import {
  buildLanguageWarDemoSnapshot,
  getLanguageWarPreviewPhaseLabel,
  LANGUAGE_WAR_PREVIEW_PHASES,
} from "@/components/language-war/demo";
import type { LanguageWarPhase } from "@/components/language-war/types";
import { trackEvent } from "@/lib/analytics";
import {
  LANGUAGE_WAR_DEFAULT_BATTLE_DURATION_MS,
  LANGUAGE_WAR_DEFAULT_BATTLE_INTERVAL_MS,
  LANGUAGE_WAR_DEFAULT_EMIT_BATTLE_GENERATIONS,
  buildLanguageWarOverlayQuery,
  LANGUAGE_WAR_DEFAULT_HIDE_UNDETERMINED,
  LANGUAGE_WAR_DEFAULT_MAX_LANGUAGES,
  LANGUAGE_WAR_DEFAULT_SHOW_TICKER,
  LANGUAGE_WAR_DEFAULT_SURGE_WINDOW_MS,
  LANGUAGE_WAR_DEFAULT_TITLE,
  parseLanguageWarOverlaySettings,
  type LanguageWarOverlaySettings,
} from "@/lib/languageWarOverlay";
import { DEFAULT_BASE_URL } from "@/lib/overlay";
import styles from "./Configurator.module.css";

const STORAGE_KEY = "ailicia-language-war-config-v1";

const LanguageWarConfigurator = () => {
  const [apiKey, setApiKey] = useState("");
  const [channel, setChannel] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [title, setTitle] = useState(LANGUAGE_WAR_DEFAULT_TITLE);
  const [battleIntervalMs, setBattleIntervalMs] = useState(
    LANGUAGE_WAR_DEFAULT_BATTLE_INTERVAL_MS
  );
  const [battleDurationMs, setBattleDurationMs] = useState(
    LANGUAGE_WAR_DEFAULT_BATTLE_DURATION_MS
  );
  const [maxLanguages, setMaxLanguages] = useState(
    LANGUAGE_WAR_DEFAULT_MAX_LANGUAGES
  );
  const [surgeWindowMs, setSurgeWindowMs] = useState(
    LANGUAGE_WAR_DEFAULT_SURGE_WINDOW_MS
  );
  const [showTicker, setShowTicker] = useState(
    LANGUAGE_WAR_DEFAULT_SHOW_TICKER
  );
  const [hideUndetermined, setHideUndetermined] = useState(
    LANGUAGE_WAR_DEFAULT_HIDE_UNDETERMINED
  );
  const [emitBattleGenerations, setEmitBattleGenerations] = useState(
    LANGUAGE_WAR_DEFAULT_EMIT_BATTLE_GENERATIONS
  );
  const [previewPhaseIndex, setPreviewPhaseIndex] = useState(1);
  const [copied, setCopied] = useState(false);
  const [didHydrate, setDidHydrate] = useState(false);

  const emitConfiguratorEvent = useCallback(
    (eventName: string, extra?: Record<string, unknown>) => {
      trackEvent(eventName, {
        variant: "language-war",
        maxLanguages,
        battleIntervalMs,
        battleDurationMs,
        surgeWindowMs,
        showTicker,
        hideUndetermined,
        emitBattleGenerations,
        ...extra,
      });
    },
    [
      battleDurationMs,
      battleIntervalMs,
      emitBattleGenerations,
      hideUndetermined,
      maxLanguages,
      showTicker,
      surgeWindowMs,
    ]
  );

  useEffect(() => {
    if (didHydrate || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = parseLanguageWarOverlaySettings(JSON.parse(raw));
      setApiKey(stored.apiKey);
      setChannel(stored.channelName);
      setBaseUrl(stored.baseUrl);
      setTitle(stored.title);
      setBattleIntervalMs(stored.battleIntervalMs);
      setBattleDurationMs(stored.battleDurationMs);
      setMaxLanguages(stored.maxLanguages);
      setSurgeWindowMs(stored.surgeWindowMs);
      setShowTicker(stored.showTicker);
      setHideUndetermined(stored.hideUndetermined);
      setEmitBattleGenerations(stored.emitBattleGenerations);
    } catch (error) {
      console.warn("Failed to load language war settings from storage", error);
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
          channel: channel,
          baseUrl,
          title,
          intervalMs: battleIntervalMs,
          battleMs: battleDurationMs,
          maxLanguages,
          surgeMs: surgeWindowMs,
          ticker: showTicker,
          hideUnd: hideUndetermined,
          emitGenerations: emitBattleGenerations,
        })
      );
    } catch (error) {
      console.warn("Failed to persist language war settings", error);
    }
  }, [
    apiKey,
    baseUrl,
    battleDurationMs,
    battleIntervalMs,
    channel,
    didHydrate,
    emitBattleGenerations,
    hideUndetermined,
    maxLanguages,
    showTicker,
    surgeWindowMs,
    title,
  ]);

  const settings: LanguageWarOverlaySettings = useMemo(
    () => ({
      apiKey,
      channelName: channel,
      baseUrl: baseUrl.trim().replace(/\/$/, "") || DEFAULT_BASE_URL,
      title: title.trim() || LANGUAGE_WAR_DEFAULT_TITLE,
      battleIntervalMs,
      battleDurationMs,
      maxLanguages,
      surgeWindowMs,
      showTicker,
      hideUndetermined,
      emitBattleGenerations,
    }),
    [
      apiKey,
      baseUrl,
      battleDurationMs,
      battleIntervalMs,
      channel,
      emitBattleGenerations,
      hideUndetermined,
      maxLanguages,
      showTicker,
      surgeWindowMs,
      title,
    ]
  );

  const overlayPath = useMemo(() => {
    const params = buildLanguageWarOverlayQuery(settings);
    return `/overlay/language-war${params ? `?${params}` : ""}`;
  }, [settings]);
  const previewPhase = LANGUAGE_WAR_PREVIEW_PHASES[
    previewPhaseIndex
  ] as LanguageWarPhase;
  const previewSnapshot = useMemo(
    () =>
      buildLanguageWarDemoSnapshot(
        previewPhase,
        settings.title || LANGUAGE_WAR_DEFAULT_TITLE
      ),
    [previewPhase, settings.title]
  );

  const shareableUrl = useMemo(() => {
    if (typeof window === "undefined") return overlayPath;
    return `${window.location.origin}${overlayPath}`;
  }, [overlayPath]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      emitConfiguratorEvent("overlay_copy_link", {
        target: "language-war",
        urlLength: shareableUrl.length,
      });
    } catch (error) {
      console.warn("Failed to copy language war link", error);
    }
  };

  return (
    <div className="page-shell">
      <section className="page-content">
        <Box>
          <Typography className="tagline">ai_licia® overlays</Typography>
          <Typography className={styles.heroTitle} variant="h3" gutterBottom>
            Build a live language war overlay.
          </Typography>
          <Typography className={styles.heroLead} variant="body1">
            Turn detected chat languages into a timed battlefield. Drive a
            central ring, a ranked standings rail, and a live surge ticker from
            EventSub chat messages only, with idle, battle, crowning, and
            podium states.
          </Typography>
        </Box>

        <LanguageWarShowcase
          previewPhase={previewPhase}
          title={settings.title || LANGUAGE_WAR_DEFAULT_TITLE}
        />

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
                    <TextField
                      label="Center title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      fullWidth
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showTicker}
                          onChange={(event) => {
                            setShowTicker(event.target.checked);
                            emitConfiguratorEvent(
                              "overlay_language_war_ticker_toggle",
                              { enabled: event.target.checked }
                            );
                          }}
                        />
                      }
                      label="Show surge ticker"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={hideUndetermined}
                          onChange={(event) => {
                            setHideUndetermined(event.target.checked);
                            emitConfiguratorEvent(
                              "overlay_language_war_hide_und_toggle",
                              { enabled: event.target.checked }
                            );
                          }}
                        />
                      }
                      label="Hide undetermined messages"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emitBattleGenerations}
                          onChange={(event) => {
                            setEmitBattleGenerations(event.target.checked);
                            emitConfiguratorEvent(
                              "overlay_language_war_emit_generations_toggle",
                              { enabled: event.target.checked }
                            );
                          }}
                        />
                      }
                      label="Trigger ai_licia at battle start/end"
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Round controls
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Battle every (minutes)
                      </Typography>
                      <Slider
                        min={2}
                        max={20}
                        step={1}
                        value={Math.round(battleIntervalMs / 60_000)}
                        valueLabelDisplay="auto"
                        onChange={(_, value) => {
                          const minutes = Array.isArray(value) ? value[0] : value;
                          const next = minutes * 60_000;
                          setBattleIntervalMs(next);
                          setBattleDurationMs((current) =>
                            Math.min(current, next)
                          );
                          emitConfiguratorEvent(
                            "overlay_language_war_battle_interval",
                            { battleIntervalMs: next }
                          );
                        }}
                      />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Battle duration (minutes)
                      </Typography>
                      <Slider
                        min={1}
                        max={Math.max(1, Math.round(battleIntervalMs / 60_000))}
                        step={1}
                        value={Math.round(
                          Math.min(battleDurationMs, battleIntervalMs) / 60_000
                        )}
                        valueLabelDisplay="auto"
                        onChange={(_, value) => {
                          const minutes = Array.isArray(value) ? value[0] : value;
                          const next = Math.min(
                            battleIntervalMs,
                            minutes * 60_000
                          );
                          setBattleDurationMs(next);
                          emitConfiguratorEvent(
                            "overlay_language_war_battle_duration",
                            { battleDurationMs: next }
                          );
                        }}
                      />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Languages on the board
                      </Typography>
                      <Slider
                        min={3}
                        max={6}
                        step={1}
                        value={maxLanguages}
                        valueLabelDisplay="auto"
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setMaxLanguages(next);
                          emitConfiguratorEvent(
                            "overlay_language_war_max_languages",
                            { maxLanguages: next }
                          );
                        }}
                      />
                    </Box>
                    <TextField
                      label="Surge window (seconds)"
                      type="number"
                      value={Math.round(surgeWindowMs / 1000)}
                      onChange={(event) => {
                        const next = Math.max(
                          5_000,
                          (Number(event.target.value) || 30) * 1000
                        );
                        setSurgeWindowMs(next);
                      }}
                      fullWidth
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Preview state
                  </Typography>
                  <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                      Slide through the overlay phases to inspect the layout
                      without waiting for a live round.
                    </Typography>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        {getLanguageWarPreviewPhaseLabel(previewPhase)}
                      </Typography>
                      <Slider
                        min={0}
                        max={LANGUAGE_WAR_PREVIEW_PHASES.length - 1}
                        step={1}
                        marks={LANGUAGE_WAR_PREVIEW_PHASES.map((phase, index) => ({
                          value: index,
                          label: getLanguageWarPreviewPhaseLabel(phase),
                        }))}
                        value={previewPhaseIndex}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setPreviewPhaseIndex(next);
                          emitConfiguratorEvent(
                            "overlay_language_war_preview_phase",
                            {
                              previewPhase:
                                LANGUAGE_WAR_PREVIEW_PHASES[next] ?? "battle",
                            }
                          );
                        }}
                      />
                    </Box>
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
                      <Typography variant="subtitle2">Language war overlay</Typography>
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
                        Paste this into OBS browser source (recommended 1180x700).
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Preview panel is manually controlled with the state slider.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Battle timing: every{" "}
                      {Math.round(battleIntervalMs / 60_000)} min, live for{" "}
                      {Math.round(battleDurationMs / 60_000)} min.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Need unified chat too? <Link href="/configure/joint-chat">Open joint chat.</Link>
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
                <LanguageWarOverlayView
                  settings={settings}
                  variant="preview"
                  disableStream
                  initialSnapshot={previewSnapshot}
                />
              </CardContent>
            </Card>
          </Box>
        </Stack>
      </section>
    </div>
  );
};

export default LanguageWarConfigurator;
