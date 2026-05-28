import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';

export async function appendServerLog(event: string, details: Record<string, unknown>) {
  const line = JSON.stringify({ at: new Date().toISOString(), event, details }) + '\n';
  await fs.appendFile(path.join(config.rootDir, 'server.log'), line, 'utf8');
}
