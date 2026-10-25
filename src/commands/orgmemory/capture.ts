import { Command, Flags } from '@oclif/core';
import * as fs from 'node:fs';
import { recordsFromCopado } from '../../lib/agentia';
import { loadConfig } from '../../lib/config';
import { historyFromGit, isGitRepo } from '../../lib/gitutil';
import { relearn } from '../../lib/learn';
import { loadMemory, saveMemory, upsertRecords } from '../../lib/store';
import type { ChangeRecord } from '../../lib/types';

export default class Capture extends Command {
  static summary = 'CAPTURE: collect historical changes, deployments, failures, incidents and fixes into org memory.';
  static description =
    'Sources: a JSON history file (--seed), your git history (--git), and Copado user stories (--copado). ' +
    'After capturing, patterns are learned automatically.';
  static examples = [
    '<%= config.bin %> orgmemory capture --seed demo/seed-history.json',
    '<%= config.bin %> orgmemory capture --git --since 12.months',
    '<%= config.bin %> orgmemory capture --copado',
  ];
  static enableJsonFlag = true;
  static flags = {
    seed: Flags.string({ summary: 'Import records from a JSON file (array of change records)' }),
    git: Flags.boolean({ summary: 'Import changes from git history of the current project' }),
    since: Flags.string({ summary: 'With --git: only commits since this (e.g. 6.months)' }),
    copado: Flags.boolean({ summary: 'Import finished/failed user stories from Copado (best effort)' }),
  };

  async run() {
    const { flags } = await this.parse(Capture);
    if (!flags.seed && !flags.git && !flags.copado) this.error('Choose at least one source: --seed <file>, --git or --copado');
    const root = process.cwd();
    const cfg = loadConfig(root);
    const mem = loadMemory(cfg, root);
    const summary: Record<string, unknown> = {};

    if (flags.seed) {
      const raw = JSON.parse(fs.readFileSync(flags.seed, 'utf8'));
      const recs: ChangeRecord[] = (Array.isArray(raw) ? raw : raw.records) ?? [];
      const bad = recs.find((r) => !r.id || !Array.isArray(r.components) || !r.outcome);
      if (bad) this.error(`Invalid record in seed file (needs id, components, outcome): ${JSON.stringify(bad).slice(0, 120)}`);
      const r = upsertRecords(mem, recs.map((x) => ({ ...x, source: x.source ?? 'seed' })));
      this.log(`Seed: ${r.added} added, ${r.updated} updated.`);
      summary.seed = r;
    }
    if (flags.git) {
      if (!isGitRepo(root)) this.error('Not a git repository.');
      const recs = historyFromGit(root, flags.since);
      const r = upsertRecords(mem, recs);
      this.log(`Git: ${recs.length} changes with Salesforce metadata (${r.added} added, ${r.updated} updated).`);
      summary.git = r;
    }
    if (flags.copado) {
      const { records, notes } = recordsFromCopado(cfg, root);
      for (const n of notes) this.log(`Copado: ${n}`);
      const r = upsertRecords(mem, records);
      this.log(`Copado: ${r.added} added, ${r.updated} updated.`);
      summary.copado = r;
    }
    relearn(mem);
    saveMemory(cfg, root, mem);
    const fails = mem.records.filter((r) => r.outcome !== 'success').length;
    this.log(`Memory now holds ${mem.records.length} changes (${fails} failed or rolled back), ${mem.patterns.length} patterns learned.`);
    return { records: mem.records.length, failed: fails, patterns: mem.patterns.length, ...summary };
  }
}
