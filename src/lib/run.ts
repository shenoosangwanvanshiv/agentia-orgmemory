import type { Assessment } from './assess';
import { assess } from './assess';
import { loadConfig } from './config';
import { resolveChange, type ChangeInput } from './resolve';
import { loadMemory, saveMemory } from './store';
import { relearn } from './learn';
import { renderAssessment, type View } from './render';
import type { Config, Memory } from './types';

export interface Prepared {
  cfg: Config;
  mem: Memory;
  root: string;
}

/** Load config + memory; learn on the fly if records exist but patterns have not been learned yet. */
export function prepare(): Prepared {
  const root = process.cwd();
  const cfg = loadConfig(root);
  const mem = loadMemory(cfg, root);
  if (!mem.records.length) {
    throw new Error('Org memory is empty. Run: agentia orgmemory capture --seed demo/seed-history.json (or --git)');
  }
  if (!mem.patterns.length) {
    relearn(mem);
    saveMemory(cfg, root, mem);
  }
  return { cfg, mem, root };
}

export function compact(id: string, title: string, a: Assessment) {
  return {
    id, title,
    risk: { level: a.level, score: Number(a.score.toFixed(3)), confidence: Number(a.confidence.toFixed(3)) },
    baselineFailureRate: Number(a.baseRate.toFixed(3)),
    components: a.components,
    evidence: a.risks.map((r) => ({
      pattern: r.pattern.label, failed: r.pattern.failures, of: r.pattern.n,
      liftVsBaseline: Number(r.lift.toFixed(2)), records: r.pattern.recordIds.slice(-5),
    })),
    similarChanges: a.similar.map((s) => ({
      id: s.record.id, title: s.record.title, outcome: s.record.outcome,
      similarity: Number(s.similarity.toFixed(2)), environment: s.record.environment, fix: s.record.fix,
    })),
    recommendations: a.recommendations,
  };
}

export function runView(view: View, input: ChangeInput, name?: string) {
  const { cfg, mem, root } = prepare();
  const change = resolveChange(cfg, root, input, name);
  const a = assess(mem, change.components, cfg);
  const lines = renderAssessment(change.title, a, view);
  return { cfg, mem, root, change, a, lines };
}
