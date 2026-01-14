import dotenv from 'dotenv';

// Load environment variables from .env file (if present)
try {
  dotenv.config();
} catch (error) {
  // Ignore error if dotenv is not available
}

// Export everything from interfaces
export * from './interfaces';

// Export the client
export { AiliciaClient } from './client';

// Export the local WebSocket client
export { LocalWebSocketClient, getLocalWebSocketUrl } from './localWebSocketClient';
