import dotenv from 'dotenv';

// Load environment variables from .env file (if present)
try {
  dotenv.config();
} catch (error) {
  // Ignore error if dotenv is not available
}

// Export everything from interfaces
export * from './interfaces';

// Export API content limits
export * from './limits';

// Export typed API errors
export * from './errors';

// Export the client
export { AiliciaClient } from './client';

// Export the local WebSocket client
export { LocalWebSocketClient, getLocalWebSocketUrl } from './localWebSocketClient';
