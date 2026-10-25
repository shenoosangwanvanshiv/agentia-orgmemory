import { Command, Flags } from '@oclif/core';
import * as fs from 'node:fs';
import { loadConfig } from '../../lib/config';
import { pct } from '../../lib/render';
import { loadMemory } from '../../lib/store';

export default class Report extends Command {
  static summary = 'REPORT: summarise what the org has learned (markdown, can be saved to a file).';
  static examples = ['<%= config.bin %> orgmemory report --out orgmemory-report.md'];
  static flags = { out: Flags.string({ summary: 'Write the report to this markdown file' }) };

  async run() {
    const { flags } = await this.parse(Report);
    const root = process.cwd();
    const cfg = loadConfig(root);
    const mem = loadMemory(cfg, root);
    if (!mem.records.length) this.error('Memory is empty. Run capture first.');
    const L: string[] = [];
    const bad = mem.records.filter((r) => r.outcome !== 'success');
    L.push('# Org Memory report', '');
    L.push(`- Changes remembered: **${mem.records.length}** (${bad.length} failed or rolled back, baseline failure rate **${pct(mem.baseRate)}**)`);
    L.push(`- Patterns learned: **${mem.patterns.length}**${mem.learnedAt ? ` (last learned ${mem.learnedAt.slice(0, 10)})` : ''}`);
    L.push('', '## Why changes fail here', '');
    const cats: Record<string, number> = {};
    for (const r of bad) if (r.failureCategory) cats[r.failureCategory] = (cats[r.failureCategory] ?? 0) + 1;
    for (const [k, v] of Object.entries(cats).sort((a, b) => b[1] - a[1])) L.push(`- ${k}: ${v}`);
    L.push('', '## Riskiest patterns', '');
    for (const p of mem.patterns.filter((x) => x.n >= cfg.minEvidence && x.failures >= 2).slice(0, 10)) {
      L.push(`- **${pct(p.rate)}** ${p.label} (failed ${p.failures} of ${p.n})`);
    }
    L.push('', '## Fixes that keep working', '');
    const fixes: Record<string, number> = {};
    for (const r of mem.records) if (r.fix) fixes[r.fix] = (fixes[r.fix] ?? 0) + 1;
    for (const [k, v] of Object.entries(fixes).sort((a, b) => b[1] - a[1]).slice(0, 8)) L.push(`- ${k} (${v}x)`);
    const resolved = mem.predictions.filter((p) => p.actual);
    L.push('', '## Prediction track record', '');
    if (!resolved.length) L.push('- No predictions have been compared with real outcomes yet.');
    for (const p of resolved) L.push(`- ${p.id}: predicted ${p.level} (${pct(p.score)}), actual ${p.actual} → ${p.correct ? 'correct' : 'missed'}`);
    if (resolved.length) L.push(`- Accuracy: ${resolved.filter((p) => p.correct).length}/${resolved.length}`);
    L.push('');
    const text = L.join('\n');
    if (flags.out) {
      fs.writeFileSync(flags.out, text);
      this.log(`Report written to ${flags.out}`);
    } else {
      this.log(text);
    }
  }
}
