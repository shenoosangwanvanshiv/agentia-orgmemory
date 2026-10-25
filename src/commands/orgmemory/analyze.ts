import { Command } from '@oclif/core';
import { changeFlags } from '../../lib/flags';
import { compact, runView } from '../../lib/run';

export default class Analyze extends Command {
  static summary = 'ANALYZE: compare a new change with similar past changes.';
  static examples = ['<%= config.bin %> orgmemory analyze --components CustomField:Opportunity.Discount_Tier__c'];
  static enableJsonFlag = true;
  static flags = { ...changeFlags };

  async run() {
    const { flags } = await this.parse(Analyze);
    const { change, a, lines } = runView('analyze', flags);
    for (const l of lines) this.log(l);
    return compact(change.id, change.title, a);
  }
}
