import { spawnSync } from 'node:child_process';
import type { ChangeRecord } from './types';
import { componentsFromPaths } from './components';

export function git(args: string[], cwd: string): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
  return r.stdout;
}

export function isGitRepo(cwd: string): boolean {
  try {
    git(['rev-parse', '--is-inside-work-tree'], cwd);
    return true;
  } catch {
    return false;
  }
}

export function currentBranch(cwd: string): string {
  try {
    return git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).trim();
  } catch {
    return 'working-tree';
  }
}

function refExists(cwd: string, ref: string): boolean {
  try {
    git(['rev-parse', '--verify', '--quiet', ref], cwd);
    return true;
  } catch {
    return false;
  }
}

/** Find a usable base branch: the requested one, or common alternatives. */
export function resolveBase(cwd: string, wanted: string): string {
  for (const ref of [wanted, `origin/${wanted}`, 'main', 'origin/main', 'master', 'origin/master']) {
    if (refExists(cwd, ref)) return ref;
  }
  throw new Error(`Could not find base branch "${wanted}". Pass --base <branch>.`);
}

export function diffPaths(cwd: string, base: string, head = 'HEAD'): string[] {
  let out: string;
  try {
    out = git(['diff', '--name-only', `${base}...${head}`], cwd);
  } catch {
    out = git(['diff', '--name-only', base, head], cwd);
  }
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

/** Files touched by commits that mention a story id; falls back to a branch whose name contains it. */
export function pathsForStory(cwd: string, story: string, baseWanted: string): string[] {
  const out = git(['log', '--all', '--no-merges', '--name-only', '--pretty=format:', `--grep=${story}`], cwd);
  const paths = out.split('\n').map((s) => s.trim()).filter(Boolean);
  if (paths.length) return [...new Set(paths)];
  const refs = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes'], cwd)
    .split('\n')
    .map((s) => s.trim())
    .filter((r) => r.toLowerCase().includes(story.toLowerCase()));
  if (!refs.length) return [];
  return diffPaths(cwd, resolveBase(cwd, baseWanted), refs[0]);
}

const STORY_RE = /\b([A-Z]{2,5}-\d{3,})\b/;

/** Build change records from git history. Outcome is a heuristic: reverts count as rolled back. */
export function historyFromGit(cwd: string, since?: string): ChangeRecord[] {
  const args = ['log', '--no-merges', '--name-only', '--pretty=format:@@%H|%aI|%s'];
  if (since) args.push(`--since=${since}`);
  const out = git(args, cwd);
  const byId = new Map<string, { rec: ChangeRecord; paths: string[] }>();
  let cur: { id: string; date: string; subject: string } | null = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('@@')) {
      const [hash, date, ...rest] = line.slice(2).split('|');
      const subject = rest.join('|');
      const story = subject.match(STORY_RE)?.[1];
      cur = { id: story ?? hash.slice(0, 8), date, subject };
      if (!byId.has(cur.id)) {
        const reverted = /\b(revert|rollback|rolled back)\b/i.test(subject);
        const isFix = /\b(fix|hotfix)\b/i.test(subject);
        byId.set(cur.id, {
          rec: {
            id: cur.id,
            title: subject,
            date,
            source: 'git',
            components: [],
            outcome: reverted ? 'rolled_back' : 'success',
            ...(isFix || reverted ? { fix: subject } : {}),
          },
          paths: [],
        });
      }
    } else if (line.trim() && cur) {
      byId.get(cur.id)!.paths.push(line.trim());
    }
  }
  const records: ChangeRecord[] = [];
  for (const { rec, paths } of byId.values()) {
    rec.components = componentsFromPaths(paths);
    if (rec.components.length) records.push(rec);
  }
  return records;
}
