const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const {
  AVATAR_AUDIO_PROFILES,
  AVATAR_AUDIO_TRANSPORTS,
  AVATAR_PROTOCOL_CAPABILITY,
  AVATAR_PROTOCOL_VERSION,
  AvatarProtocolMessageSchema,
  decodeAvatarBinaryAudioFrame,
  validateAvatarProtocolMessage,
  validateAvatarProtocolSequence
} = require('../dist');

const fixtures = JSON.parse(readFileSync(
  join(__dirname, '../schema/avatar-protocol.v1.fixtures.json'),
  'utf8'
));

test('exports the stable v1 capability and executable JSON schema', () => {
  assert.equal(AVATAR_PROTOCOL_CAPABILITY, 'avatar.protocol.v1');
  assert.equal(AVATAR_PROTOCOL_VERSION, 1);
  assert.equal(AvatarProtocolMessageSchema.$id, 'https://schemas.getailicia.com/avatar/protocol/v1/message.schema.json');
  assert.deepEqual(AVATAR_AUDIO_PROFILES, [
    'avatar.audio.pcm-s16le.v1',
    'avatar.audio.opus.v1'
  ]);
  assert.deepEqual(AVATAR_AUDIO_TRANSPORTS, ['binary-v1', 'json-base64']);
});

test('decodes a binary-v1 audio frame without losing 64-bit-safe metadata', () => {
  const audioItemId = Buffer.from('audio_fixture', 'utf8');
  const payload = Buffer.from([1, 2, 3, 4]);
  const frame = Buffer.alloc(30 + audioItemId.length + payload.length);
  frame.write('AVP1', 0, 'ascii');
  frame.writeUInt8(1, 4);
  frame.writeUInt8(1, 5);
  frame.writeUInt16BE(0, 6);
  frame.writeBigUInt64BE(42n, 8);
  frame.writeUInt32BE(7, 16);
  frame.writeBigUInt64BE(960n, 20);
  frame.writeUInt16BE(audioItemId.length, 28);
  audioItemId.copy(frame, 30);
  payload.copy(frame, 30 + audioItemId.length);

  const decoded = decodeAvatarBinaryAudioFrame(frame);
  assert.ok(decoded);
  assert.equal(decoded.deliverySequence, 42);
  assert.equal(decoded.chunkIndex, 7);
  assert.equal(decoded.sampleOffset, 960);
  assert.equal(decoded.audioItemId, 'audio_fixture');
  assert.deepEqual([...decoded.data], [1, 2, 3, 4]);
  assert.equal(decodeAvatarBinaryAudioFrame(Buffer.from('not-a-frame')), undefined);
});

for (const fixture of fixtures.validSequences) {
  test(`accepts fixture: ${fixture.name}`, () => {
    for (const message of fixture.messages) {
      assert.equal(validateAvatarProtocolMessage(message).success, true);
    }
    assert.deepEqual(validateAvatarProtocolSequence(fixture.messages), []);
  });
}

for (const fixture of fixtures.invalidMessages) {
  test(`rejects fixture: ${fixture.name}`, () => {
    assert.equal(validateAvatarProtocolMessage(fixture.message).success, false);
  });
}

for (const fixture of fixtures.invalidSequences) {
  test(`rejects sequence fixture: ${fixture.name}`, () => {
    assert.notEqual(validateAvatarProtocolSequence(fixture.messages).length, 0);
  });
}

test('rejects a prepared tone without exact message and audio identifiers', () => {
  const result = validateAvatarProtocolMessage({
    type: 'event',
    payload: {
      name: 'avatar.speech.prepared',
      data: {
        schemaVersion: 1,
        avatarSessionId: 'avs_fixture',
        subscriptionId: 'asub_fixture',
        deliverySequence: 1,
        emittedAtMs: 1,
        utteranceId: 'utt_fixture',
        toneId: 'cheerful',
        activeSpeechDriver: 'avatar.mouth.amplitude.v1',
        availableProfiles: ['avatar.mouth.amplitude.v1']
      }
    }
  });
  assert.equal(result.success, false);
});
