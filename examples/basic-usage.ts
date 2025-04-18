import { AiliciaClient, GenerationResponse } from 'ai_licia-client';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Basic usage example of the AILiciaClient
 */
async function main() {
  // Check for required environment variables
  const apiKey = process.env.AILICIA_API_KEY;
  const channelName = process.env.AILICIA_CHANNEL_NAME;

  if (!apiKey) {
    console.error('AILICIA_API_KEY environment variable not set');
    process.exit(1);
  }

  if (!channelName) {
    console.error('AILICIA_CHANNEL_NAME environment variable not set');
    process.exit(1);
  }

  // Create the client using the singleton pattern
  const client = AiliciaClient.getInstance({
    apiKey,
    channelName
  });

  try {
    // Send contextual data to AI Licia
    console.log('Sending event to AI Licia...');
    await client.sendEvent('The player entered a haunted forest filled with mysterious sounds');
    console.log('Event sent successfully!');

    // Wait a bit for the context to be processed
    console.log('Waiting for 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Trigger a reaction from AI Licia
    console.log('Triggering a generation from AI Licia...');
    await client.triggerGeneration(
      'A ghostly figure appeared between the trees'
    );
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Run the example
main().catch(console.error); 