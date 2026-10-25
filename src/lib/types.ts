export type Outcome = 'success' | 'failed' | 'rolled_back';
export type Level = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Component {
  type: string; // e.g. ApexClass, Flow, CustomField
  name: string; // e.g. AccountHandler, Account.Region__c
}

export interface ChangeRecord {
  id: string; // story id (US-0000012) or commit hash
  title: string;
  date: string; // ISO date
  source: 'seed' | 'git' | 'copado' | 'feedback';
  components: Component[];
  outcome: Outcome;
  environment?: string; // where it failed (INT, UAT, PROD)
  failureCategory?: string;
  failureMessage?: string;
  fix?: string; // what resolved it
  incident?: string; // post-release incident, if any
  failedTests?: string[];
}

export interface Pattern {
  key: string;
  kind: 'component' | 'object' | 'type' | 'combo' | 'bare';
  label: string;
  n: number; // changes that contained this pattern
  failures: number; // of those, how many failed / were rolled back
  rate: number; // smoothed failure rate 0..1
  categories: Record<string, number>;
  fixes: Record<string, number>;
  environments: Record<string, number>;
  failedTests: Record<string, number>;
  recordIds: string[]; // evidence
}

export interface PredictionLog {
  id: string;
  at: string;
  title?: string;
  components: Component[];
  score: number;
  level: Level;
  confidence: number;
  actual?: Outcome;
  correct?: boolean;
}

export interface Memory {
  version: 1;
  records: ChangeRecord[];
  patterns: Pattern[];
  baseRate: number;
  learnedAt?: string;
  predictions: PredictionLog[];
}

export interface Config {
  storeDir: string;
  baseRef: string;
  minEvidence: number;
  mediumThreshold: number;
  highThreshold: number;
  aiAgent: string;
  copado: { workList: string[] };
}
