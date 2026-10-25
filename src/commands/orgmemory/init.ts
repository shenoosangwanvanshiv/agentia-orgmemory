import { Command } from '@oclif/core';
import { loadConfig, writeDefaultConfig } from '../../lib/config';
import { emptyMemory, memoryPath, saveMemory } from '../../lib/store';
import * as fs from 'node:fs';

export default class Init extends Command {
  static summary = 'Create the Org Memory config and an empty memory store in this project.';
  static examples = ['<%= config.bin %> orgmemory init'];

  async run() {
    const root = process.cwd();
    const created = writeDefaultConfig(root);
    const cfg = loadConfig(root);
    const p = memoryPath(cfg, root);
    if (!fs.existsSync(p)) saveMemory(cfg, root, emptyMemory());
    this.log(created ? 'Created .orgmemory.json' : '.orgmemory.json already exists (kept).');
    this.log(`Memory store: ${p}`);
    this.log('');
    this.log('Next: agentia orgmemory capture --seed demo/seed-history.json');
  }
}
