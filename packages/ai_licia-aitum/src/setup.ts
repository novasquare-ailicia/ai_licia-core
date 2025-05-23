/*
 * WARNING: This is only meant to be run a single time.
 * If it's ran more than once, you may overwrite settings and have to set things up from scratch.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import {hostname} from 'os';
import {v4 as uuidv4} from 'uuid';

console.log('Setting up ai_licia Aitum Integration...');

// Create settings.env file
const envPath = path.join(__dirname, '..', 'settings.env');

// Check if file exists
if (fs.existsSync(envPath)) {
  console.log('settings.env already exists. Skipping setup.');
  process.exit(0);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for configuration
rl.question('Enter your API key for ai_licia (if available): ', (apiKey) => {
  rl.question('Enter your channel name for ai_licia: ', (channelName) => {
    rl.question('Enter your Aitum API Key: ', (aitumApiKey) => {
      const settings = `# ai_licia settings
AI_LICIA_API_URL=https://api.getailicia.com
AI_LICIA_API_KEY=${apiKey || ''}
AI_LICIA_CHANNEL=${channelName || ''}
AITUM_CC_ID=${uuidv4()}
AITUM_CC_HOST=ai_licia
API_KEY=${aitumApiKey}
`;

      fs.writeFileSync(envPath, settings);
      console.log(`settings.env created successfully at ${envPath}`);

      rl.close();
    });
  });
});