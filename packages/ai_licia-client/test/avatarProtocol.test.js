const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const {
  AVATAR_PROTOCOL_CAPABILITY,
  AVATAR_PROTOCOL_VERSION,
  AvatarProtocolMessageSchema,
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
