import { Flags } from '@oclif/core';

/** Flags that say "which change are we talking about". */
export const changeFlags = {
  components: Flags.string({ char: 'c', summary: 'Components as Type:Name, comma separated (e.g. CustomField:Account.Region__c,Flow:My_Flow)' }),
  files: Flags.string({ summary: 'Changed file paths, comma separated' }),
  story: Flags.string({ char: 's', summary: 'Copado user story name (e.g. US-0000012); components are found in git' }),
  base: Flags.string({ summary: 'Base branch to diff against (default from config, usually main)' }),
};
