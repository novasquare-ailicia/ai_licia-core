const assert = require('node:assert/strict');
const test = require('node:test');
const { LocalWebSocketClient } = require('../dist');

class FakeSocket {
  constructor() {
    this.readyState = 0;
    this.sent = [];
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = 3;
    this.emit('close', {});
  }

  open() {
    this.readyState = 1;
    this.emit('open', {});
  }

  receive(message) {
    this.emit('message', { data: JSON.stringify(message) });
  }

  receiveBinary(data) {
    this.emit('message', { data });
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
}

const connectClient = async (options = {}) => {
  let socket;
  const client = new LocalWebSocketClient({
    clientId: 'unreal-pilot',
    displayName: 'Unreal Pilot',
    webSocketFactory: () => {
      socket = new FakeSocket();
      return socket;
    },
    ...options
  });
  const connected = client.connect();
  socket.open();
  await connected;
  return { client, socket };
};

test('hello restores avatar scope with an opaque reconnect credential', async () => {
  const { client, socket } = await connectClient({ reconnectCredential: 'aig_secret' });
  const welcomePromise = client.sendHello();
  assert.equal(socket.sent[0].type, 'hello');
  assert.equal(socket.sent[0].payload.reconnectCredential, 'aig_secret');
  socket.receive({
    type: 'welcome',
    payload: {
      capabilities: ['events', 'avatar.protocol.v1'],
      authorizedScopes: ['avatar.events.read']
    }
  });
  const welcome = await welcomePromise;
  assert.deepEqual(welcome.authorizedScopes, ['avatar.events.read']);
});

test('avatar-only access grants do not require a REST API key', async () => {
  const { client, socket } = await connectClient();
  const accessPromise = client.requestAccess({ scopes: ['avatar.events.read'] });
  socket.receive({
    type: 'welcome',
    payload: { capabilities: ['integration.auth', 'avatar.protocol.v1'] }
  });
  await new Promise((resolve) => setImmediate(resolve));
  const request = socket.sent.find((message) => message.type === 'request_access');
  assert.ok(request);
  socket.receive({ type: 'access_pending', payload: { requestId: 'req-1' } });
  socket.receive({
    type: 'access_granted',
    payload: {
      requestId: 'req-1',
      scopes: ['avatar.events.read'],
      reconnectCredential: 'aig_new_secret'
    }
  });
  const grant = await accessPromise;
  assert.equal(grant.apiKey, undefined);
  assert.equal(client.getReconnectCredential(), 'aig_new_secret');
});

test('subscribes to avatar profiles and dispatches validated snapshots', async () => {
  const { client, socket } = await connectClient();
  const welcomePromise = client.sendHello();
  socket.receive({
    type: 'welcome',
    payload: {
      capabilities: ['avatar.protocol.v1'],
      authorizedScopes: ['avatar.events.read']
    }
  });
  await welcomePromise;

  let snapshot;
  client.onEvent('avatar.state.snapshot', (payload) => {
    snapshot = payload;
  });
  const subscribedPromise = client.subscribeAvatar({
    requestId: 'sub-1',
    protocolVersion: 1,
    profiles: [
      { id: 'avatar.speech.lifecycle.v1', required: true },
      { id: 'avatar.mouth.amplitude.v1', required: true }
    ],
    speechDriverPreference: ['avatar.mouth.amplitude.v1']
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(socket.sent.some((message) => message.type === 'avatar.subscribe'));
  socket.receive({
    type: 'avatar.subscribed',
    payload: {
      requestId: 'sub-1',
      protocolVersion: 1,
      avatarSessionId: 'avs-1',
      subscriptionId: 'asub-1',
      acceptedProfiles: [
        'avatar.speech.lifecycle.v1',
        'avatar.mouth.amplitude.v1'
      ],
      rejectedProfiles: []
    }
  });
  const subscribed = await subscribedPromise;
  assert.equal(subscribed.subscriptionId, 'asub-1');

  socket.receive({
    type: 'event',
    payload: {
      name: 'avatar.state.snapshot',
      data: {
        schemaVersion: 1,
        avatarSessionId: 'avs-1',
        subscriptionId: 'asub-1',
        deliverySequence: 1,
        emittedAtMs: 1,
        selectedProfiles: [
          'avatar.speech.lifecycle.v1',
          'avatar.mouth.amplitude.v1'
        ],
        activeUtterance: null
      }
    }
  });
  assert.equal(snapshot.deliverySequence, 1);
});

test('dispatches negotiated binary-v1 audio frames to typed handlers', async () => {
  const { client, socket } = await connectClient();
  let received;
  client.onBinaryAudio((frame) => {
    received = frame;
  });

  const audioItemId = Buffer.from('audio-1', 'utf8');
  const payload = Buffer.from([0xf8, 0xff, 0xfe]);
  const frame = Buffer.alloc(30 + audioItemId.length + payload.length);
  frame.write('AVP1', 0, 'ascii');
  frame.writeUInt8(1, 4);
  frame.writeUInt8(1, 5);
  frame.writeUInt16BE(0, 6);
  frame.writeBigUInt64BE(5n, 8);
  frame.writeUInt32BE(2, 16);
  frame.writeBigUInt64BE(1920n, 20);
  frame.writeUInt16BE(audioItemId.length, 28);
  audioItemId.copy(frame, 30);
  payload.copy(frame, 30 + audioItemId.length);

  socket.receiveBinary(frame);
  assert.ok(received);
  assert.equal(received.deliverySequence, 5);
  assert.equal(received.audioItemId, 'audio-1');
  assert.deepEqual([...received.data], [...payload]);
});
