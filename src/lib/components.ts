import type { Component } from './types';

const DIR_TYPE: Record<string, string> = {
  classes: 'ApexClass',
  triggers: 'ApexTrigger',
  flows: 'Flow',
  layouts: 'Layout',
  permissionsets: 'PermissionSet',
  profiles: 'Profile',
  lwc: 'LightningComponentBundle',
  aura: 'AuraDefinitionBundle',
  flexipages: 'FlexiPage',
  customMetadata: 'CustomMetadata',
  labels: 'CustomLabels',
  staticresources: 'StaticResource',
  tabs: 'CustomTab',
  applications: 'CustomApplication',
  workflows: 'Workflow',
  approvalProcesses: 'ApprovalProcess',
  sharingRules: 'SharingRules',
  pages: 'ApexPage',
  components: 'ApexComponent',
  namedCredentials: 'NamedCredential',
  remoteSiteSettings: 'RemoteSiteSetting',
  reports: 'Report',
  dashboards: 'Dashboard',
  quickActions: 'QuickAction',
  email: 'EmailTemplate',
};

const OBJECT_SUB: Record<string, string> = {
  fields: 'CustomField',
  validationRules: 'ValidationRule',
  recordTypes: 'RecordType',
  listViews: 'ListView',
  compactLayouts: 'CompactLayout',
  businessProcesses: 'BusinessProcess',
  webLinks: 'WebLink',
  fieldSets: 'FieldSet',
  sharingReasons: 'SharingReason',
};

const OBJECT_SCOPED = new Set(Object.values(OBJECT_SUB));

function baseName(file: string): string {
  return file.replace(/-meta\.xml$/, '').replace(/\.[^./]+$/, '');
}

/** Turn a source-format file path into a Salesforce component (or null if it is not metadata). */
export function parsePath(p: string): Component | null {
  const norm = p.replace(/\\/g, '/');
  const m = norm.match(/(?:^|\/)main\/default\/([^/]+)\/(.+)$/);
  if (!m) return null;
  const dir = m[1];
  const rest = m[2].split('/');
  if (dir === 'objects') {
    const obj = rest[0];
    if (rest.length === 2 && /\.object-meta\.xml$/.test(rest[1])) return { type: 'CustomObject', name: obj };
    const sub = OBJECT_SUB[rest[1]];
    if (sub && rest.length >= 3) return { type: sub, name: `${obj}.${baseName(rest[2])}` };
    return null;
  }
  const type = DIR_TYPE[dir];
  if (!type) return null;
  if (dir === 'lwc' || dir === 'aura') {
    if (rest.length < 2) return null;
    return { type, name: rest[0] };
  }
  return { type, name: baseName(rest[rest.length - 1]) };
}

export function componentKey(c: Component): string {
  return `${c.type}:${c.name}`;
}

export function dedupe(list: Component[]): Component[] {
  const m = new Map<string, Component>();
  for (const c of list) m.set(componentKey(c), c);
  return [...m.values()];
}

export function componentsFromPaths(paths: string[]): Component[] {
  const out: Component[] = [];
  for (const p of paths) {
    const c = parsePath(p);
    if (c) out.push(c);
  }
  return dedupe(out);
}

/** Parse "Flow:My_Flow,CustomField:Account.X__c" */
export function parseComponentList(text: string): Component[] {
  const out: Component[] = [];
  for (const part of text.split(',')) {
    const s = part.trim();
    if (!s) continue;
    const i = s.indexOf(':');
    if (i < 1) throw new Error(`Bad component "${s}". Use Type:Name, for example CustomField:Account.Region__c`);
    out.push({ type: s.slice(0, i).trim(), name: s.slice(i + 1).trim() });
  }
  return dedupe(out);
}

export function objectOf(c: Component): string | undefined {
  if (OBJECT_SCOPED.has(c.type)) return c.name.split('.')[0];
  if (c.type === 'CustomObject') return c.name;
  if (c.type === 'Layout') return c.name.split('-')[0];
  return undefined;
}

export function isTestClass(c: Component): boolean {
  return c.type === 'ApexClass' && /(_?tests?)$/i.test(c.name);
}
