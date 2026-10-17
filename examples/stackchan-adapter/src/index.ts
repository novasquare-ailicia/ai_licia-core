import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { LocalWebSocketClient, type WebSocketLike } from "ai_licia-client";
import WebSocket from "ws";
import { StackChanController } from "./controller.js";
import {
  STACKCHAN_INTEGRATION_CLIENT_ID,
  STACKCHAN_INTEGRATION_DISPLAY_NAME,
  STACKCHAN_INTEGRATION_VERSION,
} from "./identity.js";
import {
  BleStackChanTransport,
  SimulatedStackChanTransport,
  type StackChanTransport,
} from "./transport.js";

interface StoredSettings {
  reconnectCredential?: string;
}

const simulate = process.argv.includes("--simulate");
const retryDelayMs = 1_500;
const settingsPath = process.env.AI_LICIA_STACKCHAN_SETTINGS ??
  join(homedir(), ".ai_licia", "stackchan-adapter.json");

let shuttingDown = false;
let activeClient: LocalWebSocketClient | undefined;
let activeController: StackChanController | undefined;
let activeTransport: StackChanTransport | undefined;

const loadSettings = async (): Promise<StoredSettings> => {
  try {
    return JSON.parse(await readFile(settingsPath, "utf8")) as StoredSettings;
  } catch {
    return {};
  }
};

const saveSettings = async (settings: StoredSettings): Promise<void> => {
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
};

const runDesktopSession = async (
  transport: StackChanTransport,
  controller: StackChanController,
  settings: StoredSettings,
): Promise<"desktop-disconnected" | "robot-disconnected"> => {
  let resolveSocketClose: (() => void) | undefined;
  const socketClosed = new Promise<void>((resolve) => {
    resolveSocketClose = resolve;
  });
  const client = new LocalWebSocketClient({
    clientId: STACKCHAN_INTEGRATION_CLIENT_ID,
    displayName: STACKCHAN_INTEGRATION_DISPLAY_NAME,
    version: STACKCHAN_INTEGRATION_VERSION,
    ...(settings.reconnectCredential ? { reconnectCredential: settings.reconnectCredential } : {}),
    webSocketFactory: (url) => {
      const socket = new WebSocket(url);
      socket.once("close", () => resolveSocketClose?.());
      return socket as unknown as WebSocketLike;
    },
  });
  activeClient = client;

  try {
    await client.connect();
    let welcome = await client.sendHello();
    if (!welcome.authorizedScopes.includes("avatar.events.read")) {
      console.log("Approve the StackChan avatar access request in ai_licia Desktop.");
      const grant = await client.requestAccess({ scopes: ["avatar.events.read"] });
      if (grant.reconnectCredential) {
        settings.reconnectCredential = grant.reconnectCredential;
        await saveSettings(settings);
      }
      welcome = await client.sendHello();
    }
    if (!welcome.capabilities.includes("avatar.protocol.v1")) {
      throw new Error("This ai_licia Desktop build does not support avatar.protocol.v1.");
    }

    let mouthFrames = 0;
    let peakMouthAmplitude = 0;
    const runControllerTask = (label: string, task: Promise<void>): void => {
      void task.catch((error: unknown) => {
        if (!shuttingDown) console.error(`${label}:`, error instanceof Error ? error.message : error);
      });
    };

    client.onEvent("avatar.speech.started", (data) => {
      mouthFrames = 0;
      peakMouthAmplitude = 0;
      console.log(`Speech started: ${data.utteranceId}`);
      runControllerTask("Speaking motion failed", controller.startSpeaking());
    });
    client.onEvent("avatar.speech.paused", () => {
      runControllerTask("Pause motion failed", controller.stopSpeaking());
    });
    client.onEvent("avatar.speech.resumed", () => {
      runControllerTask("Speaking motion failed", controller.startSpeaking());
    });
    client.onEvent("avatar.mouth.amplitude", (data) => {
      mouthFrames += 1;
      peakMouthAmplitude = Math.max(peakMouthAmplitude, data.value);
      runControllerTask("Mouth command failed", controller.setMouth(data.value));
    });
    client.onEvent("avatar.expression.state", (data) => {
      const expression = data.values
        .map(({ expression: id, weight }) => `${id}=${weight.toFixed(2)}`)
        .join(", ");
      console.log(`Expression: ${expression || "neutral"}`);
      runControllerTask("Expression command failed", controller.setExpression(data));
    });
    client.onEvent("avatar.action.triggered", (data) => {
      console.log(`Action: ${data.actionId}`);
      runControllerTask("Action command failed", controller.triggerAction(data));
    });
    client.onEvent("avatar.speech.ended", (data) => {
      console.log(
        `Speech ended: ${data.utteranceId}; mouth frames=${mouthFrames}; ` +
          `peak=${peakMouthAmplitude.toFixed(3)}`,
      );
      runControllerTask("Reset command failed", controller.reset());
    });

    const subscription = await client.subscribeAvatar({
      requestId: `stackchan-${Date.now()}`,
      protocolVersion: 1,
      profiles: [
        { id: "avatar.speech.lifecycle.v1", required: true },
        { id: "avatar.mouth.amplitude.v1", required: true },
        { id: "avatar.expression.vrm.v1", required: false },
        { id: "avatar.action.semantic.v1", required: false },
      ],
      speechDriverPreference: ["avatar.mouth.amplitude.v1"],
    });
    console.log(`Avatar connected with profiles: ${subscription.acceptedProfiles.join(", ")}`);

    const disconnectReason = await Promise.race([
      socketClosed.then(() => "desktop-disconnected" as const),
      transport.waitForDisconnect().then(() => "robot-disconnected" as const),
    ]);
    return disconnectReason;
  } finally {
    client.close();
    if (activeClient === client) activeClient = undefined;
  }
};

const run = async (): Promise<void> => {
  const settings = await loadSettings();
  while (!shuttingDown) {
    const transport: StackChanTransport = simulate
      ? new SimulatedStackChanTransport()
      : new BleStackChanTransport();
    activeTransport = transport;
    try {
      await transport.connect();
      const controller = new StackChanController(transport);
      activeController = controller;
      while (!shuttingDown) {
        try {
          const reason = await runDesktopSession(transport, controller, settings);
          if (reason === "robot-disconnected") break;
          if (!shuttingDown) console.log("ai_licia Desktop disconnected. Reconnecting...");
        } catch (error: unknown) {
          if (!shuttingDown) {
            console.error(error instanceof Error ? error.message : error);
            console.log("Could not connect to ai_licia Desktop. Retrying...");
          }
        }
        if (!shuttingDown) await delay(retryDelayMs);
      }
    } catch (error: unknown) {
      if (!shuttingDown) {
        console.error(error instanceof Error ? error.message : error);
        console.log("Could not connect to StackChan. Retrying...");
      }
    } finally {
      await activeController?.reset().catch(() => undefined);
      await transport.close().catch(() => undefined);
      if (activeTransport === transport) activeTransport = undefined;
      activeController = undefined;
    }
    if (!shuttingDown) await delay(retryDelayMs);
  }
};

const shutdown = async (): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  activeClient?.close();
  await activeController?.reset().catch(() => undefined);
  await activeTransport?.close().catch(() => undefined);
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
