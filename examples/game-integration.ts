import { AiliciaClient } from 'ai_licia-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * This example shows how to integrate ai_licia with a game.
 * 
 * It simulates a game sending player position and event data to ai_licia,
 * then triggers a reaction when a specific event occurs.
 */

// Initialize the ai_licia client
const client = AiliciaClient.getInstance({
  apiKey: process.env.AILICIA_API_KEY || '',
  channelName: process.env.AILICIA_CHANNEL_NAME || ''
});

/**
 * Example function to update player position
 */
async function updatePlayerPosition(x: number, y: number, z: number) {
  const content = `Player position: x=${x}, y=${y}, z=${z}`;
  
  try {
    // Send the position data to ai_licia with a TTL of 30 seconds
    await client.sendEvent(content, 30);
    console.log('Position updated in ai_licia context');
  } catch (error) {
    console.error('Failed to update position:', error);
  }
}

/**
 * Example function to send a game event
 */
async function sendGameEvent(eventName: string, eventDetails: string) {
  const content = `${eventName}: ${eventDetails}`;
  
  try {
    // Send the event data to ai_licia
    await client.sendEvent(content);
    console.log('Game event sent to ai_licia context');
  } catch (error) {
    console.error('Failed to send game event:', error);
  }
}

/**
 * Example function to trigger ai_licia to react to an event
 */
async function triggerAiliciaReaction(event: string) {
  try {
    // Trigger a reaction from ai_licia
    const response = await client.triggerGeneration(event);
    console.log('ai_licia reaction:', response);
  } catch (error) {
    console.error('Failed to trigger ai_licia reaction:', error);
  }
}

// Example usage
async function runExample() {
  // Simulate player moving around
  await updatePlayerPosition(100.5, 25.0, 342.8);
  
  // Simulate player entering a new area
  await sendGameEvent('Area Changed', 'Player entered the Dark Forest');
  
  // Simulate player finding an item
  await sendGameEvent('Item Found', 'Player found a Legendary Sword');
  
  // Trigger ai_licia to react to the player finding the sword
  await triggerAiliciaReaction('The player found a legendary sword that glows with mystical energy!');
}

// Run the example
runExample().catch(console.error); 