# ai_licia - Aitum Integration

This package provides custom actions for Aitum that integrate with ai_licia, allowing you to trigger and interact with your ai_licia instance directly from Aitum.

## Installation

```bash
npm install ai_licia-aitum
```

## Configuration

You'll need to create a `.env` file with your ai_licia configuration:

```
AI_LICIA_API_URL=http://your-ailicia-api-url.com
AI_LICIA_API_KEY=your-api-key
AI_LICIA_CHANNEL=your-channel-name
```

Alternatively, you can run the setup script:

```bash
npx ai_licia-aitum-setup
```

## Available Actions

### Send ai_licia Context Event

Sends contextual information to ai_licia that will be stored in her memory. This helps provide context for future interactions.

**Inputs:**
- **Event Type**: The type of event to send
- **Event Data (JSON)**: JSON data to send with the event

### Trigger ai_licia Direct Generation

Triggers ai_licia to generate a direct response based on the provided prompt.

**Inputs:**
- **Prompt Override**: The prompt to send to ai_licia
- **Use Chat Memory**: Whether to use the chat memory for context
- **Additional Context**: Additional context to provide
- **Voice Only**: Whether to generate only voice without text response

## Usage with Aitum Custom Code

This package is designed to work with Aitum's Custom Code feature. To use it:

1. Install the package in your Aitum Custom Code project
2. Import and register the actions

```typescript
// Import the actions
import { AiliciaActions } from 'ai_licia-aitum';

// Register with Aitum Custom Code
const aitumCC = AitumCC.get();

// Register individual actions
aitumCC.registerAction(AiliciaActions.SendContextEvent);
aitumCC.registerAction(AiliciaActions.TriggerDirectGeneration);
```

## Example

Here's a complete example of how to set up ai_licia with Aitum Custom Code:

```typescript
import { AitumCC } from 'aitum.js';
import { AiliciaActions } from 'ai_licia-aitum';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Aitum Custom Code
const aitumCC = AitumCC.get();

// Set up the environment
aitumCC.setEnv(
  process.env.AITUM_CC_ID as string,
  process.env.AITUM_CC_HOST as string,
  process.env.API_KEY as string
);

// Register AI Licia actions
aitumCC.registerAction(AiliciaActions.SendContextEvent);
aitumCC.registerAction(AiliciaActions.TriggerDirectGeneration);

// Connect to Aitum
aitumCC.connect();
```

## Need Help?

If you need help or have questions, please check the [ai_licia documentation](https://ai-licia.com/docs) or visit our [Discord community](https://discord.gg/ailicia).