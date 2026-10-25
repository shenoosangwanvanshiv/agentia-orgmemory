import { spawnSync } from 'node:child_process';
import type { Assessment } from './assess';
import type { ChangeRecord, Config } from './types';
import { componentsFromPaths } from './components';
import { git } from './gitutil';

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** Run the Agentia CLI (the host of this plugin) as a child process. */
export function runAgentia(args: string[], timeoutMs = 120_000): RunResult {
  const r = spawnSync('agentia', args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { ok: false, stdout: '', stderr: String(r.error.message) };
  return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function extractJson(text: string): unknown {
  const start = Math.min(...['[', '{'].map((ch) => text.indexOf(ch)).filter((i) => i >= 0));
  if (!Number.isFinite(start)) throw new Error('no JSON found in output');
  return JSON.parse(text.slice(start));
}

function pickRows(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === 'object') {
    for (const k of ['result', 'data', 'records', 'items', 'results', 'works', 'stories']) {
      const v = (json as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

function pick(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}

/**
 * Best-effort import of user stories from Copado (agentia cicd work list).
 * Components are found by matching the story name in git commit messages.
 * Only finished or failed stories are imported (in-progress ones teach nothing yet).
 */
export function recordsFromCopado(cfg: Config, cwd: string): { records: ChangeRecord[]; notes: string[] } {
  const notes: string[] = [];
  const res = runAgentia(cfg.copado.workList);
  if (!res.ok) {
    notes.push(`Could not run "agentia ${cfg.copado.workList.join(' ')}": ${res.stderr.trim() || 'unknown error'}`);
    return { records: [], notes };
  }
  let rows: Record<string, unknown>[];
  try {
    rows = pickRows(extractJson(res.stdout));
  } catch (e) {
    notes.push(`Copado output was not JSON: ${(e as Error).message}`);
    return { records: [], notes };
  }
  notes.push(`Copado returned ${rows.length} user stories.`);
  const records: ChangeRecord[] = [];
  for (const row of rows) {
    const name = pick(row, ['name', 'Name', 'workItemName', 'id']);
    const title = pick(row, ['title', 'Title', 'copado__User_Story_Title__c', 'UserStoryTitle', 'summary']) ?? name ?? 'story';
    const status = pick(row, ['status', 'Status', 'copado__Status__c', 'stage']) ?? '';
    if (!name) continue;
    const failed = /(fail|error|reject|cancel)/i.test(status);
    const done = /(done|complete|success|deploy|merged|closed|released)/i.test(status);
    if (!failed && !done) continue;
    let paths: string[] = [];
    try {
      paths = git(['log', '--all', '--no-merges', '--name-only', '--pretty=format:', `--grep=${name}`], cwd)
        .split('\n').map((s) => s.trim()).filter(Boolean);
    } catch { /* not a git repo */ }
    const components = componentsFromPaths(paths);
    if (!components.length) {
      notes.push(`Skipped ${name}: no commits mentioning it were found in git.`);
      continue;
    }
    records.push({
      id: name, title, date: pick(row, ['createdDate', 'CreatedDate']) ?? new Date().toISOString(),
      source: 'copado', components, outcome: failed ? 'failed' : 'success',
    });
  }
  return { records, notes };
}

export function buildPrompt(title: string, a: Assessment): string {
  const lines = [
    'You are the release agent for a Salesforce DevOps team. Based ONLY on the evidence below from the org\'s own deployment history,',
    'write a short (max 6 lines) risk briefing for the developer about to promote this change. Do not invent facts.',
    `Change: ${title}`,
    `Components: ${a.components.map((c) => `${c.type}:${c.name}`).join(', ')}`,
    `Predicted risk: ${a.level} (${Math.round(a.score * 100)}%), confidence ${Math.round(a.confidence * 100)}%.`,
    'Evidence:',
    ...a.risks.map((r) => `- ${r.pattern.label}: failed ${r.pattern.failures} of ${r.pattern.n} past changes`),
    'Recommended actions:',
    ...a.recommendations.map((r) => `- ${r.action}`),
  ];
  return lines.join('\n');
}

/** Ask a Copado AI agent to explain the assessment. Returns null if the agent is unavailable. */
export function askAgent(cfg: Config, prompt: string): string | null {
  const res = runAgentia(['ai', 'agent', 'ask', '-p', prompt, '--agent', cfg.aiAgent, '--json'], 180_000);
  if (!res.ok) return null;
  try {
    const j = extractJson(res.stdout) as Record<string, unknown>;
    const text = pick(j, ['response', 'answer', 'message', 'text', 'output', 'content']);
    return text ?? JSON.stringify(j, null, 2);
  } catch {
    return res.stdout.trim() || null;
  }
}
