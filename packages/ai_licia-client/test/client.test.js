const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AiliciaClient,
  AILICIA_EVENT_CONTENT_LIMITS
} = require('../dist');

test('sendEvent accepts exactly the documented context limit', async () => {
  const client = new AiliciaClient('api-key', 'channel', 'https://example.test/v1');
  let postedEvent;
  client.client.post = async (_path, event) => {
    postedEvent = event;
  };

  const content = 'x'.repeat(AILICIA_EVENT_CONTENT_LIMITS.context);
  await client.sendEvent(content, 60);

  assert.equal(postedEvent.data.content, content);
});

test('sendEvent rejects content above the documented context limit', async () => {
  const client = new AiliciaClient('api-key', 'channel', 'https://example.test/v1');
  const content = 'x'.repeat(AILICIA_EVENT_CONTENT_LIMITS.context + 1);

  await assert.rejects(
    client.sendEvent(content),
    new RegExp(`${AILICIA_EVENT_CONTENT_LIMITS.context}-character limit`)
  );
});
