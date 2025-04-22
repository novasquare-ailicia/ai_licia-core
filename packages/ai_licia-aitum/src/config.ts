import { AiliciaClient } from 'ai_licia-client';

// Store prioritized config. Values set by AitumAiliciaConnector constructor.
let prioritizedApiKey: string | undefined = undefined;
let prioritizedChannel: string | undefined = undefined;
// Base URL is less likely to be passed via constructor, primarily env var
let prioritizedBaseUrl: string | undefined = undefined; 

/**
 * Sets the prioritized AI Licia credentials and optionally the base URL.
 * Called by the AitumAiliciaConnector constructor.
 */
export function configureAiliciaCredentials(apiKey?: string, channel?: string, baseUrl?: string): void {
  prioritizedApiKey = apiKey;
  prioritizedChannel = channel;
  prioritizedBaseUrl = baseUrl; 
}

/**
 * Creates an AiliciaClient instance, passing prioritized credentials
 * (set via configureAiliciaCredentials) to the client constructor.
 * The client constructor handles fallback to environment variables.
 */
export function createAiliciaClient(): AiliciaClient {
  // Log which config is being prioritized (optional, good for debugging)
  const logApiKey = prioritizedApiKey ? 'Set (Constructor)' : 'Not Set (Using Env/Default)';
  const logChannel = prioritizedChannel ? 'Set (Constructor)' : 'Not Set (Using Env/Default)';
  const logBaseUrl = prioritizedBaseUrl ? 'Set (Constructor)' : 'Not Set (Using Env/Default)';
  console.log(`Creating AiliciaClient (Prioritized Config -> API Key: ${logApiKey}, Channel: ${logChannel}, Base URL: ${logBaseUrl})`);

  // Pass prioritized values; client constructor handles undefined and env fallbacks
  return new AiliciaClient(prioritizedApiKey, prioritizedChannel, prioritizedBaseUrl);
} 