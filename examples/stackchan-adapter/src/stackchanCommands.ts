import type { AvatarExpressionStateEvent } from "ai_licia-client";

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

const EYE_STYLES = {
  neutral: { weight: 100, rotation: 0, size: 0 },
  happy: { weight: 72, rotation: 1550, size: 0 },
  angry: { weight: 70, rotation: 450, size: 0 },
  sad: { weight: 70, rotation: -400, size: 0 },
  relaxed: { weight: 45, rotation: -50, size: 0 },
  surprised: { weight: 100, rotation: 0, size: 70 },
} satisfies Record<string, EyeStyle>;

const LED_COLORS = {
  neutral: "#000000",
  happy: "#ff66aa",
  angry: "#ff0000",
  sad: "#3366ff",
  relaxed: "#66ccff",
  surprised: "#ffaa00",
} satisfies Record<keyof typeof EYE_STYLES, string>;

const HEAD_PITCH = {
  neutral: 0,
  happy: -20,
  angry: -50,
  sad: 55,
  relaxed: 20,
  surprised: -70,
} satisfies Record<keyof typeof EYE_STYLES, number>;

export const mouthCommand = (value: number): StackChanCommand => ({
  channel: "avatar",
  payload: { mouth: { weight: Math.round(Math.max(0, Math.min(1, value)) * 100) } },
});

export const expressionCommands = (
  event: AvatarExpressionStateEvent["payload"]["data"],
): StackChanCommand[] => {
  const strongest = [...event.values].sort((left, right) => right.weight - left.weight)[0];
  const candidate = strongest?.expression;
  const expression: keyof typeof EYE_STYLES = candidate && candidate in EYE_STYLES
    ? candidate as keyof typeof EYE_STYLES
    : "neutral";
  const intensity = strongest?.weight ?? 0;
  const target = EYE_STYLES[expression];
  const blend = (neutral: number, value: number) => Math.round(neutral + (value - neutral) * intensity);
  const eye = {
    weight: blend(100, target.weight),
    rotation: blend(0, target.rotation),
    size: blend(0, target.size),
  };
  return [
    {
      channel: "avatar",
      payload: {
        leftEye: eye,
        rightEye: { ...eye, rotation: -eye.rotation },
      },
    },
    {
      channel: "rgb",
      payload: {
        leftRgbColor: LED_COLORS[expression],
        rightRgbColor: LED_COLORS[expression],
        leftRgbDuration: 0.15,
        rightRgbDuration: 0.15,
      },
    },
    {
      channel: "motion",
      payload: { pitchServo: { angle: Math.round(HEAD_PITCH[expression] * intensity), speed: 80 } },
    },
  ];
};

type MotionStep = { delayMs: number; yaw?: number; pitch?: number };

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
    ...(step.yaw === undefined ? {} : { yawServo: { angle: step.yaw, speed: 100 } }),
    ...(step.pitch === undefined ? {} : { pitchServo: { angle: step.pitch, speed: 100 } }),
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
