# ai_licia Integrations

This monorepo contains libraries for integrating with the [ai_licia Twitch AI Companion](https://www.getailicia.com) API.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Packages

This repository contains the following packages:

1. **ai_licia-client** - Core client library for interacting with the ai_licia API
2. **ai_licia-aitum** - Integration for Aitum Custom Code that imports ai_licia-client

## Installation

### Core Client Only

```bash
npm install ai_licia-client
```

### Aitum Integration

```bash
npm install ai_licia-client ai_licia-aitum
```

## Environment Setup

Create a `.env` file with your ai_licia API credentials:

```
AI_LICIA_API_KEY=your_api_key_here
AI_LICIA_CHANNEL_NAME=your_twitch_channel_name
```

## Usage

### Core Client

```typescript
import { AiliciaClient } from 'ai_licia-client';

// Create a client
const client = AiliciaClient.getInstance({
  apiKey: 'your_api_key_here', 
  channelName: 'your_twitch_channel_name'
});

// Send an event to ai_licia
await client.sendEvent('The player just entered a new dungeon area');

// Trigger a generation
const response = await client.triggerGeneration('The player just defeated the boss');
console.log(response.content);
```

### Aitum Custom Code Integration

```typescript
import { AitumCC } from 'aitum.js';
import { AiliciaActions } from 'ai_licia-aitum';

// Initialize the Custom Code lib
const lib = new AitumCC('My Aitum CC Project');

// Register all ailicia actions
Object.values(AiliciaActions).forEach(action => {
  lib.registerAction(action);
});

// This registers two actions in Aitum:
// 1. Send ai_licia Context Event
// 2. Trigger ai_licia Direct Generation
```

## API Reference

### AiliciaClient (ai_licia-client)

#### `getInstance(config: AiliciaConfig): AiliciaClient`

Creates or returns the singleton instance of the client.

- `config.apiKey`: Your ai_licia API key
- `config.channelName`: Your Twitch channel name
- `config.baseUrl` (optional): Override the base URL for API requests

#### `sendEvent(content: string, ttl?: number): Promise<void>`

Sends contextual data to ai_licia.

- `content`: The data for ai_licia to process (max 700 characters)
- `ttl`: Optional Time-to-Live in seconds

#### `triggerGeneration(content: string): Promise<GenerationResponse>`

Triggers a reaction from ai_licia.

- `content`: The data for ai_licia to react to (max 300 characters)
- Returns a response with the ai_licia generation content

### AiliciaActions (ai_licia-aitum)

Contains Aitum Custom Code actions for ai_licia:

- `SendContextEvent`: Action to send context events to ai_licia
- `TriggerDirectGeneration`: Action to trigger reactions from ai_licia

## Example Use Cases

- Game integration: Send game state events to ai_licia so she can comment on gameplay
- Stream integration: Trigger ai_licia to react to stream events (follows, subs, etc.)
- Chat moderation: Send filtered chat messages for ai_licia to respond to
- Interactive storytelling: Use ai_licia as a dynamic NPC that responds to player actions

## Development

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/ai_licia-monorepo.git
cd ai_licia-monorepo
npm install
```

### Building

Build all packages:

```bash
npm run build
```

Or build specific packages:

```bash
npm run build:client
npm run build:aitum
```

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please make sure to update tests as appropriate and follow the existing code style.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) to keep our community approachable and respectable.

## Issue Reporting

If you find a bug or have a feature request, please open an issue using the GitHub issue tracker.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the ai_licia team for providing the API
- All the streamers and content creators using ai_licia with Aitum
- Contributors to this project 