import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import {
  AVATAR_PROTOCOL_CAPABILITY,
  AvatarLiveConformanceMonitor,
  LocalWebSocketClient,
  validateAvatarProtocolMessage
} from '../packages/ai_licia-client/dist/index.js';

const DEFAULT_URL = 'ws://127.0.0.1:51743';
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_CLIENT_ID = 'ai-licia-avatar-conformance';
const DEFAULT_DISPLAY_NAME = 'ai_licia Avatar Conformance';
const CREDENTIAL_SCHEMA_VERSION = 1;
const REQUIRED_PROFILES = [
  'avatar.speech.lifecycle.v1',
  'avatar.mouth.amplitude.v1'
];

const defaultCredentialFile = () =>
  path.join(homedir(), '.ai_licia', 'avatar-conformance.json');

const readPositiveInteger = (value, flag) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
};

export const parseAvatarLiveCheckArgs = (argv, environment = process.env) => {
  const options = {
    url: environment.AVATAR_CONFORMANCE_URL || DEFAULT_URL,
    credentialFile:
      environment.AVATAR_CONFORMANCE_CREDENTIAL_FILE || defaultCredentialFile(),
    reportFile: environment.AVATAR_CONFORMANCE_REPORT_FILE,
    timeoutMs: environment.AVATAR_CONFORMANCE_TIMEOUT_MS
      ? readPositiveInteger(
          environment.AVATAR_CONFORMANCE_TIMEOUT_MS,
          'AVATAR_CONFORMANCE_TIMEOUT_MS'
        )
      : DEFAULT_TIMEOUT_MS,
    clientId: environment.AVATAR_CONFORMANCE_CLIENT_ID || DEFAULT_CLIENT_ID,
    displayName:
      environment.AVATAR_CONFORMANCE_DISPLAY_NAME || DEFAULT_DISPLAY_NAME,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--help' || flag === '-h') {
      options.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${flag} requires a value.`);
    }
    index += 1;
    switch (flag) {
      case '--url':
        options.url = value;
        break;
      case '--credential-file':
        options.credentialFile = path.resolve(value);
        break;
      case '--report':
        options.reportFile = path.resolve(value);
        break;
      case '--timeout-ms':
        options.timeoutMs = readPositiveInteger(value, flag);
        break;
      case '--client-id':
        options.clientId = value;
        break;
      case '--display-name':
        options.displayName = value;
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }

  const endpoint = new URL(options.url);
  if (endpoint.protocol !== 'ws:' && endpoint.protocol !== 'wss:') {
    throw new Error('--url must use ws:// or wss://.');
  }
  if (!options.clientId.trim()) throw new Error('--client-id cannot be empty.');
  if (!options.displayName.trim()) throw new Error('--display-name cannot be empty.');
  return options;
};

const isCredentialState = (value) =>
  value &&
  typeof value === 'object' &&
  value.schemaVersion === CREDENTIAL_SCHEMA_VERSION &&
  typeof value.clientId === 'string' &&
  typeof value.url === 'string' &&
  typeof value.reconnectCredential === 'string' &&
  value.reconnectCredential.length > 0;

export const readAvatarReconnectCredential = async (
  filePath,
  expectedClientId,
  expectedUrl
) => {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8'));
    if (
      !isCredentialState(parsed) ||
      parsed.clientId !== expectedClientId ||
      parsed.url !== expectedUrl
    ) {
      return undefined;
    }
    return parsed.reconnectCredential;
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return undefined;
    throw error;
  }
};

export const writeAvatarReconnectCredential = async (
  filePath,
  clientId,
  url,
  reconnectCredential
) => {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );
  const body = `${JSON.stringify(
    {
      schemaVersion: CREDENTIAL_SCHEMA_VERSION,
      clientId,
      url,
      reconnectCredential,
      updatedAt: new Date().toISOString()
    },
    null,
    2
  )}\n`;
  try {
    await writeFile(temporaryPath, body, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, filePath);
    await chmod(filePath, 0o600);
  } finally {
    await rm(temporaryPath, { force: true });
  }
};

const decodeRawMessage = (raw) => {
  const value = raw?.data ?? raw;
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value).toString('utf8');
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString(
      'utf8'
    );
  }
  return undefined;
};

const inspectAvatarWireMessage = (raw, monitor) => {
  const decoded = decodeRawMessage(raw);
  if (!decoded) return;
  let parsed;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    monitor.addIssue('invalid_json', 'Desktop sent invalid JSON.');
    return;
  }
  const isAvatarMessage =
    parsed?.type === 'avatar.subscribed' ||
    parsed?.type === 'avatar.subscription_error' ||
    (parsed?.type === 'event' &&
      typeof parsed?.payload?.name === 'string' &&
      parsed.payload.name.startsWith('avatar.'));
  if (!isAvatarMessage) return;
  const validation = validateAvatarProtocolMessage(parsed);
  if (!validation.success) monitor.addProtocolValidationIssues(validation.issues);
};

const createClient = (options, reconnectCredential, monitor) =>
  new LocalWebSocketClient({
    url: options.url,
    clientId: options.clientId,
    displayName: options.displayName,
    version: 'avatar-protocol-v1-conformance',
    reconnectCredential,
    webSocketFactory: (url) => {
      const socket = new WebSocket(url);
      socket.on('message', (raw) => inspectAvatarWireMessage(raw, monitor));
      return socket;
    }
  });

const ensureAuthorization = async (client, options, monitor) => {
  const welcome = await client.sendHello();
  if (!welcome.capabilities.includes(AVATAR_PROTOCOL_CAPABILITY)) {
    monitor.fail(
      'capability',
      'missing_capability',
      `Desktop does not advertise ${AVATAR_PROTOCOL_CAPABILITY}.`
    );
    throw new Error(`Desktop does not advertise ${AVATAR_PROTOCOL_CAPABILITY}.`);
  }
  monitor.pass('capability');
  if (welcome.authorizedScopes.includes('avatar.events.read')) {
    monitor.pass('authorization', 'Restored from persisted credential.');
    return client.getReconnectCredential();
  }

  process.stderr.write('Approve avatar access in the ai_licia Desktop app.\n');
  const grant = await client.requestAccess({
    scopes: ['avatar.events.read'],
    timeoutMs: options.timeoutMs
  });
  if (!grant.scopes.includes('avatar.events.read')) {
    monitor.fail(
      'authorization',
      'scope_not_granted',
      'Desktop did not grant avatar.events.read.'
    );
    throw new Error('Desktop did not grant avatar.events.read.');
  }
  const credential = client.getReconnectCredential();
  if (!credential) {
    monitor.fail(
      'authorization',
      'missing_reconnect_credential',
      'Desktop granted access without a reconnect credential.'
    );
    throw new Error('Desktop granted access without a reconnect credential.');
  }
  monitor.pass('authorization', 'Approved in Desktop.');
  await writeAvatarReconnectCredential(
    options.credentialFile,
    options.clientId,
    options.url,
    credential
  );
  return credential;
};

const reconnectWithCredential = async (client, credential, options, monitor) => {
  client.close();
  if (!credential) {
    monitor.fail(
      'reconnect',
      'missing_reconnect_credential',
      'No reconnect credential is available.'
    );
    throw new Error('No reconnect credential is available.');
  }
  const reconnected = createClient(options, credential, monitor);
  const welcome = await reconnected.sendHello();
  if (!welcome.authorizedScopes.includes('avatar.events.read')) {
    monitor.fail(
      'reconnect',
      'reconnect_not_authorized',
      'Reconnect did not restore avatar.events.read.'
    );
    reconnected.close();
    throw new Error('Reconnect did not restore avatar.events.read.');
  }
  monitor.pass('reconnect');
  return reconnected;
};

const waitForObservation = (monitor, timeoutMs) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (monitor.isComplete()) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve(false);
      }
    }, 25);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      resolve(true);
    }, Math.max(1, timeoutMs - (Date.now() - startedAt)));
  });

export const runAvatarLiveCheck = async (options) => {
  const monitor = new AvatarLiveConformanceMonitor({ endpoint: options.url });
  let client;
  try {
    const storedCredential = await readAvatarReconnectCredential(
      options.credentialFile,
      options.clientId,
      options.url
    );
    client = createClient(options, storedCredential, monitor);
    const credential = await ensureAuthorization(client, options, monitor);
    if (credential) {
      await writeAvatarReconnectCredential(
        options.credentialFile,
        options.clientId,
        options.url,
        credential
      );
    }
    client = await reconnectWithCredential(
      client,
      credential,
      options,
      monitor
    );

    let requestedActiveSnapshot = false;
    client.onAny((message) => {
      if (message.type !== 'event' || !message.payload.name.startsWith('avatar.')) {
        return;
      }
      monitor.observeEvent(message);
      if (
        message.payload.name === 'avatar.speech.started' &&
        !requestedActiveSnapshot
      ) {
        requestedActiveSnapshot = true;
        const requestId = `state_${randomUUID()}`;
        monitor.expectActiveSnapshot(requestId);
        void client.requestAvatarState({
          requestId,
          subscriptionId: monitor.subscriptionId,
          lastDeliverySequence: monitor.lastDeliverySequence
        }).catch((error) => {
          monitor.addIssue('state_request_failed', error.message);
        });
      }
    });

    const subscription = await client.subscribeAvatar({
      requestId: `subscribe_${randomUUID()}`,
      protocolVersion: 1,
      profiles: REQUIRED_PROFILES.map((id) => ({ id, required: true })),
      speechDriverPreference: ['avatar.mouth.amplitude.v1']
    });
    monitor.setSubscription(subscription);
    process.stderr.write(
      'Play one complete ai_licia TTS utterance. Waiting for live avatar events...\n'
    );
    const timedOut = await waitForObservation(monitor, options.timeoutMs);
    return monitor.finish({ timedOut });
  } catch (error) {
    return monitor.finish({
      fatalError: error instanceof Error ? error.message : String(error)
    });
  } finally {
    client?.close();
  }
};

const usage = `Usage: npm run conformance:avatar -- [options]\n\nOptions:\n  --url <ws-url>             Desktop WebSocket URL (default: ${DEFAULT_URL})\n  --credential-file <path>   Durable reconnect credential file\n  --report <path>            Also write the JSON report to this file\n  --timeout-ms <ms>          Consent and observation timeout (default: ${DEFAULT_TIMEOUT_MS})\n  --client-id <id>           Stable integration client ID\n  --display-name <name>      Name shown in Desktop consent\n  --help                     Show this help\n`;

const writeReport = async (report, reportFile) => {
  const body = `${JSON.stringify(report, null, 2)}\n`;
  process.stdout.write(body);
  if (!reportFile) return;
  await mkdir(path.dirname(reportFile), { recursive: true });
  await writeFile(reportFile, body, 'utf8');
};

const main = async () => {
  let options;
  try {
    options = parseAvatarLiveCheckArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    process.stdout.write(usage);
    return;
  }
  const report = await runAvatarLiveCheck(options);
  await writeReport(report, options.reportFile);
  if (report.status !== 'passed') process.exitCode = 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
