import { setTimeout as delay } from "node:timers/promises";
import { expressionCommands, motionCommand, mouthCommand } from "./stackchanCommands.js";
import { BleStackChanTransport } from "./transport.js";

const transport = new BleStackChanTransport();

const run = async (): Promise<void> => {
  await transport.connect();
  try {
    console.log("Testing mouth...");
    await transport.send(mouthCommand(1));
    await delay(700);
    await transport.send(mouthCommand(0));

    console.log("Testing happy eyes and side LEDs...");
    const expression = expressionCommands({
      schemaVersion: 1,
      avatarSessionId: "hardware-smoke",
      subscriptionId: "hardware-smoke",
      deliverySequence: 1,
      emittedAtMs: Date.now(),
      revision: 1,
      transitionMs: 150,
      values: [{ expression: "happy", weight: 1 }],
    });
    for (const command of expression.filter(({ channel }) => channel !== "motion")) {
      await transport.send(command);
    }
    await delay(900);

    console.log("Testing a small head turn...");
    await transport.send(motionCommand({ delayMs: 0, yaw: 25 }));
    await delay(500);
    await transport.send(motionCommand({ delayMs: 0, yaw: 0 }));
    await delay(300);

    console.log("Hardware smoke test completed.");
  } finally {
    await transport.send(mouthCommand(0)).catch(() => undefined);
    await transport.send(motionCommand({ delayMs: 0, yaw: 0, pitch: 0 })).catch(() => undefined);
    await transport.close();
  }
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
