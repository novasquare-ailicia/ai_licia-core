// Basic interface for action inputs
interface ActionInput {
  type: string;
  label: string;
  required: boolean;
}

// String input type
class StringInput implements ActionInput {
  type = 'string';
  required: boolean;
  
  constructor(public label: string, public options: { required: boolean }) {
    this.required = options.required;
  }
}

// Number input type for TTL
class NumberInput implements ActionInput {
  type = 'number';
  required: boolean;
  
  constructor(public label: string, public options: { required: boolean }) {
    this.required = options.required;
  }
}

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

// The custom code inputs - matching the API specification
const inputs = {
  content: new StringInput('Content (max 700 chars)', { required: true }),
  ttl: new NumberInput('Time-to-Live in seconds (optional)', { required: false })
};

// The code executed when the action is triggered
async function method(inputs: { [key: string]: any }) {
  console.log('Sending context event to ai_licia');
  
  const content = inputs.content as string;
  const ttl = inputs.ttl as number | undefined;
  
  // Check for content length limit (API has 700 char limit)
  if (content.length > 700) {
    console.error('Content exceeds the 700-character limit');
    return { 
      success: false, 
      error: 'Content exceeds the 700-character limit'
    };
  }
  
  try {
    // Import the ai_licia client
    const { AiliciaClient } = require('ai_licia-client');
    const client = new AiliciaClient();
    
    // Send the event to ai_licia API
    // Uses the /events endpoint with GAME_EVENT type
    await client.sendEvent(content, ttl);
    
    console.log('Context event sent successfully to ai_licia');
    return { success: true };
  } catch (error) {
    console.error('Error sending context event to ai_licia:', error);
    return { 
      success: false, 
      error: String(error)
    };
  }
}

// Export the action
export default { name, inputs, method }; 