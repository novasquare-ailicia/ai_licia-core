import {
  AVATAR_EXPRESSION_IDS,
  type AvatarExpressionStateEvent,
} from "ai_licia-client";

export const STACKCHAN_SERVICE_UUIDS = [
  "e2e5e5e012345678123456789abcdef0",
  "e2e5e5ff12345678123456789abcdef0",
] as const;

export const STACKCHAN_CHARACTERISTIC_UUIDS = {
  motion: "e2e5e5e112345678123456789abcdef0",
  avatar: "e2e5e5e212345678123456789abcdef0",
  rgb: "e2e5e5e412345678123456789abcdef0",
} as const;

export type StackChanChannel = keyof typeof STACKCHAN_CHARACTERISTIC_UUIDS;

export interface StackChanCommand {
  channel: StackChanChannel;
  payload: Record<string, unknown>;
}

interface EyeStyle {
  weight: number;
  rotation: number;
  size: number;
}

export const STACKCHAN_EYE_PRESETS = {
  neutral: { weight: 100, rotation: 0, size: 0 },
  happy: { weight: 72, rotation: 1550, size: 0 },
  angry: { weight: 70, rotation: 450, size: 0 },
  sad: { weight: 70, rotation: -400, size: 0 },
  doubt: { weight: 75, rotation: 0, size: 0 },
  sleepy: { weight: 35, rotation: -50, size: 0 },
  surprised: { weight: 100, rotation: 0, size: 70 },
} satisfies Record<string, EyeStyle>;

export type StackChanEyePresetId = keyof typeof STACKCHAN_EYE_PRESETS;

export const STACKCHAN_FACTORY_EYE_PRESET_IDS = [
  "neutral",
  "happy",
  "angry",
  "sad",
  "doubt",
  "sleepy",
] as const satisfies readonly StackChanEyePresetId[];

type AvatarExpressionId = (typeof AVATAR_EXPRESSION_IDS)[number];

const AVATAR_EXPRESSION_EYE_PRESETS = {
  neutral: "neutral",
  happy: "happy",
  angry: "angry",
  sad: "sad",
  relaxed: "sleepy",
  surprised: "surprised",
} as const satisfies Record<AvatarExpressionId, StackChanEyePresetId>;

const LED_COLORS = {
  neutral: "#000000",
  happy: "#ff66aa",
  angry: "#ff0000",
  sad: "#3366ff",
  relaxed: "#66ccff",
  surprised: "#ffaa00",
} satisfies Record<AvatarExpressionId, string>;

const HEAD_PITCH = {
  neutral: 30,
  happy: 75,
  angry: 170,
  sad: 240,
  relaxed: 100,
  surprised: 55,
} satisfies Record<AvatarExpressionId, number>;

const isAvatarExpressionId = (value: string | undefined): value is AvatarExpressionId =>
  value !== undefined && (AVATAR_EXPRESSION_IDS as readonly string[]).includes(value);

const selectExpression = (event?: AvatarExpressionStateEvent["payload"]["data"]) => {
  const strongest = event ? [...event.values].sort((left, right) => right.weight - left.weight)[0] : undefined;
  const candidate = strongest?.expression;
  const expression: AvatarExpressionId = isAvatarExpressionId(candidate)
    ? candidate
    : "neutral";
  return { expression, intensity: strongest?.weight ?? 0 };
};

export const expressionHeadPitch = (
  event?: AvatarExpressionStateEvent["payload"]["data"],
): number => {
  const { expression, intensity } = selectExpression(event);
  return Math.round(HEAD_PITCH.neutral + (HEAD_PITCH[expression] - HEAD_PITCH.neutral) * intensity);
};

export const mouthCommand = (value: number): StackChanCommand => ({
  channel: "avatar",
  payload: { mouth: { weight: Math.round(Math.max(0, Math.min(1, value)) * 100) } },
});

export const eyePresetCommand = (presetId: StackChanEyePresetId): StackChanCommand => {
  const eye = STACKCHAN_EYE_PRESETS[presetId];
  const mirroredRotation = eye.rotation === 0 ? 0 : -eye.rotation;
  return {
    channel: "avatar",
    payload: {
      leftEye: eye,
      rightEye: { ...eye, rotation: mirroredRotation },
    },
  };
};

export const expressionCommands = (
  event: AvatarExpressionStateEvent["payload"]["data"],
): StackChanCommand[] => {
  const { expression, intensity } = selectExpression(event);
  const presetId = intensity > 0 ? AVATAR_EXPRESSION_EYE_PRESETS[expression] : "neutral";
  return [
    eyePresetCommand(presetId),
    {
      channel: "rgb",
      payload: {
        leftRgbColor: LED_COLORS[expression],
        rightRgbColor: LED_COLORS[expression],
        leftRgbDuration: 0.15,
        rightRgbDuration: 0.15,
      },
    },
    expressionPoseCommand(event),
  ];
};

export const expressionPoseCommand = (
  event?: AvatarExpressionStateEvent["payload"]["data"],
): StackChanCommand => motionCommand({
  delayMs: 0,
  yaw: 0,
  pitch: expressionHeadPitch(event),
  speed: 180,
});

export type MotionStep = { delayMs: number; yaw?: number; pitch?: number; speed?: number };

interface SpeakingMotionOffset {
  delayMs: number;
  yaw: number;
  pitch: number;
  speed: number;
}

const SPEAKING_MOTION_OFFSETS: readonly SpeakingMotionOffset[] = [
  { delayMs: 800, yaw: -100, pitch: 35, speed: 180 },
  { delayMs: 1_200, yaw: 80, pitch: 5, speed: 160 },
  { delayMs: 1_000, yaw: 20, pitch: 55, speed: 190 },
  { delayMs: 1_300, yaw: -60, pitch: 15, speed: 150 },
  { delayMs: 900, yaw: 0, pitch: 30, speed: 170 },
];

export const speakingMotionStep = (index: number, basePitch: number): MotionStep => {
  const offset = SPEAKING_MOTION_OFFSETS[index % SPEAKING_MOTION_OFFSETS.length]!;
  return {
    delayMs: offset.delayMs,
    yaw: offset.yaw,
    pitch: Math.max(30, Math.min(320, basePitch + offset.pitch)),
    speed: offset.speed,
  };
};

const ACTION_MOTIONS: Record<string, readonly MotionStep[]> = {
  nod: [
    { delayMs: 0, pitch: 80 }, { delayMs: 180, pitch: -45 }, { delayMs: 180, pitch: 0 },
  ],
  shake_head: [
    { delayMs: 0, yaw: -100 }, { delayMs: 160, yaw: 100 }, { delayMs: 160, yaw: 0 },
  ],
  celebrate: [
    { delayMs: 0, yaw: -100, pitch: -60 }, { delayMs: 180, yaw: 100, pitch: -60 },
    { delayMs: 180, yaw: 0, pitch: 0 },
  ],
  laugh: [
    { delayMs: 0, pitch: 55 }, { delayMs: 140, pitch: -35 },
    { delayMs: 140, pitch: 55 }, { delayMs: 140, pitch: 0 },
  ],
  surprised_recoil: [{ delayMs: 0, pitch: -100 }, { delayMs: 300, pitch: 0 }],
  "ai.licia/sigh": [{ delayMs: 0, pitch: 65 }, { delayMs: 500, pitch: 0 }],
  "ai.licia/clear_throat": [{ delayMs: 0, yaw: -30 }, { delayMs: 180, yaw: 30 }, { delayMs: 180, yaw: 0 }],
  "ai.licia/scoff": [{ delayMs: 0, yaw: 75 }, { delayMs: 350, yaw: 0 }],
  "ai.licia/pant": [{ delayMs: 0, pitch: 45 }, { delayMs: 180, pitch: -25 }, { delayMs: 180, pitch: 45 }, { delayMs: 180, pitch: 0 }],
  "ai.licia/sharp_exhale": [{ delayMs: 0, pitch: 55 }, { delayMs: 280, pitch: 0 }],
  "ai.licia/yawn": [{ delayMs: 0, pitch: -55 }, { delayMs: 850, pitch: 0 }],
};

export const actionMotion = (actionId: string): readonly MotionStep[] =>
  ACTION_MOTIONS[actionId] ?? [];

export const motionCommand = (step: MotionStep): StackChanCommand => ({
  channel: "motion",
  payload: {
    ...(step.yaw === undefined ? {} : {
      yawServo: { angle: Math.max(-1_280, Math.min(1_280, step.yaw)), speed: step.speed ?? 100 },
    }),
    ...(step.pitch === undefined ? {} : {
      pitchServo: { angle: Math.max(30, Math.min(870, step.pitch)), speed: step.speed ?? 100 },
    }),
  },
});

export const fragmentStackChanPayload = (json: string, mtuPayload = 20): Buffer[] => {
  const payload = Buffer.from(json, "utf8");
  if (payload.length <= mtuPayload) return [payload];
  const headerLength = 10;
  const chunkLength = mtuPayload - headerLength;
  if (chunkLength <= 0 || payload.length > 2_048) throw new Error("Invalid StackChan BLE payload size.");
  const packetCount = Math.ceil(payload.length / chunkLength);
  return Array.from({ length: packetCount }, (_, packetIndex) => {
    const start = packetIndex * chunkLength;
    const chunk = payload.subarray(start, start + chunkLength);
    const header = Buffer.from([
      0xaa, 0x55, 0xc3, 0x01,
      (packetIndex >> 8) & 0xff, packetIndex & 0xff,
      (packetCount >> 8) & 0xff, packetCount & 0xff,
      (payload.length >> 8) & 0xff, payload.length & 0xff,
    ]);
    return Buffer.concat([header, chunk]);
  });
};

export const blePayloadLengthFromMtu = (mtu: number | null): number =>
  Math.max(20, (mtu ?? 23) - 3);
