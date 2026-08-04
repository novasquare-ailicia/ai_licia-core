export const AILICIA_EVENT_CONTENT_LIMITS = {
  context: 1_000,
  generation: 300
} as const;

export type AiliciaEventContentLimit =
  (typeof AILICIA_EVENT_CONTENT_LIMITS)[keyof typeof AILICIA_EVENT_CONTENT_LIMITS];
