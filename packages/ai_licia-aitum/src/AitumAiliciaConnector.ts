import { AitumCC } from 'aitum.js';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Import the config setter and actions
import { configureAiliciaCredentials } from './config';
import SendAiliciaEventAction from './actions/SendAiliciaEvent';
import TriggerAiliciaGenerationAction from './actions/TriggerAiliciaGeneration';

// Load .env file from the package root (if it exists)
// This allows users to place their settings.env next to the package
dotenv.config({ path: resolve(__dirname, '..', 'settings.env') });

export interface AitumAiliciaConnectorOptions {
  aitumApiKey: string;
  ailiciaApiKey?: string;
  ailiciaChannel?: string;
  ailiciaBaseUrl?: string; // Optional base URL override
  aitumCcId?: string;      // Optional CC ID override
}

export class AitumAiliciaConnector {
  private aitumLib: AitumCC;
  private options: AitumAiliciaConnectorOptions;
  private aitumCcId: string;
  private readonly aitumHost: string = 'ai_licia';

  constructor(options: AitumAiliciaConnectorOptions) {
    this.options = options;
    this.aitumLib = AitumCC.get();

    // Configure AI Licia client credentials (prioritizing constructor options)
    configureAiliciaCredentials(
      this.options.ailiciaApiKey,
      this.options.ailiciaChannel,
      this.options.ailiciaBaseUrl
    );

    // Determine Aitum CC ID (constructor > env > generate)
    this.aitumCcId = options.aitumCcId || process.env.AITUM_CC_ID || uuidv4();
    console.log(`Using Aitum CC ID: ${this.aitumCcId}`);
    console.log(`Using Aitum Host: ${this.aitumHost}`);
  }

  public async start(): Promise<void> {
    try {
      console.log('Starting AitumAiliciaConnector...');
      
      // Set up Aitum environment
      this.aitumLib.setEnv(
        this.aitumCcId, 
        this.aitumHost, 
        this.options.aitumApiKey // Use API key from constructor
      );

      console.log('Registering ai_licia Aitum actions...');
      // Register actions explicitly
      this.aitumLib.registerAction(SendAiliciaEventAction);
      this.aitumLib.registerAction(TriggerAiliciaGenerationAction);
      console.log('Actions registered.');

      // Connect after a short delay (as in original index.ts)
      console.log('Connecting to Aitum...');
      setTimeout(async () => {
        try {
          await this.aitumLib.connect();
          console.log('Successfully connected to Aitum.');
        } catch (connectError) {
          console.error('Failed to connect to Aitum:', connectError);
        }
      }, 1000);

    } catch (error) {
      console.error('Error starting AitumAiliciaConnector:', error);
      throw error; // Re-throw for external handling if needed
    }
  }
  
  public stop(): void {
      console.log('Stopping AitumAiliciaConnector connection...');
      // Attempt graceful disconnect if connect() was called
      // Note: aitum.js might not have an explicit disconnect method readily available
      // in AitumCC singleton, or it might handle this internally.
      // For now, we just log.
      // If a disconnect method exists on aitumLib, call it here.
      // e.g., this.aitumLib.disconnect(); 
  }
} 