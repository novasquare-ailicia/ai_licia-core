import { ICCActionInputs, ICustomCode } from 'aitum.js/lib/interfaces';
import { StringInput, IntInput } from 'aitum.js/lib/inputs';
import { createAiliciaClient } from '../config'; // Import the factory function

// Removed: AitumCC and DeviceType imports as they are not used in this specific action
// Removed: Custom StringInput and NumberInput class definitions

/*********** CONFIG ***********/
/**
 * Send ai_licia Context Event
 * 
 * This action sends contextual data to ai_licia's API that will be stored
 * and used to enhance her messages in Twitch chat.
 * 
 * Examples of context you can send:
 * - Game data (position, stats, game state)
 * - Music currently playing
 * - Stream information
 * 
 * The data is limited to 700 characters per event.
 */

// The custom code action name
const name: string = 'Send ai_licia Context Event';

// The custom code inputs - using aitum.js inputs
const inputs: ICCActionInputs = {
  content: new StringInput('Content (max 700 chars)', { required: true }),
  ttl: new IntInput('Time-to-Live in seconds (optional, 0=infinite)', { required: false })
};

// The code executed when the action is triggered - updated signature
async function method(inputs: { [key: string]: string | number | boolean | string[] }) {
  console.log('Sending context event to ai_licia');
  
  const content = inputs.content as string;
  // Use IntInput which provides a number type
  const ttl = inputs.ttl as number | undefined;
  
  // Check for content length limit (API has 700 char limit)
  if (content.length > 700) {
    console.error('Content exceeds the 700-character limit');
    return; // Stop execution
  }
  
  try {
    // Use the factory function to create the client
    const client = createAiliciaClient();
    
    // Send the event to ai_licia API
    // Pass TTL directly (client handles undefined)
    await client.sendEvent(content, ttl);
    
    console.log('Context event sent successfully to ai_licia');
  } catch (error) {
    // Log the error appropriately
    if (error instanceof Error) {
      console.error('Error sending context event to ai_licia:', error.message);
    } else {
      console.error('Unknown error sending context event to ai_licia:', error);
    }
  }
}

/*********** DON'T EDIT BELOW ***********/
export default { name, inputs, method } as ICustomCode; 