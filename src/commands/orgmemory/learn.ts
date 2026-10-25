import { Command, Flags } from '@oclif/core';
import { loadConfig } from '../../lib/config';
import { relearn } from '../../lib/learn';
import { bold, dim, pct, red, yellow } from '../../lib/render';
import { loadMemory, saveMemory } from '../../lib/store';

export default class Learn extends Command {
  static summary = 'LEARN: find recurring patterns between kinds of changes and their outcomes.';
  static examples = ['<%= config.bin %> orgmemory learn --top 12'];
  static enableJsonFlag = true;
  static flags = { top: Flags.integer({ summary: 'How many patterns to show', default: 10 }) };

  async run() {
    const { flags } = await this.parse(Learn);
    const root = process.cwd();
    const cfg = loadConfig(root);
    const mem = loadMemory(cfg, root);
    if (!mem.records.length) this.error('Memory is empty. Run: agentia orgmemory capture --seed demo/seed-history.json');
    relearn(mem);
    saveMemory(cfg, root, mem);
    this.log(bold(`Learned ${mem.patterns.length} patterns from ${mem.records.length} past changes.`));
    this.log(dim(`Baseline failure rate in this org: ${pct(mem.baseRate)}`));
    this.log('');
    const risky = mem.patterns.filter((p) => p.n >= cfg.minEvidence && p.failures >= 2).slice(0, flags.top);
    this.log(bold('Strongest risk patterns'));
    for (const p of risky) {
      const col = p.rate >= cfg.highThreshold ? red : yellow;
      const cat = Object.entries(p.categories).sort((a, b) => b[1] - a[1])[0]?.[0];
      this.log(`  ${col(pct(p.rate).padStart(4))}  ${p.label}  ${dim(`failed ${p.failures}/${p.n}${cat ? `, mostly "${cat}"` : ''}`)}`);
    }
    return {
      patterns: mem.patterns.length, records: mem.records.length, baseRate: mem.baseRate,
      top: risky.map((p) => ({ label: p.label, failed: p.failures, of: p.n, rate: p.rate })),
    };
  }
}
