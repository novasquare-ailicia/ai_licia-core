# ai_licia Client

<p align="center">
    <a href="https://www.npmjs.com/package/aitum.js">
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
import { AiliciaClient } from 'ai_licia-client';

// Create a new client
const client = new AiliciaClient(
  'your-api-key',    // Optional, will use environment variable if not provided
  'your-channel',    // Optional, will use environment variable if not provided
  'https://api.getailicia.com/v1'  // Optional, will use environment variable or the default if not provided
);

// Send contextual information to ai_licia (max 700 characters)
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

Sends contextual information to ai_licia that will be stored in her memory and used for future interactions. This doesn't trigger an immediate response but enriches ai_licia's understanding of what's happening in your stream.

**Use cases:**
- Stream game state (health, position, inventory)
- Current music playing
- Chess board state in ASCII
- Player statistics, progress, or achievements
- Stream milestones
- Your setup state (lights colour, fan active or off, etc)

**Parameters:**
- `content`: The information to send (max 700 characters)
- `ttl`: (Optional) Time-to-live in seconds - how long this information stays relevant

```typescript
// Examples
await client.sendEvent('Current song: "Never Gonna Give You Up" by Rick Astley');
await client.sendEvent(`Chess board: 
♜♞♝♛♚♝♞♜
♟♟♟♟♟♟♟♟
□■□■□■□■
■□■□■□■□
□■□■□■□■
■□■□■□■□
♙♙♙♙♙♙♙♙
♖♘♗♕♔♗♘♖
White turn
`);
await client.sendEvent('Player stats: Health: 75/100, Mana: 30/100, Position: Forest of Doom');
```

##### `triggerGeneration(content: string): Promise<GenerationResponse>`

Triggers ai_licia to generate an immediate response to a specific event or moment. This creates a one-off reaction from ai_licia that will appear in your stream.

**Use cases:**
- Player just defeated a boss
- Viewer redeemed channel points for ai_licia to roast them
- Plane crash in a simulator
- Reaching a milestone in-game
- Reaction to a funny/epic moment

**Parameters:**
- `content`: What ai_licia should react to (max 300 characters)

```typescript
// Examples
await client.triggerGeneration('Player just pulled a legendary sword from the stone!');
await client.triggerGeneration('Viewer "GameMaster42" redeemed points for an ai_licia roast');
await client.triggerGeneration('Plane crashed into the mountain. Total damage: $2.5M');
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
- Content length exceeding limits (700 chars for events, 300 chars for generations)
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

## Related

- [ai_licia-aitum](../ai_licia-aitum) - Aitum Custom Code integration for ai_licia 
