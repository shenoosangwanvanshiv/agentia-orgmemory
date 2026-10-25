import type { ChangeRecord, Component, Memory, Pattern } from './types';
import { componentKey, isTestClass, objectOf } from './components';

export interface FeatureKey {
  key: string;
  kind: Pattern['kind'];
  label: string;
}

/**
 * Turn a change (list of components) into the "features" that memory learns from:
 * the exact component, the Salesforce object, the metadata type, type pairs that
 * change together, and two "missing companion" rules that are classic Salesforce failure causes.
 */
export function featureKeys(components: Component[]): FeatureKey[] {
  const out = new Map<string, FeatureKey>();
  const add = (key: string, kind: Pattern['kind'], label: string) => out.set(key, { key, kind, label });

  for (const c of components) {
    add(`component:${componentKey(c)}`, 'component', `${c.type} ${c.name}`);
    const obj = objectOf(c);
    if (obj) add(`object:${obj}`, 'object', `Changes touching object ${obj}`);
  }
  const types = [...new Set(components.map((c) => c.type))].sort();
  for (const t of types) add(`type:${t}`, 'type', `${t} changes`);
  for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
      add(`combo:${types[i]}+${types[j]}`, 'combo', `${types[i]} + ${types[j]} changed together`);
    }
  }
  const hasApex = types.includes('ApexClass') || types.includes('ApexTrigger');
  if (hasApex && !components.some(isTestClass)) {
    add('bare:apex-without-test', 'bare', 'Apex changed without a test class in the same change');
  }
  if (types.includes('CustomField') && !types.includes('PermissionSet') && !types.includes('Profile')) {
    add('bare:field-without-permission', 'bare', 'Custom field changed without a PermissionSet/Profile in the same change');
  }
  return [...out.values()];
}

const PRIOR_STRENGTH = 2;

function bump(map: Record<string, number>, k: string | undefined) {
  if (k) map[k] = (map[k] ?? 0) + 1;
}

/** Learn patterns (feature -> outcome statistics) from all records. */
export function learn(records: ChangeRecord[]): { patterns: Pattern[]; baseRate: number } {
  const bad = (r: ChangeRecord) => r.outcome !== 'success';
  const baseRate = records.length ? records.filter(bad).length / records.length : 0;
  const map = new Map<string, Pattern>();

  for (const r of records) {
    for (const f of featureKeys(r.components)) {
      let p = map.get(f.key);
      if (!p) {
        p = {
          key: f.key, kind: f.kind, label: f.label, n: 0, failures: 0, rate: 0,
          categories: {}, fixes: {}, environments: {}, failedTests: {}, recordIds: [],
        };
        map.set(f.key, p);
      }
      p.n++;
      p.recordIds.push(r.id);
      if (bad(r)) {
        p.failures++;
        bump(p.categories, r.failureCategory);
        bump(p.environments, r.environment);
        for (const t of r.failedTests ?? []) bump(p.failedTests, t);
      }
      bump(p.fixes, r.fix);
    }
  }
  const patterns = [...map.values()];
  for (const p of patterns) p.rate = (p.failures + baseRate * PRIOR_STRENGTH) / (p.n + PRIOR_STRENGTH);
  patterns.sort((a, b) => b.rate - a.rate || b.n - a.n);
  return { patterns, baseRate };
}

export function relearn(mem: Memory): Memory {
  const { patterns, baseRate } = learn(mem.records);
  mem.patterns = patterns;
  mem.baseRate = baseRate;
  mem.learnedAt = new Date().toISOString();
  return mem;
}
