const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, stat } = require('node:fs/promises');
const { once } = require('node:events');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { WebSocketServer } = require('ws');
const { AvatarLiveConformanceMonitor } = require('../dist');

const liveCheck = import('../../../scripts/avatar-protocol-live-check.mjs');

const event = (name, deliverySequence, data) => ({
  type: 'event',
  payload: {
    name,
    data: {
      schemaVersion: 1,
      avatarSessionId: 'session-1',
      subscriptionId: 'subscription-1',
      deliverySequence,
      emittedAtMs: deliverySequence,
      ...data
    }
  }
});

const passConnectionChecks = (monitor) => {
  monitor.pass('capability');
  monitor.pass('authorization');
  monitor.pass('reconnect');
  monitor.setSubscription({
    avatarSessionId: 'session-1',
    subscriptionId: 'subscription-1',
    acceptedProfiles: [
      'avatar.speech.lifecycle.v1',
      'avatar.mouth.amplitude.v1'
    ]
  });
};

test('parses bounded live-check options', async () => {
  const { parseAvatarLiveCheckArgs } = await liveCheck;
  const options = parseAvatarLiveCheckArgs([
    '--url',
    'ws://127.0.0.1:60000',
    '--timeout-ms',
    '5000',
    '--client-id',
    'test-client'
  ], {});
  assert.equal(options.url, 'ws://127.0.0.1:60000');
  assert.equal(options.timeoutMs, 5000);
  assert.equal(options.clientId, 'test-client');
  assert.throws(
    () => parseAvatarLiveCheckArgs(['--url', 'https://example.com'], {}),
    /ws:\/\/ or wss:\/\//
  );
});

test('persists only the matching reconnect credential with private permissions', async () => {
  const {
    readAvatarReconnectCredential,
    writeAvatarReconnectCredential
  } = await liveCheck;
  const directory = await mkdtemp(path.join(tmpdir(), 'avatar-conformance-'));
  const filePath = path.join(directory, 'credential.json');
  try {
    await writeAvatarReconnectCredential(
      filePath,
      'test-client',
      'ws://127.0.0.1:51743',
      'secret-value'
    );
    assert.equal(
      await readAvatarReconnectCredential(
        filePath,
        'test-client',
        'ws://127.0.0.1:51743'
      ),
      'secret-value'
    );
    assert.equal(
      await readAvatarReconnectCredential(
        filePath,
        'another-client',
        'ws://127.0.0.1:51743'
      ),
      undefined
    );
    const mode = (await stat(filePath)).mode & 0o777;
    assert.equal(mode, 0o600);
    const stored = JSON.parse(await readFile(filePath, 'utf8'));
    assert.deepEqual(Object.keys(stored).sort(), [
      'clientId',
      'reconnectCredential',
      'schemaVersion',
      'updatedAt',
      'url'
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('accepts a complete live baseline sequence with an active snapshot', async () => {
  const monitor = new AvatarLiveConformanceMonitor({
    endpoint: 'ws://127.0.0.1:51743'
  });
  passConnectionChecks(monitor);
  monitor.observeEvent(event('avatar.state.snapshot', 1, {
    selectedProfiles: [
      'avatar.speech.lifecycle.v1',
      'avatar.mouth.amplitude.v1'
    ],
    activeUtterance: null
  }));
  monitor.observeEvent(event('avatar.speech.prepared', 2, {
    utteranceId: 'message-1',
    sourceMessageId: 'message-1',
    audioItemId: 'message-1',
    durationMs: 1000,
    activeSpeechDriver: 'avatar.mouth.amplitude.v1',
    availableProfiles: ['avatar.mouth.amplitude.v1']
  }));
  monitor.observeEvent(event('avatar.speech.started', 3, {
    utteranceId: 'message-1',
    playbackOffsetMs: 0
  }));
  monitor.expectActiveSnapshot('state-1');
  monitor.observeEvent(event('avatar.mouth.amplitude', 4, {
    utteranceId: 'message-1',
    offsetMs: 50,
    value: 0.7
  }));
  monitor.observeEvent(event('avatar.state.snapshot', 5, {
    requestId: 'state-1',
    selectedProfiles: [
      'avatar.speech.lifecycle.v1',
      'avatar.mouth.amplitude.v1'
    ],
    activeUtterance: {
      utteranceId: 'message-1',
      state: 'playing',
      playbackOffsetMs: 60,
      sourceMessageId: 'message-1',
      audioItemId: 'message-1',
      activeSpeechDriver: 'avatar.mouth.amplitude.v1',
      availableProfiles: ['avatar.mouth.amplitude.v1']
    }
  }));
  monitor.observeEvent(event('avatar.mouth.amplitude', 6, {
    utteranceId: 'message-1',
    offsetMs: 1000,
    value: 0
  }));
  monitor.observeEvent(event('avatar.speech.ended', 7, {
    utteranceId: 'message-1',
    playbackOffsetMs: 1000,
    reason: 'completed'
  }));

  assert.equal(monitor.isComplete(), true);
  const report = monitor.finish();
  assert.equal(report.status, 'passed');
  assert.equal(report.metrics.events, 7);
  assert.equal(report.metrics.positiveAmplitudeSamples, 1);
  assert.deepEqual(report.issues, []);
});

test('fails gaps and prepared utterances without exact identity', async () => {
  const monitor = new AvatarLiveConformanceMonitor({
    endpoint: 'ws://127.0.0.1:51743'
  });
  passConnectionChecks(monitor);
  monitor.observeEvent(event('avatar.state.snapshot', 1, {
    selectedProfiles: [
      'avatar.speech.lifecycle.v1',
      'avatar.mouth.amplitude.v1'
    ],
    activeUtterance: null
  }));
  monitor.observeEvent(event('avatar.speech.prepared', 3, {
    utteranceId: 'message-1',
    durationMs: 1000,
    activeSpeechDriver: 'avatar.mouth.amplitude.v1',
    availableProfiles: ['avatar.mouth.amplitude.v1']
  }));
  const report = monitor.finish({ timedOut: true });
  assert.equal(report.status, 'failed');
  assert.ok(report.issues.some((issue) => issue.code === 'delivery_sequence_gap'));
  assert.ok(report.issues.some((issue) => issue.code === 'missing_exact_identity'));
});

test('runs the authenticated reconnect and live observation flow', async () => {
  const { runAvatarLiveCheck } = await liveCheck;
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const address = server.address();
  assert.notEqual(typeof address, 'string');
  const endpoint = `ws://127.0.0.1:${address.port}`;
  const credential = 'test-reconnect-credential';
  const directory = await mkdtemp(path.join(tmpdir(), 'avatar-live-flow-'));
  const credentialFile = path.join(directory, 'credential.json');

  server.on('connection', (socket) => {
    let authorized = false;
    let sequence = 0;
    const send = (message) => socket.send(JSON.stringify(message));
    const sendEvent = (name, data) => send({
      type: 'event',
      payload: {
        name,
        data: {
          schemaVersion: 1,
          avatarSessionId: 'session-live',
          subscriptionId: 'subscription-live',
          deliverySequence: ++sequence,
          emittedAtMs: Date.now(),
          ...data
        }
      }
    });

    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString('utf8'));
      if (message.type === 'hello') {
        authorized = message.payload.reconnectCredential === credential;
        send({
          type: 'welcome',
          payload: {
            capabilities: ['integration.auth', 'avatar.protocol.v1'],
            authorizedScopes: authorized ? ['avatar.events.read'] : []
          }
        });
        return;
      }
      if (message.type === 'request_access') {
        send({ type: 'access_pending', payload: { requestId: 'request-live' } });
        send({
          type: 'access_granted',
          payload: {
            requestId: 'request-live',
            scopes: ['avatar.events.read'],
            reconnectCredential: credential
          }
        });
        return;
      }
      if (message.type === 'avatar.subscribe' && authorized) {
        send({
          type: 'avatar.subscribed',
          payload: {
            requestId: message.payload.requestId,
            protocolVersion: 1,
            avatarSessionId: 'session-live',
            subscriptionId: 'subscription-live',
            acceptedProfiles: [
              'avatar.speech.lifecycle.v1',
              'avatar.mouth.amplitude.v1'
            ],
            rejectedProfiles: []
          }
        });
        setTimeout(() => {
          sendEvent('avatar.state.snapshot', {
            selectedProfiles: [
              'avatar.speech.lifecycle.v1',
              'avatar.mouth.amplitude.v1'
            ],
            activeUtterance: null
          });
          sendEvent('avatar.speech.prepared', {
            utteranceId: 'message-live',
            sourceMessageId: 'message-live',
            audioItemId: 'message-live',
            durationMs: 1000,
            activeSpeechDriver: 'avatar.mouth.amplitude.v1',
            availableProfiles: ['avatar.mouth.amplitude.v1']
          });
          sendEvent('avatar.speech.started', {
            utteranceId: 'message-live',
            playbackOffsetMs: 0
          });
        }, 5);
        return;
      }
      if (message.type === 'avatar.get_state' && authorized) {
        sendEvent('avatar.state.snapshot', {
          requestId: message.payload.requestId,
          selectedProfiles: [
            'avatar.speech.lifecycle.v1',
            'avatar.mouth.amplitude.v1'
          ],
          activeUtterance: {
            utteranceId: 'message-live',
            state: 'playing',
            playbackOffsetMs: 25,
            sourceMessageId: 'message-live',
            audioItemId: 'message-live',
            activeSpeechDriver: 'avatar.mouth.amplitude.v1',
            availableProfiles: ['avatar.mouth.amplitude.v1']
          }
        });
        sendEvent('avatar.mouth.amplitude', {
          utteranceId: 'message-live',
          offsetMs: 50,
          value: 0.8
        });
        sendEvent('avatar.mouth.amplitude', {
          utteranceId: 'message-live',
          offsetMs: 1000,
          value: 0
        });
        sendEvent('avatar.speech.ended', {
          utteranceId: 'message-live',
          playbackOffsetMs: 1000,
          reason: 'completed'
        });
      }
    });
  });

  try {
    const report = await runAvatarLiveCheck({
      url: endpoint,
      credentialFile,
      timeoutMs: 2000,
      clientId: 'test-live-client',
      displayName: 'Test Live Client'
    });
    assert.equal(report.status, 'passed');
    assert.deepEqual(report.issues, []);
    assert.equal(report.metrics.events, 7);
    assert.equal(JSON.stringify(report).includes(credential), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
