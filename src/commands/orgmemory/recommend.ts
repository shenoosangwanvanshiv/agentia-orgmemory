import { Command } from '@oclif/core';
import { changeFlags } from '../../lib/flags';
import { compact, runView } from '../../lib/run';

export default class Recommend extends Command {
  static summary = 'RECOMMEND: suggest tests, reviews and actions based on what previously worked or failed.';
  static examples = ['<%= config.bin %> orgmemory recommend --story US-0000012'];
  static enableJsonFlag = true;
  static flags = { ...changeFlags };

  async run() {
    const { flags } = await this.parse(Recommend);
    const { change, a, lines } = runView('recommend', flags);
    for (const l of lines) this.log(l);
    return compact(change.id, change.title, a);
  }
}
