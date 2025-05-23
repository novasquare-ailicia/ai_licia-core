import { AitumCC } from 'aitum.js';
import { AiliciaActions } from 'ai_licia-aitum';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Example of using ailicia-aitum with Aitum Custom Code
 */
async function main() {
  // Check for required environment variables
  if (!process.env.AILICIA_API_KEY) {
    console.error('AILICIA_API_KEY environment variable not set');
    process.exit(1);
  }

  if (!process.env.AILICIA_CHANNEL_NAME) {
    console.error('AILICIA_CHANNEL_NAME environment variable not set');
    process.exit(1);
  }

  // Initialize the Aitum CC library
  const lib = new AitumCC('ai_licia Integration Example');
  
  // Register the ai_licia actions with Aitum CC
  console.log('Registering ai_licia actions...');
  Object.values(AiliciaActions).forEach(action => {
    lib.registerAction(action);
  });
  
  console.log('Successfully registered the following actions:');
  console.log('1. Send ai_licia Event');
  console.log('2. Trigger ai_licia Generation');
  
  console.log('\nThese actions can now be used in your Aitum Custom Code flows!');
  console.log('Make sure to set AILICIA_API_KEY and AILICIA_CHANNEL_NAME in your env variables.');
}

// Run the example
main().catch(console.error); 