# ai_licia Client

<p align="center">
    <a href="https://www.npmjs.com/package/ai_licia-client">
        <img alt="npm" src="https://img.shields.io/npm/v/ai_licia-client?style=flat-square">
    </a>
</p>

A TypeScript/JavaScript client library for interacting with with [ai_licia AI Co-Host](https://www.getailicia.com) API, allowing you to send context data and trigger reactions from ai_licia in your Twitch stream.

## Installation

```bash
npm install ai_licia-client
```

## Configuration

You can configure the client using environment variables:

```
AI_LICIA_API_URL=https://api.getailicia.com/v1
AI_LICIA_API_KEY=your-api-key
AI_LICIA_CHANNEL=your-channel-name
```

Or you can provide them directly when initializing the client.

## Usage

### Basic Usage

```typescript
import { AiliciaClient, GenerationMode } from 'ai_licia-client';

// Create a new client
const client = new AiliciaClient(
  'your-api-key',    // Optional, will use environment variable if not provided
  'your-channel',    // Optional, will use environment variable if not provided
  'https://api.getailicia.com/v1'  // Optional, will use environment variable or the default if not provided
);

// Send contextual information to ai_licia (max 1,000 characters)
await client.sendEvent('Player health: 85%, Position: X:145 Y:230, Kills: 12');

// Trigger an immediate reaction from ai_licia (max 300 characters)
const response = await client.triggerGeneration('Player just defeated the final boss!');

// Listen to the live message stream
const messageStream = client.streamPublicChatMessages({
  roles: ['AI', 'Streamer'],
  onOpen: () => console.log('Listening to ai_licia and the streamer'),
  onMessage: (message) => console.log(`${message.role}: ${message.content}`),
  onError: (error) => console.error('Stream error', error),
  onClose: () => console.log('Stream closed')
});

// Stop streaming whenever you need to
messageStream.close();

// Fetch characters and rotate personas
const characters = await client.listCharacters();
const chillPersona = characters.find((c) => !c.isActive);
if (chillPersona) {
  await client.setActiveCharacter(chillPersona.id);
}

// Ask ai_licia to join chat (defaults to the configured channel)
await client.requestStreamJoin();

// Ask ai_licia to join in TEST mode
await client.requestStreamJoin({ mode: 'TEST' });

// Read runtime status for controlled channels
const statuses = await client.getChannelRuntimeStatus();
console.log(statuses);
```

## API Reference

### `AiliciaClient`

The main class for interacting with the ai_licia API. ([Official Documentation](https://docs.getailicia.com/publicevents.html))

#### Constructor

```typescript
new AiliciaClient(apiKey?: string, channelName?: string, baseUrl?: string)
```

#### Methods

##### `sendEvent(content: string, ttl?: number): Promise<void>`

Replaces the single current game snapshot (max 1,000 characters) without forcing a response. Use one active game integration. `ttl` is optional; omitting it preserves the existing non-expiring game context behaviour. Send empty content to clear the game block.

```typescript
await client.sendEvent('Day 12, raining. Player at the farm.', 60);
```

##### `sendIntegrationState(sourceId: string, content: string, ttl?: number): Promise<void>`

**Upcoming:** requires the new backend rollout and the next published SDK release.

Replaces only this source's complete snapshot in the separate integration context block. Other integrations and game state remain available. Source IDs match `[a-z0-9][a-z0-9._-]{0,63}` and are scoped to the authenticated channel. Content is at most 1,000 characters. TTL defaults to 60 seconds and accepts integers from 1 to 86,400. Refresh before expiry while connected. Sixteen active sources are retained; adding a seventeenth removes the least recently updated. State belongs to the active AI session, survives worker relocation, and should be resent after a new session starts.

```typescript
await client.sendIntegrationState('obs', 'Streaming. Scene: Gameplay.', 60);
await client.sendIntegrationState('lumia', 'Lights: purple.', 120);
await client.sendIntegrationState('spotify', 'Current track: Example song.');
```

##### `clearIntegrationState(sourceId: string): Promise<void>`

Removes only the named source. Equivalent to `sendIntegrationState(sourceId, '')`. Whitespace-only content also clears the entry.

```typescript
await client.clearIntegrationState('obs');
```

##### `triggerGeneration(content: string, options?: GenerationOptions): Promise<GenerationResponse>`

Triggers ai_licia to generate an immediate response to a specific event or moment. This creates a one-off reaction from ai_licia that will appear in your stream.

**Use cases:**
- Player just defeated a boss
- Viewer redeemed channel points for ai_licia to roast them
- Plane crash in a simulator
- Reaching a milestone in-game
- Reaction to a funny/epic moment

**Parameters:**
- `content`: What ai_licia should react to (max 300 characters)
- `options.mode`: `GenerationMode.STANDARD` by default, or `GenerationMode.FAST` for brief, time-sensitive reactions. Fast mode changes model execution only. It does not rewrite the content.
- `options.tts`: Whether the generated response should be sent to text-to-speech. Defaults to `true`.
- `options.ttl`: Optional positive integer lifetime in seconds. If the event is not consumed in time, it is discarded instead of producing stale commentary.

```typescript
// Examples
await client.triggerGeneration('Player just pulled a legendary sword from the stone!');
await client.triggerGeneration('Viewer "GameMaster42" redeemed points for an ai_licia roast');
await client.triggerGeneration('Plane crashed into the mountain. Total damage: $2.5M');

await client.triggerGeneration('Tyre puncture. Briefly tell the driver to pit safely.', {
  mode: GenerationMode.FAST,
  tts: true,
  ttl: 8
});
```

##### `streamPublicChatMessages(options: ChatMessageStreamOptions): ChatMessageStream`

Connects to the public chat message stream (Server-Sent Events) so you can react to realtime chat data within your tooling.

**Parameters:**
- `roles` *(optional)*: Filter the stream for specific roles (`'Mod' | 'VIP' | 'AI' | 'Viewer' | 'Streamer'`)
- `onMessage`: Required callback invoked with the parsed `PublicChatMessage`
- `onOpen`, `onError`, `onClose`: Optional lifecycle callbacks

```typescript
const stream = client.streamPublicChatMessages({
  roles: ['AI'],
  onOpen: () => console.log('Connected to ai_licia chat stream'),
  onMessage: (message) => {
    if (message.role === 'AI') {
      console.log(`ai_licia: ${message.content}`);
    }
  },
  onError: (error) => console.error('Stream error:', error.message),
  onClose: () => console.log('Stream closed')
});

// Later, when you want to disconnect:
stream.close();
```

##### `listCharacters(): Promise<CharacterSummary[]>`

Returns the list of personas linked to your account (id, name, description, `isActive` flag).

```typescript
const characters = await client.listCharacters();
characters.forEach((character) =>
  console.log(`${character.name} - ${character.isActive ? 'active' : 'inactive'}`)
);
```

##### `setActiveCharacter(characterId: string): Promise<void>`

Switches the active persona for ai_licia.

```typescript
await client.setActiveCharacter('char_123');
```

##### `requestStreamJoin(channelName?: string, mode?: JoinMode): Promise<JoinChannelResponse>`
##### `requestStreamJoin(options?: RequestStreamJoinOptions): Promise<JoinChannelResponse>`

Asks ai_licia to join chat immediately. Omitting `channelName` uses the one configured in the client.
`mode` defaults to `LIVE`; use `TEST` to trigger demo/test join behavior.

```typescript
const join = await client.requestStreamJoin();
if (!join.success) {
  console.warn('Join failed', join.message);
}

const testJoin = await client.requestStreamJoin({ mode: 'TEST' });
console.log(testJoin.message);
```

##### `requestStreamLeave(channelName?: string): Promise<void>`

Queues a leave request for ai_licia on the target channel.

```typescript
await client.requestStreamLeave('backupChannel');
```

##### `getChannelRuntimeStatus(): Promise<ChannelRuntimeStatus[]>`

Returns runtime status for channels controlled by the API key owner.
Each item contains: `channelName`, `isPrimary`, `isLive`, `isAiInChat`.

```typescript
const statuses = await client.getChannelRuntimeStatus();
for (const status of statuses) {
  console.log(`${status.channelName}: live=${status.isLive}, inChat=${status.isAiInChat}`);
}
```

##### `streamEventSub(auth: EventSubAuth, options?: EventSubStreamOptions): EventSubStream`

Connects to the unified EventSub SSE stream (chat, AI, channel, system, moderation, character events) and returns an event-emitter style handle.

```typescript
const eventStream = client.streamEventSub(
  { type: 'jwt', token: viewerJwt },
  {
    types: ['chat.message', 'ai.tts.generated'],
    autoReconnect: true,
    handlers: {
      'chat.message': (event) => {
        console.log(`[${event.payload.platform}] ${event.payload.username}: ${event.payload.message}`);
      }
    }
  }
);

eventStream
  .on('ai.tts.generated', (event) => {
    console.log(`New TTS clip at ${event.payload.ttsStreamUrl}`);
  })
  .onAny((event) => console.log(`Received ${event.type}`));

// Stop streaming
eventStream.close();
```

Notes:
- `auth` must be either `{ type: 'jwt', token: '...' }` (frontend JWT) or `{ type: 'apiKey', key: '...' }` (external clients).
- Browsers cannot set headers on native `EventSource`. Use the client method (fetch streaming) or an `EventSource` polyfill that supports headers. Do not put tokens in query strings.


## Error Handling

The client throws descriptive errors when API calls fail. You can catch these errors to handle them gracefully:

```typescript
try {
  await client.sendEvent('Player entered the final dungeon');
} catch (error) {
  console.error('Failed to send event:', error.message);
}
```

Common errors:
- Content length exceeding limits (1,000 chars for events, 300 chars for generations)
- API key authorization issues
- Rate limiting (too many requests)

## Environment Setup

You can use environment variables with dotenv by creating a `.env` file:

```
AI_LICIA_API_KEY=your_api_key_here
AI_LICIA_CHANNEL=your_twitch_channel_name
```

Then in your code:

```typescript
import { AiliciaClient } from 'ai_licia-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create client using environment variables
const client = new AiliciaClient();

// Now you can use client.sendEvent() and client.triggerGeneration()
```

## Avatar Protocol v1

The package exports the strongly typed `avatar.protocol.v1` contract, runtime validation, and a client for the Desktop application's authenticated local WebSocket.

```typescript
import { LocalWebSocketClient } from 'ai_licia-client';

const client = new LocalWebSocketClient({
  clientId: 'com.example.unreal-renderer',
  displayName: 'Example Unreal Renderer',
  reconnectCredential: loadCredential()
});

await client.connect();
const welcome = await client.sendHello();

if (!welcome.authorizedScopes.includes('avatar.events.read')) {
  const grant = await client.requestAccess({
    scopes: ['avatar.events.read']
  });
  if (grant.reconnectCredential) saveCredential(grant.reconnectCredential);
}

client.onEvent('avatar.state.snapshot', (snapshot) => {
  console.log('Avatar state', snapshot);
});

client.onEvent('avatar.mouth.amplitude', (sample) => {
  console.log(sample.utteranceId, sample.offsetMs, sample.value);
});

client.onBinaryAudio((frame) => {
  playNegotiatedAudioFrame(frame.audioItemId, frame.data);
});

await client.subscribeAvatar({
  requestId: crypto.randomUUID(),
  protocolVersion: 1,
  profiles: [
    { id: 'avatar.speech.lifecycle.v1', required: true },
    { id: 'avatar.mouth.amplitude.v1', required: true },
    { id: 'avatar.audio.opus.v1', required: false },
    { id: 'avatar.audio.pcm-s16le.v1', required: false }
  ],
  speechDriverPreference: ['avatar.mouth.amplitude.v1'],
  audioTransportPreference: ['binary-v1', 'json-base64'],
  audioFormatPreference: [
    {
      profile: 'avatar.audio.opus.v1',
      sampleRateHz: 48000,
      channels: 1,
      frameDurationMs: 20,
      bitrateBps: 24000
    },
    {
      profile: 'avatar.audio.pcm-s16le.v1',
      sampleRateHz: 24000,
      channels: 1
    }
  ]
});
```

Audio is optional and uses the same authorized WebSocket and subscription as the avatar events. Desktop currently offers mono PCM S16LE at 24, 44.1, or 48 kHz and mono Opus at 24 or 48 kHz with 20, 40, or 60 ms frames. Format preference and transport preference are separate: `binary-v1` avoids Base64 overhead, while `json-base64` delivers `avatar.audio.chunk` events. Read the selected `audioTransport` and `audioFormat` from `avatar.subscribed` and the final stream metadata from `avatar.audio.prepared`.

The SDK dispatches `binary-v1` chunks through `onBinaryAudio`. JSON audio uses the normal `avatar.audio.chunk` event handler. Clients that do not request an audio profile receive no audio data.

The generated JSON Schema is shipped at `schema/avatar-protocol.v1.schema.json`. The package also exports `validateAvatarProtocolMessage` and `validateAvatarProtocolSequence` for adapters that need runtime validation.

For integration development without Desktop, run the local simulator from the repository root:

```bash
npm run simulator:avatar
```

It listens on `ws://127.0.0.1:51744`, grants only the avatar scope, and emits a deterministic lifecycle, amplitude, and optional PCM stream. The simulator currently selects `json-base64`; use Desktop to test negotiated Opus and binary delivery.

## Official Integrations & Partnerships

Are you a game developer, app creator, or platform looking to build a deeper integration with ai_licia? We welcome partnerships to create official, branded integrations that enhance the streaming experience!

### Who Should Reach Out

- **Game Studios**: Create direct integrations that allow ai_licia to react to in-game events in real time
- **App Developers**: Integrate ai_licia into your streaming tools, bots, or community platforms
- **Hardware Manufacturers**: Connect physical devices, alerts, or hardware state to ai_licia
- **Platform Creators**: Build ai_licia capabilities into your streaming or content creation platform

### Partnership Benefits

- **Co-Marketing**: Joint promotion of your integration to the ai_licia community
- **Technical Support**: Direct access to our development team
- **API Enhancements**: Potential for custom endpoints to support your specific needs
- **Featured Integration**: Highlighted placement in our documentation and website

### Getting Started

To discuss partnership opportunities, join our [Discord community](https://discord.gg/Pbh7bYPJKt) and message in the #general channel.

We're particularly interested in integrations that create unique interactive experiences for streamers and their audience!

## Need Help?

If you need help or have questions, please check the [ai_licia documentation](https://docs.getailicia.com) or visit our [Discord community](https://discord.gg/Pbh7bYPJKt).

## Development

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Local Development

1. Clone the repo
   ```
   git clone git@github.com:novasquare-ailicia/ai_licia-core.git
   ```
2. Install dependencies
   ```
   cd ai_licia-core
   npm install
   ```
3. Build the package
   ```
   npm run build:client
   ```

### Running Tests

```
npm test
```

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. 
Any contributions you make are **greatly appreciated**.

Please check out the [contributing guidelines](../../CONTRIBUTING.md) for more information.
## License

Distributed under the MIT License. See [LICENSE](../../LICENSE) for more information.
