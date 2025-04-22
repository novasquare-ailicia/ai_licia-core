import { ICCActionInputs, ICustomCode } from 'aitum.js/lib/interfaces';
import { StringInput } from 'aitum.js/lib/inputs';
import { createAiliciaClient } from './config'; // Import the factory function

// Removed: AitumCC and DeviceType imports as they are not used in this specific action
// Removed: Custom StringInput class definition

/*********** CONFIG ***********/
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

// The custom code inputs - using aitum.js StringInput
const inputs: ICCActionInputs = {
  content: new StringInput('Content (what should ai_licia react to? max 300 chars)', { required: true })
};

// The code executed when the action is triggered - updated signature
async function method(inputs: { [key: string]: string | number | boolean | string[] }) {
  console.log('Triggering ai_licia direct generation');
  
  const content = inputs.content as string;
  
  // Check for content length limit (API has 300 char limit)
  if (content.length > 300) {
    console.error('Content exceeds the 300-character limit');
    // Aitum actions typically don't return values like this, logging error is sufficient
    // return { 
    //   success: false, 
    //   error: 'Content exceeds the 300-character limit'
    // };
    return; // Stop execution
  }
  
  try {
    // Use the factory function to create the client
    const client = createAiliciaClient();
    
    // Trigger ai_licia to generate a response
    const result = await client.triggerGeneration(content);
    
    console.log('ai_licia direct generation triggered successfully');
    console.log('Response content (first 100 chars):', result.content?.substring(0, 100)); // Log response details
    
    // No explicit return value needed for success in Aitum actions
    // return {
    //   success: true,
    //   response: result,
    //   content: result.content
    // };
  } catch (error) {
    // Log the error appropriately
    if (error instanceof Error) {
      console.error('Error triggering ai_licia direct generation:', error.message);
    } else {
      console.error('Unknown error triggering ai_licia direct generation:', error);
    }
    // No explicit return value needed for failure
    // return {
    //   success: false,
    //   error: String(error)
    // };
  }
}

/*********** DON'T EDIT BELOW ***********/
export default { name, inputs, method } as ICustomCode; 