import assert from "node:assert/strict";
import test from "node:test";
import { expressionCommands, fragmentStackChanPayload, mouthCommand } from "./stackchanCommands.js";

test("maps amplitude to the factory mouth weight", () => {
  assert.deepEqual(mouthCommand(0.75), { channel: "avatar", payload: { mouth: { weight: 75 } } });
  assert.equal((mouthCommand(2).payload.mouth as { weight: number }).weight, 100);
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
});

test("uses the StackChan firmware fragmentation header", () => {
  const packets = fragmentStackChanPayload('{"mouth":{"weight":75}}', 20);
  assert.ok(packets.length > 1);
  assert.deepEqual([...packets[0]!.subarray(0, 4)], [0xaa, 0x55, 0xc3, 0x01]);
  assert.ok(packets.every((packet) => packet.length <= 20));
});
