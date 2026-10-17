import { setTimeout as delay } from "node:timers/promises";
import {
  STACKCHAN_FACTORY_EYE_PRESET_IDS,
  eyePresetCommand,
} from "./stackchanCommands.js";
import { BleStackChanTransport } from "./transport.js";

const transport = new BleStackChanTransport();

const run = async (): Promise<void> => {
  await transport.connect();
  try {
    for (const presetId of STACKCHAN_FACTORY_EYE_PRESET_IDS) {
      console.log(`Showing factory eye preset: ${presetId}`);
      await transport.send(eyePresetCommand(presetId));
      await delay(1_500);
    }

    console.log("Showing ai_licia surprised eye preset");
    await transport.send(eyePresetCommand("surprised"));
    await delay(1_500);
    console.log("Eye preview completed.");
  } finally {
    await transport.send(eyePresetCommand("neutral")).catch(() => undefined);
    await transport.close();
  }
};

run().then(
  () => setTimeout(() => process.exit(0), 10),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    setTimeout(() => process.exit(1), 10);
  },
);
