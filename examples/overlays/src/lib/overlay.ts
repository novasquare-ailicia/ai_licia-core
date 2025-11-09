import type { PublicChatRole } from "ai_licia-client";

export const ROLE_OPTIONS: PublicChatRole[] = [
  "AI",
  "Streamer",
  "Mod",
  "VIP",
  "Viewer",
];

export const DEFAULT_BASE_URL = "https://api.getailicia.com/v1";
export const DEFAULT_CONTEXT_INTERVAL = 60000;
export const THEME_OPTIONS = ["aurora", "ember", "lumen"] as const;
export type OverlayThemeId = (typeof THEME_OPTIONS)[number];
export type OverlayLayout = "horizontal" | "vertical";

export type RankKey = "rank1" | "rank2" | "rank3";

export interface GradientPair {
  from: string;
  to: string;
}

export interface ThemePreset {
  id: OverlayThemeId;
  name: string;
  description: string;
  overlayBg: string;
  cardBg: string;
  borderColor: string;
  statusBg: string;
  footerBorder: string;
  gradients: Record<RankKey, GradientPair>;
}

export const THEME_PRESETS: Record<OverlayThemeId, ThemePreset> = {
  aurora: {
    id: "aurora",
    name: "Aurora Veil",
    description: "Ethereal blues and violets with soft glass reflections.",
    overlayBg:
      "radial-gradient(circle at 20% 20%, rgba(142, 45, 226, 0.3), transparent 45%), radial-gradient(circle at 80% 0%, rgba(73, 232, 255, 0.25), transparent 50%), rgba(5,6,16,0.7)",
    cardBg: "rgba(16, 18, 34, 0.72)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    statusBg: "rgba(255, 255, 255, 0.05)",
    footerBorder: "rgba(255, 255, 255, 0.15)",
    gradients: {
      rank1: { from: "#8e2de2", to: "#4a00e0" },
      rank2: { from: "#ff8a00", to: "#e52e71" },
      rank3: { from: "#20e3b2", to: "#29ffc6" },
    },
  },
  ember: {
    id: "ember",
    name: "Ember Pulse",
    description: "Bold oranges and fuchsia with high-contrast glow.",
    overlayBg:
      "radial-gradient(circle at 15% 25%, rgba(255, 138, 0, 0.4), transparent 55%), radial-gradient(circle at 85% 10%, rgba(229, 46, 113, 0.35), transparent 55%), rgba(7,4,9,0.82)",
    cardBg: "rgba(30, 8, 16, 0.8)",
    borderColor: "rgba(255, 93, 99, 0.32)",
    statusBg: "rgba(229, 46, 113, 0.15)",
    footerBorder: "rgba(255, 93, 99, 0.35)",
    gradients: {
      rank1: { from: "#ff5f6d", to: "#ffc371" },
      rank2: { from: "#f83600", to: "#f9d423" },
      rank3: { from: "#ff512f", to: "#dd2476" },
    },
  },
  lumen: {
    id: "lumen",
    name: "Lumen Drift",
    description: "Cool cyans and magentas with neon undertones.",
    overlayBg:
      "radial-gradient(circle at 10% 30%, rgba(32, 227, 178, 0.35), transparent 55%), radial-gradient(circle at 90% 20%, rgba(41, 255, 198, 0.3), transparent 60%), rgba(1,5,18,0.85)",
    cardBg: "rgba(6, 18, 32, 0.75)",
    borderColor: "rgba(41, 255, 198, 0.35)",
    statusBg: "rgba(32, 227, 178, 0.18)",
    footerBorder: "rgba(41, 255, 198, 0.3)",
    gradients: {
      rank1: { from: "#20e3b2", to: "#29ffc6" },
      rank2: { from: "#4776e6", to: "#8e54e9" },
      rank3: { from: "#614385", to: "#516395" },
    },
  },
};

export const DEFAULT_THEME: OverlayThemeId = "aurora";
export const DEFAULT_LAYOUT: OverlayLayout = "vertical";
export const DEFAULT_SHOW_RATES = true;
export const DEFAULT_SHOW_TOTAL_RATE = false;
export const DEFAULT_PULSE_GLOW = {
  enabled: true,
  minRate: 1,
  maxRate: 8,
  color: "#29ffc6",
};

export interface PulseGlowSettings {
  enabled: boolean;
  minRate: number;
  maxRate: number;
  color: string;
}

export interface OverlaySettings {
  apiKey: string;
  channelName: string;
  baseUrl: string;
  roles: PublicChatRole[];
  excludedUsernames: string[];
  contextIntervalMs: number;
  theme: OverlayThemeId;
  customGradients: Partial<Record<RankKey, GradientPair>>;
  layout: OverlayLayout;
  showRates: boolean;
  showTotalRateCard: boolean;
  pulseGlow: PulseGlowSettings;
}

export const normalizeBaseUrl = (value?: string) => {
  const base = (value || DEFAULT_BASE_URL).trim();
  if (!base) {
    return DEFAULT_BASE_URL;
  }
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

const parseCommaList = (value?: string | null) =>
  value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const hexRegex = /^#?[0-9a-f]{3,8}$/i;

const sanitizeHex = (value?: string) => {
  if (!value) return undefined;
  if (!hexRegex.test(value)) return undefined;
  return value.startsWith("#") ? value : `#${value}`;
};

const parseGradientPair = (value?: string): GradientPair | undefined => {
  if (!value) return undefined;
  const [fromRaw, toRaw] = value.split("-");
  const from = sanitizeHex(fromRaw);
  const to = sanitizeHex(toRaw) ?? from;
  if (!from || !to) return undefined;
  return { from, to };
};

export const parseOverlaySettings = (
  params: Record<string, string | string[] | undefined>
): OverlaySettings => {
  const pull = (key: string) => {
    const raw = params[key];
    if (Array.isArray(raw)) {
      return raw.at(-1) ?? "";
    }
    return raw ?? "";
  };

  const rolesParam = pull("roles");
  const intervalParam = pull("contextInterval");
  const excludedParam = pull("excluded");
  const themeParam = pull("theme");
  const layoutParam = pull("layout");
  const showRatesParam = pull("showRates");
  const showTotalParam = pull("showTotalRates");
  const glowParam = pull("glow");
  const glowMinParam = pull("glowMin");
  const glowMaxParam = pull("glowMax");
  const glowColorParam = pull("glowColor");

  const roles =
    rolesParam
      ?.split(",")
      .map((role) => role.trim())
      .filter((role): role is PublicChatRole =>
        ROLE_OPTIONS.includes(role as PublicChatRole)
      ) ?? ROLE_OPTIONS;

  const theme = THEME_OPTIONS.includes(themeParam as OverlayThemeId)
    ? (themeParam as OverlayThemeId)
    : DEFAULT_THEME;

  const customGradients: Partial<Record<RankKey, GradientPair>> = {};
  (["rank1", "rank2", "rank3"] as RankKey[]).forEach((rank) => {
    const parsed = parseGradientPair(pull(rank));
    if (parsed) {
      customGradients[rank] = parsed;
    }
  });

  const layout: OverlayLayout =
    layoutParam === "vertical" ? "vertical" : DEFAULT_LAYOUT;

  const showRates =
    showRatesParam === ""
      ? DEFAULT_SHOW_RATES
      : showRatesParam
      ? showRatesParam === "1" || showRatesParam.toLowerCase() === "true"
      : DEFAULT_SHOW_RATES;

  const showTotalRateCard =
    showTotalParam === ""
      ? DEFAULT_SHOW_TOTAL_RATE
      : showTotalParam
      ? showTotalParam === "1" || showTotalParam.toLowerCase() === "true"
      : DEFAULT_SHOW_TOTAL_RATE;

  const minRate = Math.max(0, Number(glowMinParam) || DEFAULT_PULSE_GLOW.minRate);
  const maxRate = Math.max(
    minRate + 0.5,
    Number(glowMaxParam) || DEFAULT_PULSE_GLOW.maxRate
  );

  const pulseGlow: PulseGlowSettings = {
    enabled: glowParam
      ? glowParam === "1" || glowParam.toLowerCase() === "true"
      : DEFAULT_PULSE_GLOW.enabled,
    minRate,
    maxRate,
    color: sanitizeHex(glowColorParam) ?? DEFAULT_PULSE_GLOW.color,
  };
  return {
    apiKey: pull("apiKey"),
    channelName: pull("channel"),
    baseUrl: normalizeBaseUrl(pull("baseUrl")),
    roles: roles.length ? roles : ROLE_OPTIONS,
    excludedUsernames: parseCommaList(excludedParam),
    contextIntervalMs: Number(intervalParam) > 0
      ? Number(intervalParam)
      : DEFAULT_CONTEXT_INTERVAL,
    theme,
    customGradients,
    layout,
    showRates,
    showTotalRateCard,
    pulseGlow,
  };
};

export const buildOverlayQuery = (settings: OverlaySettings) => {
  const params = new URLSearchParams();

  if (settings.apiKey) params.set("apiKey", settings.apiKey);
  if (settings.channelName) params.set("channel", settings.channelName);
  if (settings.baseUrl && settings.baseUrl !== DEFAULT_BASE_URL)
    params.set("baseUrl", settings.baseUrl);
  if (settings.roles.length && settings.roles.length !== ROLE_OPTIONS.length)
    params.set("roles", settings.roles.join(","));
  if (settings.excludedUsernames.length)
    params.set("excluded", settings.excludedUsernames.join(","));
  if (settings.contextIntervalMs !== DEFAULT_CONTEXT_INTERVAL)
    params.set("contextInterval", `${settings.contextIntervalMs}`);
  if (settings.theme && settings.theme !== DEFAULT_THEME)
    params.set("theme", settings.theme);
  if (settings.layout !== DEFAULT_LAYOUT) {
    params.set("layout", settings.layout);
  }
  if (settings.showRates === false) {
    params.set("showRates", "0");
  }
  if (settings.showTotalRateCard) {
    params.set("showTotalRates", "1");
  }
  if (
    settings.pulseGlow &&
    (settings.pulseGlow.enabled !== DEFAULT_PULSE_GLOW.enabled ||
      settings.pulseGlow.minRate !== DEFAULT_PULSE_GLOW.minRate ||
      settings.pulseGlow.maxRate !== DEFAULT_PULSE_GLOW.maxRate ||
      settings.pulseGlow.color !== DEFAULT_PULSE_GLOW.color)
  ) {
    params.set("glow", settings.pulseGlow.enabled ? "1" : "0");
    params.set("glowMin", `${settings.pulseGlow.minRate}`);
    params.set("glowMax", `${settings.pulseGlow.maxRate}`);
    params.set("glowColor", settings.pulseGlow.color);
  }

  (["rank1", "rank2", "rank3"] as RankKey[]).forEach((rank) => {
    const gradient = settings.customGradients[rank];
    if (gradient) {
      params.set(rank, `${gradient.from}-${gradient.to}`);
    }
  });

  return params.toString();
};
