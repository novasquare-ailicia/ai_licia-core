import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AvatarProtocolMessageSchema,
  LocalIntegrationAvatarAuthMessageSchema
} from '../packages/ai_licia-client/dist/avatarProtocol.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(
  repositoryRoot,
  'packages/ai_licia-client/schema/avatar-protocol.v1.schema.json'
);
const authOutputPath = resolve(
  repositoryRoot,
  'packages/ai_licia-client/schema/avatar-integration-auth.v1.schema.json'
);

const content = `${JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...AvatarProtocolMessageSchema
  }, null, 2)}\n`;
const authContent = `${JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...LocalIntegrationAvatarAuthMessageSchema
}, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const [existing, existingAuth] = await Promise.all([
    readFile(outputPath, 'utf8').catch(() => ''),
    readFile(authOutputPath, 'utf8').catch(() => '')
  ]);
  if (existing !== content || existingAuth !== authContent) {
    console.error(`Generated schemas are stale: ${outputPath}, ${authOutputPath}`);
    process.exitCode = 1;
  }
} else {
  await Promise.all([
    mkdir(dirname(outputPath), { recursive: true }),
    mkdir(dirname(authOutputPath), { recursive: true })
  ]);
  await Promise.all([
    writeFile(outputPath, content, 'utf8'),
    writeFile(authOutputPath, authContent, 'utf8')
  ]);
}

console.log(`${process.argv.includes('--check') ? 'Checked' : 'Generated'} ${outputPath}`);
console.log(`${process.argv.includes('--check') ? 'Checked' : 'Generated'} ${authOutputPath}`);
