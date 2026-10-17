import assert from "node:assert/strict";
import test from "node:test";
import {
  actionPerformance,
  actionStepCommands,
  STACKCHAN_FACTORY_EYE_PRESET_IDS,
  STACKCHAN_SUPPORTED_ACTION_IDS,
  blePayloadLengthFromMtu,
  eyePairCommand,
  eyePresetCommand,
  expressionCommands,
  expressionHeadPitch,
  fragmentStackChanPayload,
  mouthCommand,
  speakingMotionStep,
} from "./stackchanCommands.js";

const expressionData = (
  expression: "neutral" | "happy" | "angry" | "sad" | "relaxed" | "surprised",
  weight: number,
) => ({
  schemaVersion: 1 as const,
  avatarSessionId: "session",
  subscriptionId: "subscription",
  deliverySequence: 1,
  emittedAtMs: 1,
  revision: 1,
  transitionMs: 100,
  values: [{ expression, weight }],
});

test("maps amplitude to the factory mouth weight", () => {
  assert.deepEqual(mouthCommand(0.75), { channel: "avatar", payload: { mouth: { weight: 75 } } });
  assert.equal((mouthCommand(2).payload.mouth as { weight: number }).weight, 100);
});

test("uses the negotiated BLE payload while retaining the legacy fallback", () => {
  assert.equal(blePayloadLengthFromMtu(509), 506);
  assert.equal(blePayloadLengthFromMtu(23), 20);
  assert.equal(blePayloadLengthFromMtu(null), 20);
});

test("maps angry expression to angled eyes, red LEDs and a conservative head pose", () => {
  const commands = expressionCommands(expressionData("angry", 1));
  assert.deepEqual(commands[0]?.payload, {
    leftEye: { weight: 70, rotation: 450, size: 0 },
    rightEye: { weight: 70, rotation: -450, size: 0 },
  });
  assert.equal((commands[1]?.payload as { leftRgbColor: string }).leftRgbColor, "#ff0000");
  assert.deepEqual(commands[2]?.payload, {
    yawServo: { angle: 0, speed: 280 },
    pitchServo: { angle: 170, speed: 280 },
  });
  assert.equal(expressionHeadPitch(undefined), 45);
});

test("uses the full factory happy preset for a weighted semantic expression", () => {
  const commands = expressionCommands(expressionData("happy", 0.45));
  assert.deepEqual(commands[0]?.payload, {
    leftEye: { weight: 72, rotation: 1550, size: 0 },
    rightEye: { weight: 72, rotation: -1550, size: 0 },
  });
  assert.equal((commands[1]?.payload as { leftRgbColor: string }).leftRgbColor, "#963c64");
});

test("keeps a barely weighted expression neutral and its lights off", () => {
  const commands = expressionCommands(expressionData("happy", 0.1));
  assert.deepEqual(commands[0]?.payload, eyePresetCommand("neutral").payload);
  assert.equal((commands[1]?.payload as { leftRgbColor: string }).leftRgbColor, "#000000");
});

test("exposes every factory eye preset and maps relaxed to sleepy", () => {
  assert.deepEqual(STACKCHAN_FACTORY_EYE_PRESET_IDS, [
    "neutral",
    "happy",
    "angry",
    "sad",
    "doubt",
    "sleepy",
  ]);
  assert.deepEqual(eyePresetCommand("doubt").payload, {
    leftEye: { weight: 75, rotation: 0, size: 0 },
    rightEye: { weight: 75, rotation: 0, size: 0 },
  });

  const commands = expressionCommands(expressionData("relaxed", 0.3));
  assert.deepEqual(commands[0]?.payload, {
    leftEye: { weight: 35, rotation: -50, size: 0 },
    rightEye: { weight: 35, rotation: 50, size: 0 },
  });
});

test("uses expression-specific speaking cadence inside conservative servo bounds", () => {
  const happy = expressionData("happy", 1);
  const sad = expressionData("sad", 1);
  assert.ok(speakingMotionStep(0, happy).delayMs < speakingMotionStep(0, sad).delayMs);
  assert.ok((speakingMotionStep(0, happy).speed ?? 0) > (speakingMotionStep(0, sad).speed ?? 0));
  for (let index = 0; index < 20; index += 1) {
    const step = speakingMotionStep(index, expressionData("angry", 1));
    assert.ok(step.yaw !== undefined && step.yaw >= -125 && step.yaw <= 125);
    assert.ok(step.pitch !== undefined && step.pitch >= 30 && step.pitch <= 320);
    assert.ok(step.speed !== undefined && step.speed >= 80 && step.speed <= 320);
    assert.ok(step.delayMs >= 600);
  }
});

test("coordinates face, asymmetric lights and motion for semantic actions", () => {
  assert.ok(STACKCHAN_SUPPORTED_ACTION_IDS.includes("wave"));
  assert.ok(STACKCHAN_SUPPORTED_ACTION_IDS.includes("ai.licia/gasp"));
  const firstStep = actionPerformance("celebrate")[0]!;
  const commands = actionStepCommands(firstStep, expressionData("neutral", 0), 0.8);
  assert.deepEqual(commands.map(({ channel }) => channel), ["avatar", "rgb", "motion"]);
  assert.notEqual(
    (commands[1]?.payload as { leftRgbColor: string }).leftRgbColor,
    (commands[1]?.payload as { rightRgbColor: string }).rightRgbColor,
  );
  assert.deepEqual(commands[2]?.payload, {
    yawServo: { angle: -100, speed: 320 },
    pitchServo: { angle: 30, speed: 320 },
  });
  assert.deepEqual(actionPerformance("vendor/unsupported"), []);
});

test("winks one eye and keeps the other eye visibly happy", () => {
  assert.ok(STACKCHAN_SUPPORTED_ACTION_IDS.includes("ai.licia/wink"));
  assert.deepEqual(eyePairCommand("wink", "happy").payload, {
    leftEye: { weight: 6, rotation: 0, size: 0 },
    rightEye: { weight: 72, rotation: -1550, size: 0 },
  });
  const commands = actionStepCommands(
    actionPerformance("ai.licia/wink")[0]!,
    expressionData("happy", 1),
    1,
  );
  assert.deepEqual(commands.map(({ channel }) => channel), ["avatar", "rgb", "motion"]);
});

test("rage uses angry eyes, alternating red lights and bounded sharp motion", () => {
  assert.ok(STACKCHAN_SUPPORTED_ACTION_IDS.includes("ai.licia/rage"));
  const steps = actionPerformance("ai.licia/rage");
  assert.equal(steps.length, 4);
  for (const step of steps) {
    const motion = actionStepCommands(step, expressionData("angry", 1), 1)
      .find(({ channel }) => channel === "motion");
    if (!motion) continue;
    const yaw = (motion.payload.yawServo as { angle: number } | undefined)?.angle;
    const pitch = (motion.payload.pitchServo as { angle: number } | undefined)?.angle;
    if (yaw !== undefined) assert.ok(yaw >= -145 && yaw <= 145);
    if (pitch !== undefined) assert.ok(pitch >= 30 && pitch <= 215);
  }
});

test("uses the StackChan firmware fragmentation header", () => {
  const packets = fragmentStackChanPayload('{"mouth":{"weight":75}}', 20);
  assert.ok(packets.length > 1);
  assert.deepEqual([...packets[0]!.subarray(0, 4)], [0xaa, 0x55, 0xc3, 0x01]);
  assert.ok(packets.every((packet) => packet.length <= 20));
});
