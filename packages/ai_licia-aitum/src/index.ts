/*********** INFO ***********/
/*
 * Custom Code System! Welcome.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Import all actions
import SendAiliciaContextEvent from './actions/SendAiliciaEvent';
import TriggerAiliciaDirectGeneration from './actions/TriggerAiliciaGeneration';

// Load environment variables
if (fs.existsSync(path.join(__dirname, '..', 'settings.env'))) {
  dotenv.config({ path: path.join(__dirname, '..', 'settings.env') });
} else {
  dotenv.config();
}

console.log('Initializing ai_licia Aitum Integration...');

// Export all the actions
export const AiliciaActions = {
  
  /**
   * Sends contextual information to ai_licia that will be stored in her memory
   */
  SendContextEvent: SendAiliciaContextEvent,
  
  /**
   * Triggers ai_licia to generate a direct response
   */
  TriggerDirectGeneration: TriggerAiliciaDirectGeneration
};

// This package is designed to be used with the Aitum Custom Code system
// Follow these steps to set it up:
// 1. Install this package: npm install ai_licia-aitum
// 2. Import the actions: import { AiliciaActions } from 'ai_licia-aitum'
// 3. Register the actions with Aitum Custom Code

console.log('ai_licia Aitum Integration initialized with the following actions:');
Object.keys(AiliciaActions).forEach(action => {
  console.log(`- ${(AiliciaActions as any)[action].name}`);
});

// Export everything
export default AiliciaActions;
