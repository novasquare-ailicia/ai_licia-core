import {
  AVATAR_EXPRESSION_IDS,
  AVATAR_STANDARD_ACTION_IDS,
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
  wink: { weight: 6, rotation: 0, size: 0 },
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
type AvatarStandardActionId = (typeof AVATAR_STANDARD_ACTION_IDS)[number];

interface SpeakingMotionOffset {
  delayMs: number;
  yaw: number;
  pitch: number;
  speed: number;
}

interface StackChanPerformancePreset {
  eyePresetId: StackChanEyePresetId;
  lightColor: `#${string}`;
  lightTransitionSeconds: number;
  basePitch: number;
  poseSpeed: number;
  speakingMotion: readonly SpeakingMotionOffset[];
}

const STACKCHAN_PERFORMANCE_PRESETS = {
  neutral: {
    eyePresetId: "neutral",
    lightColor: "#000000",
    lightTransitionSeconds: 0.25,
    basePitch: 45,
    poseSpeed: 160,
    speakingMotion: [
      { delayMs: 1_150, yaw: -65, pitch: 20, speed: 160 },
      { delayMs: 1_400, yaw: 55, pitch: 5, speed: 145 },
      { delayMs: 1_250, yaw: 0, pitch: 25, speed: 155 },
    ],
  },
  happy: {
    eyePresetId: "happy",
    lightColor: "#ff66aa",
    lightTransitionSeconds: 0.12,
    basePitch: 65,
    poseSpeed: 220,
    speakingMotion: [
      { delayMs: 700, yaw: -110, pitch: -25, speed: 250 },
      { delayMs: 800, yaw: 95, pitch: 15, speed: 235 },
      { delayMs: 650, yaw: -35, pitch: -15, speed: 270 },
      { delayMs: 850, yaw: 45, pitch: 20, speed: 225 },
    ],
  },
  angry: {
    eyePresetId: "angry",
    lightColor: "#ff0000",
    lightTransitionSeconds: 0.08,
    basePitch: 170,
    poseSpeed: 280,
    speakingMotion: [
      { delayMs: 650, yaw: -75, pitch: 20, speed: 310 },
      { delayMs: 700, yaw: 65, pitch: -10, speed: 300 },
      { delayMs: 750, yaw: 0, pitch: 25, speed: 285 },
    ],
  },
  sad: {
    eyePresetId: "sad",
    lightColor: "#3366ff",
    lightTransitionSeconds: 0.45,
    basePitch: 240,
    poseSpeed: 105,
    speakingMotion: [
      { delayMs: 1_800, yaw: -35, pitch: 15, speed: 105 },
      { delayMs: 2_100, yaw: 25, pitch: 30, speed: 90 },
      { delayMs: 1_900, yaw: 0, pitch: 10, speed: 100 },
    ],
  },
  relaxed: {
    eyePresetId: "sleepy",
    lightColor: "#66ccff",
    lightTransitionSeconds: 0.5,
    basePitch: 115,
    poseSpeed: 115,
    speakingMotion: [
      { delayMs: 1_500, yaw: -55, pitch: 10, speed: 115 },
      { delayMs: 1_700, yaw: 45, pitch: -5, speed: 105 },
      { delayMs: 1_600, yaw: 0, pitch: 15, speed: 110 },
    ],
  },
  surprised: {
    eyePresetId: "surprised",
    lightColor: "#ffaa00",
    lightTransitionSeconds: 0.05,
    basePitch: 55,
    poseSpeed: 300,
    speakingMotion: [
      { delayMs: 750, yaw: -35, pitch: -20, speed: 275 },
      { delayMs: 850, yaw: 35, pitch: 5, speed: 250 },
      { delayMs: 900, yaw: 0, pitch: -10, speed: 260 },
    ],
  },
} as const satisfies Record<AvatarExpressionId, StackChanPerformancePreset>;

interface SelectedExpression {
  expression: AvatarExpressionId;
  intensity: number;
}

const isAvatarExpressionId = (value: string | undefined): value is AvatarExpressionId =>
  value !== undefined && (AVATAR_EXPRESSION_IDS as readonly string[]).includes(value);

export const selectExpression = (
  event?: AvatarExpressionStateEvent["payload"]["data"],
): SelectedExpression => {
  const strongest = event ? [...event.values].sort((left, right) => right.weight - left.weight)[0] : undefined;
  const candidate = strongest?.expression;
  return {
    expression: isAvatarExpressionId(candidate) ? candidate : "neutral",
    intensity: strongest?.weight ?? 0,
  };
};

const scaleHexColor = (color: `#${string}`, brightness: number): `#${string}` => {
  const channels = [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
  return `#${channels.map((channel) => Math.round(channel * brightness).toString(16).padStart(2, "0")).join("")}`;
};

const expressionBrightness = (expression: AvatarExpressionId, intensity: number): number =>
  expression === "neutral" || intensity < 0.15 ? 0 : 0.25 + intensity * 0.75;

export const expressionHeadPitch = (
  event?: AvatarExpressionStateEvent["payload"]["data"],
): number => {
  const { expression, intensity } = selectExpression(event);
  const target = STACKCHAN_PERFORMANCE_PRESETS[expression].basePitch;
  return Math.round(
    STACKCHAN_PERFORMANCE_PRESETS.neutral.basePitch +
    (target - STACKCHAN_PERFORMANCE_PRESETS.neutral.basePitch) * intensity,
  );
};

export const mouthCommand = (value: number): StackChanCommand => ({
  channel: "avatar",
  payload: { mouth: { weight: Math.round(Math.max(0, Math.min(1, value)) * 100) } },
});

export const eyePresetCommand = (presetId: StackChanEyePresetId): StackChanCommand => {
  return eyePairCommand(presetId, presetId);
};

export const eyePairCommand = (
  leftPresetId: StackChanEyePresetId,
  rightPresetId: StackChanEyePresetId,
): StackChanCommand => {
  const leftEye = STACKCHAN_EYE_PRESETS[leftPresetId];
  const rightEye = STACKCHAN_EYE_PRESETS[rightPresetId];
  return {
    channel: "avatar",
    payload: {
      leftEye,
      rightEye: {
        ...rightEye,
        rotation: rightEye.rotation === 0 ? 0 : -rightEye.rotation,
      },
    },
  };
};

interface LightCommandOptions {
  leftColor: `#${string}`;
  rightColor?: `#${string}`;
  transitionSeconds: number;
  brightness?: number;
}

export const lightCommand = ({
  leftColor,
  rightColor = leftColor,
  transitionSeconds,
  brightness = 1,
}: LightCommandOptions): StackChanCommand => ({
  channel: "rgb",
  payload: {
    leftRgbColor: scaleHexColor(leftColor, brightness),
    rightRgbColor: scaleHexColor(rightColor, brightness),
    leftRgbDuration: transitionSeconds,
    rightRgbDuration: transitionSeconds,
  },
});

export const expressionCommands = (
  event?: AvatarExpressionStateEvent["payload"]["data"],
): StackChanCommand[] => {
  const { expression, intensity } = selectExpression(event);
  const preset = STACKCHAN_PERFORMANCE_PRESETS[expression];
  const visiblePreset = intensity >= 0.15 ? preset.eyePresetId : "neutral";
  return [
    eyePresetCommand(visiblePreset),
    lightCommand({
      leftColor: preset.lightColor,
      transitionSeconds: preset.lightTransitionSeconds,
      brightness: expressionBrightness(expression, intensity),
    }),
    expressionPoseCommand(event),
  ];
};

export const expressionPoseCommand = (
  event?: AvatarExpressionStateEvent["payload"]["data"],
): StackChanCommand => {
  const { expression } = selectExpression(event);
  return motionCommand({
    delayMs: 0,
    yaw: 0,
    pitch: expressionHeadPitch(event),
    speed: STACKCHAN_PERFORMANCE_PRESETS[expression].poseSpeed,
  });
};

export type MotionStep = { delayMs: number; yaw?: number; pitch?: number; speed?: number };

export const speakingMotionStep = (
  index: number,
  event?: AvatarExpressionStateEvent["payload"]["data"],
): MotionStep => {
  const { expression, intensity } = selectExpression(event);
  const preset = STACKCHAN_PERFORMANCE_PRESETS[expression];
  const offset = preset.speakingMotion[index % preset.speakingMotion.length]!;
  const movementIntensity = 0.35 + intensity * 0.65;
  return {
    delayMs: offset.delayMs,
    yaw: Math.round(offset.yaw * movementIntensity),
    pitch: Math.max(30, Math.min(320, expressionHeadPitch(event) + Math.round(offset.pitch * movementIntensity))),
    speed: offset.speed,
  };
};

export interface ActionPerformanceStep {
  delayMs: number;
  yawOffset?: number;
  pitchOffset?: number;
  speed?: number;
  eyePresetId?: StackChanEyePresetId;
  eyePair?: readonly [StackChanEyePresetId, StackChanEyePresetId];
  lights?: LightCommandOptions;
}

export const STACKCHAN_EXTENSION_ACTION_IDS = [
  "ai.licia/sigh",
  "ai.licia/clear_throat",
  "ai.licia/gasp",
  "ai.licia/scoff",
  "ai.licia/pant",
  "ai.licia/sharp_exhale",
  "ai.licia/yawn",
  "ai.licia/wink",
  "ai.licia/rage",
] as const;

export type StackChanActionId = AvatarStandardActionId | (typeof STACKCHAN_EXTENSION_ACTION_IDS)[number];

export const STACKCHAN_SUPPORTED_ACTION_IDS = [
  ...AVATAR_STANDARD_ACTION_IDS,
  ...STACKCHAN_EXTENSION_ACTION_IDS,
] as const satisfies readonly StackChanActionId[];

const ACTION_PERFORMANCES = {
  wave: [
    { delayMs: 0, yawOffset: -120, speed: 220, eyePresetId: "happy", lights: { leftColor: "#ff66aa", rightColor: "#ffaa00", transitionSeconds: 0.1 } },
    { delayMs: 260, yawOffset: 120, speed: 230, lights: { leftColor: "#ffaa00", rightColor: "#ff66aa", transitionSeconds: 0.1 } },
    { delayMs: 260, yawOffset: 0, speed: 180 },
  ],
  nod: [
    { delayMs: 0, pitchOffset: 55, speed: 230 },
    { delayMs: 180, pitchOffset: -25, speed: 240 },
    { delayMs: 180, pitchOffset: 0, speed: 180 },
  ],
  shake_head: [
    { delayMs: 0, yawOffset: -110, speed: 240 },
    { delayMs: 160, yawOffset: 110, speed: 250 },
    { delayMs: 160, yawOffset: 0, speed: 180 },
  ],
  celebrate: [
    { delayMs: 0, yawOffset: -125, pitchOffset: -35, speed: 320, eyePresetId: "happy", lights: { leftColor: "#ff66aa", rightColor: "#ffaa00", transitionSeconds: 0.05 } },
    { delayMs: 190, yawOffset: 125, pitchOffset: -35, speed: 320, lights: { leftColor: "#ffaa00", rightColor: "#ff66aa", transitionSeconds: 0.05 } },
    { delayMs: 190, yawOffset: -90, pitchOffset: 5, speed: 300, lights: { leftColor: "#ff66aa", rightColor: "#ffaa00", transitionSeconds: 0.05 } },
    { delayMs: 190, yawOffset: 0, pitchOffset: 0, speed: 200 },
  ],
  laugh: [
    { delayMs: 0, pitchOffset: -30, speed: 270, eyePresetId: "happy", lights: { leftColor: "#ff66aa", transitionSeconds: 0.08 } },
    { delayMs: 150, pitchOffset: 30, speed: 245, lights: { leftColor: "#ffaa00", transitionSeconds: 0.08 } },
    { delayMs: 150, pitchOffset: -30, speed: 270, lights: { leftColor: "#ff66aa", transitionSeconds: 0.08 } },
    { delayMs: 150, pitchOffset: 0, speed: 190 },
  ],
  surprised_recoil: [
    { delayMs: 0, pitchOffset: -70, speed: 340, eyePresetId: "surprised", lights: { leftColor: "#ffaa00", transitionSeconds: 0.02 } },
    { delayMs: 320, pitchOffset: 0, speed: 170, lights: { leftColor: "#442200", transitionSeconds: 0.25 } },
  ],
  "ai.licia/sigh": [
    { delayMs: 0, pitchOffset: 55, speed: 100, eyePresetId: "sad", lights: { leftColor: "#3366ff", transitionSeconds: 0.4, brightness: 0.55 } },
    { delayMs: 650, pitchOffset: 0, speed: 90 },
  ],
  "ai.licia/clear_throat": [
    { delayMs: 0, yawOffset: -35, speed: 190, eyePresetId: "doubt" },
    { delayMs: 170, yawOffset: 35, speed: 200 },
    { delayMs: 170, yawOffset: 0, speed: 160 },
  ],
  "ai.licia/gasp": [
    { delayMs: 0, pitchOffset: -65, speed: 340, eyePresetId: "surprised", lights: { leftColor: "#ffaa00", transitionSeconds: 0.02 } },
    { delayMs: 350, pitchOffset: 0, speed: 160 },
  ],
  "ai.licia/scoff": [
    { delayMs: 0, yawOffset: 85, pitchOffset: -10, speed: 230, eyePresetId: "doubt", lights: { leftColor: "#ff3300", rightColor: "#220000", transitionSeconds: 0.1 } },
    { delayMs: 380, yawOffset: 0, pitchOffset: 0, speed: 150 },
  ],
  "ai.licia/pant": [
    { delayMs: 0, pitchOffset: 35, speed: 250 },
    { delayMs: 170, pitchOffset: -20, speed: 260 },
    { delayMs: 170, pitchOffset: 35, speed: 250 },
    { delayMs: 170, pitchOffset: 0, speed: 180 },
  ],
  "ai.licia/sharp_exhale": [
    { delayMs: 0, pitchOffset: 45, speed: 280, lights: { leftColor: "#ffffff", transitionSeconds: 0.03, brightness: 0.6 } },
    { delayMs: 280, pitchOffset: 0, speed: 160 },
  ],
  "ai.licia/yawn": [
    { delayMs: 0, pitchOffset: -35, speed: 85, eyePresetId: "sleepy", lights: { leftColor: "#66ccff", transitionSeconds: 0.5, brightness: 0.4 } },
    { delayMs: 900, pitchOffset: 35, speed: 80 },
    { delayMs: 450, pitchOffset: 0, speed: 100 },
  ],
  "ai.licia/wink": [
    { delayMs: 0, yawOffset: 45, pitchOffset: -12, speed: 230, eyePair: ["wink", "happy"], lights: { leftColor: "#ff66aa", rightColor: "#ffaa00", transitionSeconds: 0.06, brightness: 0.8 } },
    { delayMs: 320, yawOffset: 0, pitchOffset: 0, speed: 170 },
  ],
  "ai.licia/rage": [
    { delayMs: 0, yawOffset: -145, pitchOffset: 45, speed: 330, eyePresetId: "angry", lights: { leftColor: "#ff0000", rightColor: "#330000", transitionSeconds: 0.02 } },
    { delayMs: 150, yawOffset: 145, pitchOffset: 25, speed: 340, lights: { leftColor: "#330000", rightColor: "#ff0000", transitionSeconds: 0.02 } },
    { delayMs: 150, yawOffset: -120, pitchOffset: 45, speed: 340, lights: { leftColor: "#ff0000", rightColor: "#330000", transitionSeconds: 0.02 } },
    { delayMs: 180, yawOffset: 0, pitchOffset: 0, speed: 230, lights: { leftColor: "#550000", transitionSeconds: 0.16 } },
  ],
} as const satisfies Record<StackChanActionId, readonly ActionPerformanceStep[]>;

const isStackChanActionId = (actionId: string): actionId is StackChanActionId =>
  (STACKCHAN_SUPPORTED_ACTION_IDS as readonly string[]).includes(actionId);

export const actionPerformance = (actionId: string): readonly ActionPerformanceStep[] =>
  isStackChanActionId(actionId) ? ACTION_PERFORMANCES[actionId] : [];

export const actionStepCommands = (
  step: ActionPerformanceStep,
  expressionState?: AvatarExpressionStateEvent["payload"]["data"],
  intensity = 1,
): StackChanCommand[] => {
  const commands: StackChanCommand[] = [];
  if (step.eyePair) commands.push(eyePairCommand(...step.eyePair));
  else if (step.eyePresetId) commands.push(eyePresetCommand(step.eyePresetId));
  if (step.lights) {
    commands.push(lightCommand({
      ...step.lights,
      brightness: (step.lights.brightness ?? 1) * intensity,
    }));
  }
  if (step.yawOffset !== undefined || step.pitchOffset !== undefined) {
    commands.push(motionCommand({
      delayMs: 0,
      ...(step.yawOffset === undefined ? {} : { yaw: Math.round(step.yawOffset * intensity) }),
      ...(step.pitchOffset === undefined ? {} : {
        pitch: expressionHeadPitch(expressionState) + Math.round(step.pitchOffset * intensity),
      }),
      ...(step.speed === undefined ? {} : { speed: step.speed }),
    }));
  }
  return commands;
};

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
