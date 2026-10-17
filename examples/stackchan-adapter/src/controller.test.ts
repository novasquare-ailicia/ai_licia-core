import assert from "node:assert/strict";
import test from "node:test";
import { StackChanController, type Delay } from "./controller.js";
import type { StackChanCommand } from "./stackchanCommands.js";
import { SimulatedStackChanTransport, type StackChanTransport } from "./transport.js";

class DeferredTransport implements StackChanTransport {
  readonly commands: StackChanCommand[] = [];
  private releaseCurrent: (() => void) | undefined;

  async connect(): Promise<void> {}

  async send(command: StackChanCommand): Promise<void> {
    this.commands.push(command);
    await new Promise<void>((resolve) => {
      this.releaseCurrent = resolve;
    });
  }

  async waitForDisconnect(): Promise<void> {
    await new Promise<void>(() => undefined);
  }

  async close(): Promise<void> {}

  release(): void {
    const release = this.releaseCurrent;
    this.releaseCurrent = undefined;
    release?.();
  }
}

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

class ManualDelay {
  private releases: Array<() => void> = [];

  readonly wait: Delay = async () => new Promise<void>((resolve) => {
    this.releases.push(resolve);
  });

  release(): void {
    this.releases.shift()?.();
  }
}

test("mouth animation drops stale BLE frames and preserves the final value", async () => {
  const transport = new DeferredTransport();
  const controller = new StackChanController(transport);

  const first = controller.setMouth(0.1);
  void controller.setMouth(0.3);
  void controller.setMouth(0.8);
  assert.deepEqual(transport.commands.map(({ payload }) => payload), [
    { mouth: { weight: 10 } },
  ]);

  transport.release();
  await nextTurn();
  assert.deepEqual(transport.commands.map(({ payload }) => payload), [
    { mouth: { weight: 10 } },
    { mouth: { weight: 80 } },
  ]);

  void controller.setMouth(0.4);
  const final = controller.setMouth(0);
  transport.release();
  await nextTurn();
  assert.deepEqual(transport.commands.map(({ payload }) => payload), [
    { mouth: { weight: 10 } },
    { mouth: { weight: 80 } },
    { mouth: { weight: 0 } },
  ]);
  transport.release();
  await Promise.all([first, final]);
});

test("semantic action restores the latest expression pose", async () => {
  const transport = new SimulatedStackChanTransport();
  const controller = new StackChanController(transport, async () => undefined);
  await controller.setExpression({
    schemaVersion: 1,
    avatarSessionId: "session",
    subscriptionId: "subscription",
    deliverySequence: 1,
    emittedAtMs: 1,
    revision: 1,
    transitionMs: 100,
    values: [{ expression: "angry", weight: 1 }],
  });
  await controller.triggerAction({
    schemaVersion: 1,
    avatarSessionId: "session",
    subscriptionId: "subscription",
    deliverySequence: 2,
    emittedAtMs: 2,
    actionInstanceId: "action-1",
    actionId: "nod",
  });
  const last = transport.commands.at(-1);
  assert.equal(last?.channel, "motion");
  assert.deepEqual(last?.payload, {
    yawServo: { angle: 0, speed: 280 },
    pitchServo: { angle: 170, speed: 280 },
  });
});

test("holds a new expression during an action and restores its complete performance", async () => {
  const transport = new SimulatedStackChanTransport();
  const delay = new ManualDelay();
  const controller = new StackChanController(transport, delay.wait);
  await controller.setExpression({
    schemaVersion: 1,
    avatarSessionId: "session",
    subscriptionId: "subscription",
    deliverySequence: 1,
    emittedAtMs: 1,
    revision: 1,
    transitionMs: 100,
    values: [{ expression: "angry", weight: 1 }],
  });

  const action = controller.triggerAction({
    schemaVersion: 1,
    avatarSessionId: "session",
    subscriptionId: "subscription",
    deliverySequence: 2,
    emittedAtMs: 2,
    actionInstanceId: "action-2",
    actionId: "nod",
  });
  await nextTurn();
  const commandCountDuringAction = transport.commands.length;

  await controller.setExpression({
    schemaVersion: 1,
    avatarSessionId: "session",
    subscriptionId: "subscription",
    deliverySequence: 3,
    emittedAtMs: 3,
    revision: 2,
    transitionMs: 200,
    values: [{ expression: "sad", weight: 1 }],
  });
  assert.equal(transport.commands.length, commandCountDuringAction);

  delay.release();
  await nextTurn();
  delay.release();
  await action;

  const restored = transport.commands.slice(-3);
  assert.deepEqual(restored.map(({ channel }) => channel), ["avatar", "rgb", "motion"]);
  assert.deepEqual(restored[0]?.payload, {
    leftEye: { weight: 70, rotation: -400, size: 0 },
    rightEye: { weight: 70, rotation: 400, size: 0 },
  });
  assert.equal((restored[1]?.payload as { leftRgbColor: string }).leftRgbColor, "#3366ff");
});

test("speech lifecycle drives local servo motion and restores the expression pose", async () => {
  const transport = new SimulatedStackChanTransport();
  const delay = new ManualDelay();
  const controller = new StackChanController(transport, delay.wait);

  const speaking = controller.startSpeaking();
  delay.release();
  await nextTurn();

  assert.deepEqual(transport.commands.at(-1)?.payload, {
    yawServo: { angle: -23, speed: 160 },
    pitchServo: { angle: 52, speed: 160 },
  });

  const reset = controller.reset();
  delay.release();
  await Promise.all([speaking, reset]);
  assert.deepEqual(transport.commands.at(-1)?.payload, {
    yawServo: { angle: 0, speed: 160 },
    pitchServo: { angle: 45, speed: 160 },
  });
});
