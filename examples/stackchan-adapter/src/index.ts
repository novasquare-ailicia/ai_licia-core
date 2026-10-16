import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { LocalWebSocketClient, type WebSocketLike } from "ai_licia-client";
import WebSocket from "ws";
import { StackChanController } from "./controller.js";
import { BleStackChanTransport, SimulatedStackChanTransport } from "./transport.js";

interface StoredSettings {
  reconnectCredential?: string;
}

const simulate = process.argv.includes("--simulate");
const settingsPath = process.env.AI_LICIA_STACKCHAN_SETTINGS ??
  join(homedir(), ".ai_licia", "stackchan-adapter.json");

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

const run = async (): Promise<void> => {
  const settings = await loadSettings();
  const transport = simulate ? new SimulatedStackChanTransport() : new BleStackChanTransport();
  await transport.connect();
  const controller = new StackChanController(transport);
  const client = new LocalWebSocketClient({
    clientId: "ai-licia-stackchan",
    displayName: "ai_licia StackChan",
    version: "0.1.0",
    ...(settings.reconnectCredential ? { reconnectCredential: settings.reconnectCredential } : {}),
    webSocketFactory: (url) => new WebSocket(url) as unknown as WebSocketLike,
  });

  await client.connect();
  let welcome = await client.sendHello();
  if (!welcome.authorizedScopes.includes("avatar.events.read")) {
    console.log("Approve the StackChan avatar access request in ai_licia Desktop.");
    const grant = await client.requestAccess({ scopes: ["avatar.events.read"] });
    if (grant.reconnectCredential) {
      await saveSettings({ reconnectCredential: grant.reconnectCredential });
    }
    welcome = await client.sendHello();
  }
  if (!welcome.capabilities.includes("avatar.protocol.v1")) {
    throw new Error("This ai_licia Desktop build does not support avatar.protocol.v1.");
  }

  client.onEvent("avatar.mouth.amplitude", (data) => void controller.setMouth(data.value));
  client.onEvent("avatar.expression.state", (data) => void controller.setExpression(data));
  client.onEvent("avatar.action.triggered", (data) => void controller.triggerAction(data));
  client.onEvent("avatar.speech.ended", () => void controller.reset());

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

  const shutdown = async () => {
    client.close();
    await controller.reset();
    await transport.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
