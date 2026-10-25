import { Command, Flags } from '@oclif/core';
import { askAgent, buildPrompt } from '../../lib/agentia';
import { changeFlags } from '../../lib/flags';
import { bold, dim } from '../../lib/render';
import { compact, runView } from '../../lib/run';
import { saveMemory } from '../../lib/store';

export default class Predict extends Command {
  static summary = 'PREDICT: highlight deployment risk for a change, with evidence, confidence and recommended actions.';
  static description =
    'Run this on your feature branch (or give --story / --components). The prediction is logged so that ' +
    '"feedback" can later compare it with the real outcome.';
  static examples = [
    '<%= config.bin %> orgmemory predict',
    '<%= config.bin %> orgmemory predict --story US-0000012 --ai',
    '<%= config.bin %> orgmemory predict --components CustomField:Opportunity.Discount_Tier__c,ApexClass:OpportunityPricingService --name US-DEMO-1',
  ];
  static enableJsonFlag = true;
  static flags = {
    ...changeFlags,
    name: Flags.string({ summary: 'Id to log this prediction under (default: story or branch name)' }),
    'no-log': Flags.boolean({ summary: 'Do not log this prediction' }),
    ai: Flags.boolean({ summary: 'Ask a Copado AI agent to write a short briefing from the evidence' }),
  };

  async run() {
    const { flags } = await this.parse(Predict);
    const { cfg, mem, root, change, a, lines } = runView('predict', flags, flags.name ?? flags.story);
    for (const l of lines) this.log(l);
    if (!flags['no-log']) {
      mem.predictions = mem.predictions.filter((p) => !(p.id === change.id && p.actual === undefined));
      mem.predictions.push({
        id: change.id, at: new Date().toISOString(), title: change.title, components: change.components,
        score: a.score, level: a.level, confidence: a.confidence,
      });
      saveMemory(cfg, root, mem);
      this.log(dim(`Prediction logged as "${change.id}". After the release run: agentia orgmemory feedback --change ${change.id} --outcome <success|failed|rolled_back>`));
    }
    if (flags.ai) {
      this.log('');
      this.log(bold(`Copado ${cfg.aiAgent} agent briefing`));
      const text = askAgent(cfg, buildPrompt(change.title, a));
      this.log(text ?? dim('  (Copado AI agent was not available; the evidence above is unchanged.)'));
    }
    return compact(change.id, change.title, a);
  }
}
