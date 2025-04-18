# ai_licia Client

A TypeScript/JavaScript client library for interacting with with [ai_licia AI Co-Host](https://www.getailicia.com) API.

## Installation

```bash
npm install ai_licia-client
```

## Configuration

You can configure the client using environment variables:

```
AI_LICIA_API_URL=http://your-ailicia-api-url.com
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
  'https://api.url'  // Optional, will use environment variable if not provided
);

// Send an event to ai_licia
await client.sendEvent('GAME_EVENT', { 
  message: 'Player entered the room'
});

// Trigger a generation
const response = await client.triggerGeneration('How are you today?');
console.log(response.content); // The response from ai_licia
```

### Advanced Usage

You can also use the client to create more complex interactions:

```typescript
// Trigger a generation with customization
const options = {
  promptOverride: 'What is the meaning of life?',
  useMemory: true,
  additionalContext: 'The user is a philosopher',
  voiceOnly: false
};

const response = await client.generateResponse(options);
```

## API Reference

### `AiliciaClient`

The main class for interacting with the ai_licia API.

#### Constructor

```typescript
new AiliciaClient(apiKey?: string, channelName?: string, baseUrl?: string)
```

#### Methods

##### `sendEvent(content: string, ttl?: number): Promise<void>`

Sends an event to ai_licia, which will be added to her context.

- `content`: The content of the event
- `ttl`: (Optional) Time-to-live in seconds

##### `triggerGeneration(content: string): Promise<GenerationResponse>`

Triggers ai_licia to generate a response based on the provided content.

- `content`: The content to trigger a generation for

##### `generateResponse(options: GenerationOptions): Promise<GenerationResponse>`

Generates a response with more control over the generation process.

- `options`: Options for the generation including:
  - `promptOverride`: Override the default prompt
  - `useMemory`: Whether to use chat memory
  - `additionalContext`: Additional context to provide
  - `voiceOnly`: Whether to generate only voice without text

## Types

### `GenerationResponse`

```typescript
interface GenerationResponse {
  id: string;
  content: string;
  createdAt: string;
  status: 'completed' | 'processing' | 'failed';
  audioPath?: string;
}
```

### `GenerationOptions`

```typescript
interface GenerationOptions {
  promptOverride?: string;
  useMemory?: boolean;
  additionalContext?: string;
  voiceOnly?: boolean;
}
```

## Error Handling

The client throws descriptive errors when API calls fail. You can catch these errors to handle them gracefully:

```typescript
try {
  await client.sendEvent('GAME_EVENT', { message: 'Player entered the room' });
} catch (error) {
  console.error('Failed to send event:', error.message);
}
```

## Need Help?

If you need help or have questions, please check the [ai_licia documentation](https://ai-licia.com/docs) or visit our [Discord community](https://discord.gg/ailicia).

## Environment Setup

You can use environment variables with dotenv by creating a `.env` file:

```
AI_LICIA_API_KEY=your_api_key_here
AI_LICIA_CHANNEL_NAME=your_twitch_channel_name
```

Then in your code:

```typescript
import { AiliciaClient } from 'ai_licia-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create client from environment variables
const client = AiliciaClient.getInstance({
  apiKey: process.env.AI_LICIA_API_KEY || '',
  channelName: process.env.AI_LICIA_CHANNEL_NAME || ''
});
```

## Development

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Local Development

1. Clone the repo
   ```
   git clone https://github.com/YOUR_USERNAME/ai_licia-monorepo.git
   ```
2. Install dependencies
   ```
   cd ai_licia-monorepo
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

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

Please check out the [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

Distributed under the MIT License. See [LICENSE](../../LICENSE) for more information.

## Related

- [ai_licia-aitum](../ai_licia-aitum) - Aitum Custom Code integration for AI Licia 