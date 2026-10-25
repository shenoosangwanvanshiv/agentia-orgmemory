import type { ChangeRecord, Component, Config, Level, Memory, Pattern } from './types';
import { componentKey, objectOf } from './components';
import { featureKeys } from './learn';

export interface Risk {
  pattern: Pattern;
  confidence: number;
  lift: number;
  strength: number;
}
export interface Similar {
  record: ChangeRecord;
  similarity: number;
  shared: string[];
}
export interface Recommendation {
  action: string;
  why: string;
}
export interface Assessment {
  components: Component[];
  score: number;
  level: Level;
  confidence: number;
  baseRate: number;
  totalRecords: number;
  risks: Risk[];
  similar: Similar[];
  recommendations: Recommendation[];
}

const CATEGORY_ACTIONS: Record<string, string> = {
  'missing-dependency': 'Include every referenced component in the same story, or deploy the dependency first.',
  'test-failure': 'Run the related Apex tests locally (or a check-only deploy) before promoting.',
  permission: 'Include a PermissionSet or Profile with access to the new field in the same story.',
  'validation-rule': 'Check validation rules against integration users and bulk loads before promoting.',
  'flow-conflict': 'Review active Flow versions and automation order on the same object before promoting.',
  'integration-break': 'Notify integration owners and test the integration user path in UAT.',
  'field-limit': 'Check the object field limit and retire unused fields first.',
  coverage: 'Add or update an Apex test class in the same story (production needs 75% coverage).',
  'data-issue': 'Validate against production-like data volumes and null values in UAT.',
};

const BARE_ACTIONS: Record<string, string> = {
  'bare:apex-without-test': 'Add or update an Apex test class in the same story (production needs 75% coverage).',
  'bare:field-without-permission': 'Include a PermissionSet or Profile with access to the new field in the same story.',
};

const KIND_RANK: Record<string, number> = { bare: 0, combo: 1, object: 2, component: 3, type: 4 };

function topKey(map: Record<string, number>): [string, number] | undefined {
  const e = Object.entries(map).sort((a, b) => b[1] - a[1]);
  return e[0];
}

function weights(components: Component[]): Map<string, number> {
  const w = new Map<string, number>();
  for (const c of components) {
    w.set(`c:${componentKey(c)}`, 3);
    const o = objectOf(c);
    if (o) w.set(`o:${o}`, 2);
    w.set(`t:${c.type}`, 1);
  }
  return w;
}

function similarity(a: Map<string, number>, b: Map<string, number>): { sim: number; shared: string[] } {
  let inter = 0;
  let union = 0;
  const shared: string[] = [];
  for (const [k, v] of a) {
    if (b.has(k)) {
      inter += v;
      if (k.startsWith('c:') || k.startsWith('o:')) shared.push(k.slice(2));
    }
    union += v;
  }
  for (const [k, v] of b) if (!a.has(k)) union += v;
  return { sim: union ? inter / union : 0, shared };
}

export function levelFor(score: number, cfg: Config): Level {
  return score >= cfg.highThreshold ? 'HIGH' : score >= cfg.mediumThreshold ? 'MEDIUM' : 'LOW';
}

export function assess(mem: Memory, components: Component[], cfg: Config): Assessment {
  const byKey = new Map(mem.patterns.map((p) => [p.key, p]));
  const baseline = Math.max(mem.baseRate, 0.05);

  // 1. Which learned patterns does this change match, and how strong is the evidence?
  const risks: Risk[] = [];
  for (const f of featureKeys(components)) {
    const p = byKey.get(f.key);
    if (!p || p.n < cfg.minEvidence) continue;
    if (p.failures < 2 || p.rate < Math.max(0.4, mem.baseRate * 1.25)) continue;
    const confidence = p.n / (p.n + 4);
    risks.push({ pattern: p, confidence, lift: p.rate / baseline, strength: p.rate * confidence });
  }
  risks.sort((a, b) => b.strength - a.strength);
  const strongest = risks.slice(0, 6);
  // For display and recommendations, show the most specific patterns first.
  const top = [...strongest].sort((a, b) => KIND_RANK[a.pattern.kind] - KIND_RANK[b.pattern.kind] || b.strength - a.strength);

  // 2. Similar past changes
  const mine = weights(components);
  const similar: Similar[] = mem.records
    .map((r) => {
      const { sim, shared } = similarity(mine, weights(r.components));
      return { record: r, similarity: sim, shared };
    })
    .filter((s) => s.similarity >= 0.15)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  // 3. Score and confidence
  const head = strongest.slice(0, 3);
  let score: number;
  let confidence: number;
  if (head.length) {
    // Blend the strongest single signal with the combined signal, because overlapping patterns are correlated.
    const combined = 1 - head.reduce((acc, r) => acc * (1 - r.strength), 1);
    score = Math.min(0.97, 0.5 * head[0].strength + 0.5 * combined);
    const avgConf = head.reduce((s, r) => s + r.confidence, 0) / head.length;
    const topSim = similar[0]?.similarity ?? 0;
    confidence = Math.min(0.95, avgConf * (0.6 + 0.4 * topSim));
  } else {
    score = Math.min(0.15, mem.baseRate * 0.5);
    const n = mem.records.length;
    confidence = n / (n + 30);
  }
  const level = levelFor(score, cfg);

  // 4. Recommendations built from what previously failed and what fixed it
  const recs: Recommendation[] = [];
  const seen = new Set<string>();
  const push = (action: string, why: string) => {
    if (!seen.has(action)) {
      seen.add(action);
      recs.push({ action, why });
    }
  };
  for (const r of top) {
    const p = r.pattern;
    const ev = `${p.failures} of ${p.n} past changes with "${p.label}" failed`;
    if (BARE_ACTIONS[p.key]) push(BARE_ACTIONS[p.key], ev);
    const cat = topKey(p.categories);
    if (cat && CATEGORY_ACTIONS[cat[0]]) push(CATEGORY_ACTIONS[cat[0]], `${ev}; most often "${cat[0]}"`);
    const fix = topKey(p.fixes);
    if (fix) push(`Past fix that worked: ${fix[0]}`, `used ${fix[1]}x on "${p.label}"`);
    const specific = p.kind === 'component' || p.kind === 'combo';
    const tests = !specific ? [] : Object.entries(p.failedTests).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    if (tests.length) push(`Run these tests before promoting: ${tests.join(', ')}`, `they failed on past "${p.label}" changes`);
    const env = topKey(p.environments);
    if (env && env[1] >= 2) push(`Validate in ${env[0]} early (check-only deploy)`, `failures for "${p.label}" concentrated in ${env[0]}`);
  }
  if (level === 'HIGH') {
    push('Require a second reviewer and a check-only validation in INT before promoting', 'overall risk is HIGH');
  }

  return {
    components, score, level, confidence, baseRate: mem.baseRate, totalRecords: mem.records.length,
    risks: top, similar, recommendations: recs.slice(0, 8),
  };
}
