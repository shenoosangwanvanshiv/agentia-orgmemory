import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Config } from './types';

export const DEFAULT_CONFIG: Config = {
  storeDir: '.orgmemory',
  baseRef: 'main',
  minEvidence: 2,
  mediumThreshold: 0.35,
  highThreshold: 0.6,
  aiAgent: 'release',
  copado: { workList: ['cicd', 'work', 'list', '--page-size', '200', '--json'] },
};

export function configPath(root: string): string {
  return path.join(root, '.orgmemory.json');
}

export function loadConfig(root: string): Config {
  const p = configPath(root);
  if (!fs.existsSync(p)) return DEFAULT_CONFIG;
  const user = JSON.parse(fs.readFileSync(p, 'utf8'));
  return { ...DEFAULT_CONFIG, ...user, copado: { ...DEFAULT_CONFIG.copado, ...(user.copado ?? {}) } };
}

export function writeDefaultConfig(root: string): boolean {
  const p = configPath(root);
  if (fs.existsSync(p)) return false;
  fs.writeFileSync(p, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  return true;
}
