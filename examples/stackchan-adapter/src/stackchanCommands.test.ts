import assert from "node:assert/strict";
import test from "node:test";
import {
  blePayloadLengthFromMtu,
  expressionCommands,
  expressionHeadPitch,
  fragmentStackChanPayload,
  mouthCommand,
  speakingMotionStep,
} from "./stackchanCommands.js";

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
  const commands = expressionCommands({
    schemaVersion: 1,
    avatarSessionId: "session",
    subscriptionId: "subscription",
    deliverySequence: 1,
    emittedAtMs: 1,
    revision: 1,
    transitionMs: 100,
    values: [{ expression: "angry", weight: 1 }],
  });
  assert.deepEqual(commands[0]?.payload, {
    leftEye: { weight: 70, rotation: 450, size: 0 },
    rightEye: { weight: 70, rotation: -450, size: 0 },
  });
  assert.equal((commands[1]?.payload as { leftRgbColor: string }).leftRgbColor, "#ff0000");
  assert.deepEqual(commands[2]?.payload, {
    yawServo: { angle: 0, speed: 180 },
    pitchServo: { angle: 170, speed: 180 },
  });
  assert.equal(expressionHeadPitch(undefined), 30);
});

test("keeps procedural speaking motion inside conservative servo bounds", () => {
  for (let index = 0; index < 20; index += 1) {
    const step = speakingMotionStep(index, 170);
    assert.ok(step.yaw !== undefined && step.yaw >= -100 && step.yaw <= 100);
    assert.ok(step.pitch !== undefined && step.pitch >= 30 && step.pitch <= 320);
    assert.ok(step.speed !== undefined && step.speed >= 150 && step.speed <= 190);
    assert.ok(step.delayMs >= 800);
  }
});

test("uses the StackChan firmware fragmentation header", () => {
  const packets = fragmentStackChanPayload('{"mouth":{"weight":75}}', 20);
  assert.ok(packets.length > 1);
  assert.deepEqual([...packets[0]!.subarray(0, 4)], [0xaa, 0x55, 0xc3, 0x01]);
  assert.ok(packets.every((packet) => packet.length <= 20));
});
