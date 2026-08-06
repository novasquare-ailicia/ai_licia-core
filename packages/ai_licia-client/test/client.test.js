const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AiliciaClient,
  AiliciaApiError,
  AILICIA_EVENT_CONTENT_LIMITS
} = require('../dist');

test('uses Bearer authentication for API requests', () => {
  const client = new AiliciaClient('api-key', 'channel', 'https://example.test/v1');

  assert.equal(client.client.defaults.headers.Authorization, 'Bearer api-key');
});

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

test('triggerGeneration preserves a typed rate-limit response', async () => {
  const client = new AiliciaClient('api-key', 'channel', 'https://example.test/v1');
  client.client.post = async () => {
    throw {
      isAxiosError: true,
      message: 'Request failed with status code 429',
      response: {
        status: 429,
        data: { message: 'Rate limit exceeded' }
      }
    };
  };

  await assert.rejects(
    client.triggerGeneration('Live racing advice'),
    (error) => {
      assert.ok(error instanceof AiliciaApiError);
      assert.equal(error.status, 429);
      assert.equal(error.code, 'rate_limited');
      assert.match(error.message, /Too many requests/);
      return true;
    }
  );
});

test('triggerGeneration does not assume every 401 is a channel mismatch', async () => {
  const client = new AiliciaClient('api-key', 'channel', 'https://example.test/v1');
  client.client.post = async () => {
    throw {
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: { status: 401, data: {} }
    };
  };

  await assert.rejects(
    client.triggerGeneration('Live racing advice'),
    (error) => {
      assert.ok(error instanceof AiliciaApiError);
      assert.equal(error.status, 401);
      assert.equal(error.code, 'unauthorized');
      assert.doesNotMatch(error.message, /API key belongs to channel/i);
      return true;
    }
  );
});
