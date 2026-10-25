import type { Assessment } from './assess';
import type { Level } from './types';

const on = !process.env.NO_COLOR && process.stdout.isTTY;
const c = (code: number) => (s: string) => (on ? `\x1b[${code}m${s}\x1b[0m` : s);
export const bold = c(1);
export const dim = c(2);
export const red = c(31);
export const green = c(32);
export const yellow = c(33);
export const cyan = c(36);

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const levelColor = (l: Level) => (l === 'HIGH' ? red : l === 'MEDIUM' ? yellow : green);

export function bar(p: number, width = 20): string {
  const filled = Math.round(p * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export type View = 'analyze' | 'predict' | 'recommend';

export function renderAssessment(title: string, a: Assessment, view: View): string[] {
  const L: string[] = [];
  L.push(bold(`Org Memory ${view}: ${title}`));
  L.push(dim(`${a.components.length} component(s) in this change, ${a.totalRecords} past changes in memory`));
  L.push('');
  if (view !== 'recommend') {
    L.push(bold('Components'));
    for (const comp of a.components) L.push(`  • ${comp.type}  ${comp.name}`);
    L.push('');
  }
  if (view === 'predict') {
    const col = levelColor(a.level);
    L.push(`${bold('Risk')}        ${col(`${a.level}  ${pct(a.score)}`)}  ${col(bar(a.score))}`);
    L.push(`${bold('Confidence')}  ${pct(a.confidence)}  ${dim(`(baseline failure rate in this org: ${pct(a.baseRate)})`)}`);
    L.push('');
  }
  if (view === 'predict' || view === 'analyze') {
    L.push(bold('Why (evidence from your org history)'));
    if (!a.risks.length) L.push('  No strong historical signal for these components.');
    for (const r of a.risks) {
      const p = r.pattern;
      L.push(`  ▲ ${p.label}`);
      L.push(dim(`    failed ${p.failures} of ${p.n} past changes (${pct(p.failures / p.n)}), ${r.lift.toFixed(1)}x the org baseline, evidence: ${p.recordIds.slice(-4).join(', ')}`));
    }
    L.push('');
  }
  if (view === 'analyze' || view === 'predict') {
    L.push(bold('Most similar past changes'));
    if (!a.similar.length) L.push('  None found.');
    for (const s of a.similar) {
      const r = s.record;
      const tag = r.outcome === 'success' ? green('OK    ') : red(r.outcome === 'failed' ? 'FAILED' : 'ROLLED');
      L.push(`  ${tag} ${r.id}  ${r.title}  ${dim(`(similarity ${pct(s.similarity)}${r.environment ? `, ${r.environment}` : ''})`)}`);
      if (r.failureMessage) L.push(dim(`         ${r.failureMessage}`));
      if (r.fix) L.push(dim(`         fix: ${r.fix}`));
    }
    L.push('');
  }
  if (view === 'recommend' || view === 'predict') {
    L.push(bold('Recommended actions'));
    if (!a.recommendations.length) L.push('  Nothing special. Proceed with your normal checks.');
    a.recommendations.forEach((r, i) => {
      L.push(`  ${i + 1}. ${r.action}`);
      L.push(dim(`     because ${r.why}`));
    });
    L.push('');
  }
  return L;
}
