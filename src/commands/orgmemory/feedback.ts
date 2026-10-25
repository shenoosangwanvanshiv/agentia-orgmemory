import { Command, Flags } from '@oclif/core';
import { assess } from '../../lib/assess';
import { changeFlags } from '../../lib/flags';
import { relearn } from '../../lib/learn';
import { bold, dim, green, levelColor, pct, red } from '../../lib/render';
import { resolveChange } from '../../lib/resolve';
import { prepare } from '../../lib/run';
import { saveMemory, upsertRecords } from '../../lib/store';
import type { ChangeRecord, Outcome } from '../../lib/types';

export default class Feedback extends Command {
  static summary = 'LEARN AGAIN: feed the real release outcome back into memory so future predictions improve.';
  static description =
    'Use the same id you gave to "predict" (--change). The command compares the prediction with reality, ' +
    'stores the outcome, re-learns all patterns, and shows how the risk for this kind of change moved.';
  static examples = [
    '<%= config.bin %> orgmemory feedback --change US-DEMO-1 --outcome failed --env UAT --category permission --message "FLS missing for Discount_Tier__c" --fix "Added PermissionSet in same story"',
    '<%= config.bin %> orgmemory feedback --change US-0000012 --story US-0000012 --outcome success',
  ];
  static enableJsonFlag = true;
  static flags = {
    ...changeFlags,
    change: Flags.string({ required: true, summary: 'Change id (the same id used with predict)' }),
    outcome: Flags.string({ required: true, options: ['success', 'failed', 'rolled_back'], summary: 'What actually happened' }),
    env: Flags.string({ summary: 'Environment where it failed (INT, UAT, PROD)' }),
    category: Flags.string({ summary: 'Failure category (permission, test-failure, missing-dependency, validation-rule, flow-conflict, integration-break, coverage, data-issue, field-limit)' }),
    message: Flags.string({ summary: 'Failure message or what went wrong' }),
    fix: Flags.string({ summary: 'What fixed it' }),
    incident: Flags.string({ summary: 'Post-release incident description, if any' }),
    tests: Flags.string({ summary: 'Failed test names, comma separated' }),
    title: Flags.string({ summary: 'Short title for this change' }),
  };

  async run() {
    const { flags } = await this.parse(Feedback);
    const { cfg, mem, root } = prepare();
    const outcome = flags.outcome as Outcome;
    const log = [...mem.predictions].reverse().find((p) => p.id === flags.change);

    let components = log?.components;
    if (flags.components || flags.files || flags.story) components = resolveChange(cfg, root, flags, flags.change).components;
    if (!components) this.error(`No prediction named "${flags.change}" found. Run predict first, or pass --components / --story.`);

    const before = assess(mem, components, cfg);
    const rec: ChangeRecord = {
      id: flags.change, title: flags.title ?? log?.title ?? flags.change, date: new Date().toISOString(),
      source: 'feedback', components, outcome,
      ...(flags.env ? { environment: flags.env } : {}),
      ...(flags.category ? { failureCategory: flags.category } : {}),
      ...(flags.message ? { failureMessage: flags.message } : {}),
      ...(flags.fix ? { fix: flags.fix } : {}),
      ...(flags.incident ? { incident: flags.incident } : {}),
      ...(flags.tests ? { failedTests: flags.tests.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
    };
    upsertRecords(mem, [rec]);
    relearn(mem);
    const after = assess(mem, components, cfg);

    let correct: boolean | undefined;
    if (log) {
      log.actual = outcome;
      correct = (log.level !== 'LOW') === (outcome !== 'success');
      log.correct = correct;
    }
    saveMemory(cfg, root, mem);

    this.log(bold(`Org Memory learned from ${flags.change}`));
    this.log(`Actual outcome: ${outcome === 'success' ? green('success') : red(outcome)}${flags.env ? ` in ${flags.env}` : ''}`);
    if (log) {
      this.log(`Prediction was: ${levelColor(log.level)(`${log.level} ${pct(log.score)}`)}  → ${correct ? green('correct ✔') : red('missed ✖ (memory will now weigh this more)')}`);
    }
    this.log('');
    this.log(bold('Same kind of change, before vs after learning'));
    this.log(`  Risk        ${pct(before.score)} (${before.level})  →  ${levelColor(after.level)(`${pct(after.score)} (${after.level})`)}`);
    this.log(`  Confidence  ${pct(before.confidence)}  →  ${pct(after.confidence)}`);
    this.log(`  Memory      ${mem.records.length} changes, ${mem.patterns.length} patterns, baseline failure rate ${pct(mem.baseRate)}`);
    const resolved = mem.predictions.filter((p) => p.actual);
    if (resolved.length) {
      const ok = resolved.filter((p) => p.correct).length;
      this.log(dim(`  Prediction accuracy so far: ${ok}/${resolved.length}`));
    }
    return {
      change: flags.change, outcome, predictionCorrect: correct ?? null,
      before: { score: before.score, level: before.level, confidence: before.confidence },
      after: { score: after.score, level: after.level, confidence: after.confidence },
    };
  }
}
