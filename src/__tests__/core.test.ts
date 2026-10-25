import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parsePath, parseComponentList, objectOf } from '../lib/components';
import { featureKeys, relearn } from '../lib/learn';
import { assess } from '../lib/assess';
import { DEFAULT_CONFIG } from '../lib/config';
import { emptyMemory } from '../lib/store';
import type { ChangeRecord } from '../lib/types';

const seedPath = path.join(__dirname, '..', '..', 'demo', 'seed-history.json');
const seed: ChangeRecord[] = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

function memoryFromSeed() {
  const mem = emptyMemory();
  mem.records = [...seed];
  return relearn(mem);
}

test('parsePath understands source-format metadata', () => {
  assert.deepEqual(parsePath('force-app/main/default/classes/Foo.cls'), { type: 'ApexClass', name: 'Foo' });
  assert.deepEqual(parsePath('force-app/main/default/classes/Foo.cls-meta.xml'), { type: 'ApexClass', name: 'Foo' });
  assert.deepEqual(parsePath('force-app/main/default/objects/Account/fields/Region__c.field-meta.xml'), { type: 'CustomField', name: 'Account.Region__c' });
  assert.deepEqual(parsePath('force-app/main/default/flows/My_Flow.flow-meta.xml'), { type: 'Flow', name: 'My_Flow' });
  assert.deepEqual(parsePath('force-app/main/default/lwc/myCmp/myCmp.js'), { type: 'LightningComponentBundle', name: 'myCmp' });
  assert.equal(parsePath('README.md'), null);
});

test('parseComponentList and objectOf', () => {
  const list = parseComponentList('CustomField:Account.Region__c, Flow:My_Flow');
  assert.equal(list.length, 2);
  assert.equal(objectOf(list[0]), 'Account');
  assert.throws(() => parseComponentList('nonsense'));
});

test('featureKeys adds the missing-companion rules', () => {
  const keys = featureKeys([{ type: 'ApexClass', name: 'Foo' }, { type: 'CustomField', name: 'Account.X__c' }]).map((k) => k.key);
  assert.ok(keys.includes('bare:apex-without-test'));
  assert.ok(keys.includes('bare:field-without-permission'));
  const ok = featureKeys([{ type: 'ApexClass', name: 'Foo' }, { type: 'ApexClass', name: 'FooTest' }]).map((k) => k.key);
  assert.ok(!ok.includes('bare:apex-without-test'));
});

test('a change that resembles past failures is predicted HIGH with evidence and recommendations', () => {
  const mem = memoryFromSeed();
  const a = assess(mem, parseComponentList('CustomField:Opportunity.Discount_Tier__c,ValidationRule:Opportunity.Discount_Tier_Check,ApexClass:OpportunityPricingService'), DEFAULT_CONFIG);
  assert.equal(a.level, 'HIGH');
  assert.ok(a.risks.length >= 3);
  assert.ok(a.similar.length > 0);
  assert.ok(a.recommendations.length > 0);
});

test('a safe change is predicted LOW', () => {
  const mem = memoryFromSeed();
  const a = assess(mem, parseComponentList('LightningComponentBundle:newWidget'), DEFAULT_CONFIG);
  assert.equal(a.level, 'LOW');
});

test('learning again: a new failure raises confidence for the same kind of change', () => {
  const mem = memoryFromSeed();
  const comps = parseComponentList('CustomField:Opportunity.Discount_Tier__c,ApexClass:OpportunityPricingService');
  const before = assess(mem, comps, DEFAULT_CONFIG);
  mem.records.push({ id: 'US-NEW', title: 'new', date: new Date().toISOString(), source: 'feedback', components: comps, outcome: 'failed', failureCategory: 'permission' });
  relearn(mem);
  const after = assess(mem, comps, DEFAULT_CONFIG);
  assert.ok(after.confidence > before.confidence);
  assert.ok(after.score >= before.score);
});
