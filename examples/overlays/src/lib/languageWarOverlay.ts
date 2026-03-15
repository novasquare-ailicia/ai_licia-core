import { DEFAULT_BASE_URL } from "@/lib/overlay";

export const LANGUAGE_WAR_DEFAULT_BATTLE_INTERVAL_MS = 30 * 60_000;
export const LANGUAGE_WAR_DEFAULT_BATTLE_DURATION_MS = 5 * 60_000;
export const LANGUAGE_WAR_DEFAULT_MAX_LANGUAGES = 5;
export const LANGUAGE_WAR_DEFAULT_SURGE_WINDOW_MS = 30_000;
export const LANGUAGE_WAR_DEFAULT_SHOW_TICKER = true;
export const LANGUAGE_WAR_DEFAULT_HIDE_UNDETERMINED = true;
export const LANGUAGE_WAR_DEFAULT_EMIT_BATTLE_GENERATIONS = true;
export const LANGUAGE_WAR_DEFAULT_TITLE = "Language War";

export interface LanguageWarOverlaySettings {
  apiKey: string;
  channelName: string;
  baseUrl: string;
  battleIntervalMs: number;
  battleDurationMs: number;
  maxLanguages: number;
  surgeWindowMs: number;
  showTicker: boolean;
  hideUndetermined: boolean;
  emitBattleGenerations: boolean;
  title: string;
}

export interface LanguageWarSurge {
  code: string;
  delta: number;
  windowMs: number;
}

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

const normalizeBaseUrl = (value?: string) => {
  const raw = (value ?? DEFAULT_BASE_URL).trim();
  if (!raw) return DEFAULT_BASE_URL;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

export const normalizeLanguageWarCode = (value?: string | null) =>
  (value ?? "").trim().toUpperCase();

const LANGUAGE_WAR_COLOR_MAP: Record<string, string> = {
  EN: "#23A6FF",
  FR: "#E21B4D",
  ES: "#FF8A00",
  DE: "#16C64F",
  PT: "#8B35D9",
  JA: "#FFE01B",
  IT: "#2FD4C4",
  NL: "#3BC7FF",
  RU: "#FF5B8A",
  PL: "#FF4D6D",
  TR: "#FF6B2C",
  KO: "#73C7FF",
  ZH: "#FFD166",
  AR: "#44D07B",
  HI: "#FF934F",
  UNK: "#7C8597",
  OTHER: "#64748B",
};

const LANGUAGE_WAR_NAME_MAP: Record<string, string> = {
  AR: "Arabic",
  DE: "German",
  EN: "English",
  ES: "Spanish",
  FR: "French",
  HI: "Hindi",
  IT: "Italian",
  JA: "Japanese",
  KO: "Korean",
  NL: "Dutch",
  PL: "Polish",
  PT: "Portuguese",
  RU: "Russian",
  TR: "Turkish",
  UNK: "Unknown",
  UND: "Undetermined",
  ZH: "Chinese",
  OTHER: "Other",
};

const LANGUAGE_WAR_FALLBACK_COLORS = [
  "#23A6FF",
  "#E21B4D",
  "#FF8A00",
  "#16C64F",
  "#8B35D9",
  "#FFE01B",
  "#2FD4C4",
  "#FF6B6B",
  "#A78BFA",
  "#4ADE80",
] as const;

export const resolveLanguageWarColor = (code: string) => {
  const normalized = normalizeLanguageWarCode(code);
  if (!normalized) {
    return LANGUAGE_WAR_COLOR_MAP.UNK;
  }
  const direct = LANGUAGE_WAR_COLOR_MAP[normalized];
  if (direct) {
    return direct;
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return LANGUAGE_WAR_FALLBACK_COLORS[
    Math.abs(hash) % LANGUAGE_WAR_FALLBACK_COLORS.length
  ];
};

export const resolveLanguageWarName = (code: string) => {
  const normalized = normalizeLanguageWarCode(code);
  if (!normalized) {
    return "Unknown";
  }
  return LANGUAGE_WAR_NAME_MAP[normalized] ?? normalized;
};

export const formatLanguageWarDurationLabel = (durationMs: number) => {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds % 60 === 0) {
    const minutes = totalSeconds / 60;
    return `BATTLE ${minutes} MIN`;
  }
  if (totalSeconds > 60) {
    const minutes = (totalSeconds / 60).toFixed(1).replace(/\.0$/, "");
    return `BATTLE ${minutes} MIN`;
  }
  return `BATTLE ${totalSeconds} SEC`;
};

export const formatLanguageWarTimerLabel = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} LEFT`;
};

export const buildLanguageWarOverlayQuery = (
  settings: LanguageWarOverlaySettings
) => {
  const params = new URLSearchParams();
  if (settings.apiKey) params.set("apiKey", settings.apiKey);
  if (settings.channelName) params.set("channel", settings.channelName);
  if (settings.baseUrl && settings.baseUrl !== DEFAULT_BASE_URL) {
    params.set("baseUrl", settings.baseUrl);
  }
  if (settings.title && settings.title !== LANGUAGE_WAR_DEFAULT_TITLE) {
    params.set("title", settings.title);
  }
  if (
    settings.battleIntervalMs !== LANGUAGE_WAR_DEFAULT_BATTLE_INTERVAL_MS
  ) {
    params.set("intervalMs", `${settings.battleIntervalMs}`);
  }
  if (
    settings.battleDurationMs !== LANGUAGE_WAR_DEFAULT_BATTLE_DURATION_MS
  ) {
    params.set("battleMs", `${settings.battleDurationMs}`);
  }
  if (settings.maxLanguages !== LANGUAGE_WAR_DEFAULT_MAX_LANGUAGES) {
    params.set("maxLanguages", `${settings.maxLanguages}`);
  }
  if (settings.surgeWindowMs !== LANGUAGE_WAR_DEFAULT_SURGE_WINDOW_MS) {
    params.set("surgeMs", `${settings.surgeWindowMs}`);
  }
  if (settings.showTicker !== LANGUAGE_WAR_DEFAULT_SHOW_TICKER) {
    params.set("ticker", settings.showTicker ? "1" : "0");
  }
  if (
    settings.hideUndetermined !== LANGUAGE_WAR_DEFAULT_HIDE_UNDETERMINED
  ) {
    params.set("hideUnd", settings.hideUndetermined ? "1" : "0");
  }
  if (
    settings.emitBattleGenerations !==
    LANGUAGE_WAR_DEFAULT_EMIT_BATTLE_GENERATIONS
  ) {
    params.set("emitGenerations", settings.emitBattleGenerations ? "1" : "0");
  }
  return params.toString();
};

export const parseLanguageWarOverlaySettings = (
  params: Record<string, string | string[] | undefined>
): LanguageWarOverlaySettings => {
  const pull = (key: string) => {
    const raw = params[key];
    if (Array.isArray(raw)) return raw.at(-1) ?? "";
    return raw ?? "";
  };

  const rawBattleDurationMs = parseNumberInRange(
    pull("battleMs") || pull("roundMs"),
    LANGUAGE_WAR_DEFAULT_BATTLE_DURATION_MS,
    30_000,
    30 * 60_000
  );
  const explicitIntervalMs = pull("intervalMs");
  const battleIntervalMs = parseNumberInRange(
    explicitIntervalMs,
    explicitIntervalMs ? LANGUAGE_WAR_DEFAULT_BATTLE_INTERVAL_MS : rawBattleDurationMs,
    60_000,
    60 * 60_000
  );

  return {
    apiKey: pull("apiKey"),
    channelName: pull("channel"),
    baseUrl: normalizeBaseUrl(pull("baseUrl")),
    title: pull("title").trim() || LANGUAGE_WAR_DEFAULT_TITLE,
    battleIntervalMs,
    battleDurationMs: Math.min(rawBattleDurationMs, battleIntervalMs),
    maxLanguages: parseNumberInRange(
      pull("maxLanguages"),
      LANGUAGE_WAR_DEFAULT_MAX_LANGUAGES,
      3,
      6
    ),
    surgeWindowMs: parseNumberInRange(
      pull("surgeMs"),
      LANGUAGE_WAR_DEFAULT_SURGE_WINDOW_MS,
      5_000,
      120_000
    ),
    showTicker: parseBoolean(
      pull("ticker"),
      LANGUAGE_WAR_DEFAULT_SHOW_TICKER
    ),
    hideUndetermined: parseBoolean(
      pull("hideUnd"),
      LANGUAGE_WAR_DEFAULT_HIDE_UNDETERMINED
    ),
    emitBattleGenerations: parseBoolean(
      pull("emitGenerations"),
      LANGUAGE_WAR_DEFAULT_EMIT_BATTLE_GENERATIONS
    ),
  };
};
