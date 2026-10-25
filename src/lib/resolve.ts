import type { Component, Config } from './types';
import { componentsFromPaths, parseComponentList } from './components';
import { currentBranch, diffPaths, isGitRepo, pathsForStory, resolveBase } from './gitutil';

export interface ChangeInput {
  components?: string;
  files?: string;
  story?: string;
  base?: string;
}

export interface ResolvedChange {
  id: string;
  title: string;
  components: Component[];
}

/**
 * Work out which components make up "the change". In order of priority:
 * --components, --files, --story (found in git), otherwise the current branch's diff against the base branch.
 */
export function resolveChange(cfg: Config, cwd: string, input: ChangeInput, fallbackId?: string): ResolvedChange {
  if (input.components) {
    const components = parseComponentList(input.components);
    const id = input.story ?? fallbackId ?? 'manual-change';
    return { id, title: id, components };
  }
  if (input.files) {
    const components = componentsFromPaths(input.files.split(',').map((s) => s.trim()));
    const id = input.story ?? fallbackId ?? 'manual-change';
    return { id, title: id, components };
  }
  if (!isGitRepo(cwd)) throw new Error('Not inside a git repository. Run this in your Copado pipeline project, or pass --components.');
  if (input.story) {
    const components = componentsFromPaths(pathsForStory(cwd, input.story, input.base ?? cfg.baseRef));
    if (!components.length) throw new Error(`No metadata found in git for story ${input.story}. Is the branch or commit message named after it?`);
    return { id: input.story, title: input.story, components };
  }
  const base = resolveBase(cwd, input.base ?? cfg.baseRef);
  const components = componentsFromPaths(diffPaths(cwd, base));
  const branch = currentBranch(cwd);
  if (!components.length) throw new Error(`No Salesforce metadata differs between ${base} and ${branch}. Check out your feature branch or pass --components.`);
  return { id: fallbackId ?? branch, title: `${branch} (vs ${base})`, components };
}
