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

/**
 * Trigger ai_licia Direct Generation
 * 
 * This action triggers ai_licia to immediately generate a response based on
 * the provided content. This is used for one-time reactions to specific events.
 * 
 * Examples of when to use this:
 * - Game moments: "Player just defeated the boss"
 * - Stream events: "Channel point redemption for ai_licia to roast someone"
 * - Special moments: "Plane landed successfully"
 * 
 * The content is limited to 300 characters per generation request.
 */

// The custom code action name
const name: string = 'Trigger ai_licia Direct Generation';

// The custom code inputs - matching the API specification
const inputs = {
  content: new StringInput('Content (what should ai_licia react to? max 300 chars)', { required: true })
};

// The code executed when the action is triggered
async function method(inputs: { [key: string]: any }) {
  console.log('Triggering ai_licia direct generation');
  
  const content = inputs.content as string;
  
  // Check for content length limit (API has 300 char limit)
  if (content.length > 300) {
    console.error('Content exceeds the 300-character limit');
    return { 
      success: false, 
      error: 'Content exceeds the 300-character limit'
    };
  }
  
  try {
    // Import the ai_licia client
    const { AiliciaClient } = require('ai_licia-client');
    const client = new AiliciaClient();
    
    // Trigger ai_licia to generate a response
    // Uses the /events/generations endpoint with GAME_EVENT type
    const result = await client.triggerGeneration(content);
    
    console.log('ai_licia direct generation triggered successfully');
    console.log('Response:', result);
    
    return {
      success: true,
      response: result,
      content: result.content
    };
  } catch (error) {
    console.error('Error triggering ai_licia direct generation:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

// Export the action
export default { name, inputs, method }; 