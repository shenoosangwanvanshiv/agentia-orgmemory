import { Command } from '@oclif/core';
import * as fs from 'node:fs';
import { runAgentia } from '../../lib/agentia';
import { configPath, loadConfig } from '../../lib/config';
import { isGitRepo } from '../../lib/gitutil';
import { green, red } from '../../lib/render';
import { loadMemory, memoryPath } from '../../lib/store';

export default class Doctor extends Command {
  static summary = 'Check that Org Memory is set up correctly in this project.';
  static examples = ['<%= config.bin %> orgmemory doctor'];

  async run() {
    const root = process.cwd();
    const cfg = loadConfig(root);
    const checks: [boolean, string, string?][] = [];
    const major = Number(process.versions.node.split('.')[0]);
    checks.push([major >= 20, `Node.js ${process.versions.node}`, 'Install Node 22 LTS']);
    checks.push([isGitRepo(root), 'Inside a git repository', 'Run from your Copado pipeline project folder']);
    checks.push([fs.existsSync(configPath(root)), 'Config .orgmemory.json', 'Run: agentia orgmemory init']);
    const mem = loadMemory(cfg, root);
    checks.push([fs.existsSync(memoryPath(cfg, root)), 'Memory store exists', 'Run: agentia orgmemory init']);
    checks.push([mem.records.length > 0, `Records in memory: ${mem.records.length}`, 'Run: agentia orgmemory capture --seed demo/seed-history.json']);
    checks.push([mem.patterns.length > 0, `Patterns learned: ${mem.patterns.length}`, 'Run: agentia orgmemory learn']);
    const ag = runAgentia(['--version'], 20_000);
    checks.push([ag.ok, ag.ok ? `Agentia CLI ${ag.stdout.trim().split('\n')[0]}` : 'Agentia CLI reachable', 'Needed only for --copado and --ai. Install: npm install -g @copado/agentia-cli@beta']);
    let bad = 0;
    for (const [ok, label, hint] of checks) {
      this.log(`${ok ? green('✔') : red('✖')} ${label}${!ok && hint ? `   → ${hint}` : ''}`);
      if (!ok) bad++;
    }
    this.log(bad ? `\n${bad} check(s) need attention.` : '\nAll good.');
  }
}
