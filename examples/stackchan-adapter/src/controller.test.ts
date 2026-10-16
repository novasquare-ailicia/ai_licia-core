import assert from "node:assert/strict";
import test from "node:test";
import { StackChanController } from "./controller.js";
import { SimulatedStackChanTransport } from "./transport.js";

test("semantic action restores the latest expression pose", async () => {
  const transport = new SimulatedStackChanTransport();
  const controller = new StackChanController(transport);
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
  assert.deepEqual(last?.payload, { pitchServo: { angle: -50, speed: 80 } });
});
