import { AVATAR_EXPRESSION_IDS } from "ai_licia-client";
import { StackChanController } from "./controller.js";
import { STACKCHAN_SUPPORTED_ACTION_IDS } from "./stackchanCommands.js";
import { BleStackChanTransport } from "./transport.js";

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const transport = new BleStackChanTransport();
const controller = new StackChanController(transport);

const run = async (): Promise<void> => {
  try {
    await transport.connect();
    let deliverySequence = 1;

    for (const expression of AVATAR_EXPRESSION_IDS) {
      console.log(`Previewing complete ${expression} performance`);
      await controller.setExpression({
        schemaVersion: 1,
        avatarSessionId: "stackchan-performance-preview",
        subscriptionId: "stackchan-performance-preview",
        deliverySequence: deliverySequence++,
        emittedAtMs: Date.now(),
        revision: deliverySequence,
        transitionMs: 200,
        values: expression === "neutral" ? [] : [{ expression, weight: 1 }],
      });

      const speaking = controller.startSpeaking();
      for (const amplitude of [0.2, 0.65, 0.35, 0.9, 0]) {
        await controller.setMouth(amplitude);
        await wait(280);
      }
      await controller.stopSpeaking();
      await speaking;
      await wait(500);
    }

    console.log("Previewing coordinated semantic actions");
    for (const actionId of STACKCHAN_SUPPORTED_ACTION_IDS) {
      console.log(`Action: ${actionId}`);
      await controller.triggerAction({
        schemaVersion: 1,
        avatarSessionId: "stackchan-performance-preview",
        subscriptionId: "stackchan-performance-preview",
        deliverySequence: deliverySequence++,
        emittedAtMs: Date.now(),
        actionInstanceId: `preview-${actionId}`,
        actionId,
        intensity: 1,
      });
      await wait(500);
    }
    console.log("Performance preview completed.");
  } finally {
    await controller.reset().catch(() => undefined);
    await Promise.race([
      transport.close().catch(() => undefined),
      wait(2_000),
    ]);
  }
};

run().then(
  () => setTimeout(() => process.exit(0), 10),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    setTimeout(() => process.exit(1), 10);
  },
);
