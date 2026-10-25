import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ChangeRecord, Config, Memory } from './types';

export function emptyMemory(): Memory {
  return { version: 1, records: [], patterns: [], baseRate: 0, predictions: [] };
}

export function memoryPath(cfg: Config, root: string): string {
  return path.join(root, cfg.storeDir, 'memory.json');
}

export function loadMemory(cfg: Config, root: string): Memory {
  const p = memoryPath(cfg, root);
  if (!fs.existsSync(p)) return emptyMemory();
  return { ...emptyMemory(), ...JSON.parse(fs.readFileSync(p, 'utf8')) };
}

export function saveMemory(cfg: Config, root: string, mem: Memory): void {
  const p = memoryPath(cfg, root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(mem, null, 2) + '\n');
}

/** Insert or replace records by id. Returns counts. */
export function upsertRecords(mem: Memory, recs: ChangeRecord[]): { added: number; updated: number } {
  let added = 0;
  let updated = 0;
  for (const r of recs) {
    const i = mem.records.findIndex((x) => x.id === r.id);
    if (i >= 0) {
      mem.records[i] = r;
      updated++;
    } else {
      mem.records.push(r);
      added++;
    }
  }
  return { added, updated };
}
