import type { SupportedAgent } from './agent-targets';

import * as prompts from '@clack/prompts';

export interface PromptChoice {
  value: SupportedAgent;
  label: string;
  hint?: string;
}

export class InstallCancelledError extends Error {
  constructor() {
    super('Installation cancelled.');
    this.name = 'InstallCancelledError';
  }
}

const cancelled = () => {
  prompts.cancel('Installation cancelled.');
  throw new InstallCancelledError();
};

export const chooseFromList = async (
  question: string,
  choices: PromptChoice[],
  defaults: readonly SupportedAgent[]
): Promise<SupportedAgent[]> => {
  const result = await prompts.multiselect<SupportedAgent>({
    message: question,
    options: choices,
    initialValues: [...defaults],
    maxItems: choices.length,
    required: true
  });
  return prompts.isCancel(result) ? cancelled() : result;
};

export const chooseScope = async (projectRoot: string, defaultScope: 'project' | 'global') => {
  const result = await prompts.select<'project' | 'global'>({
    message: 'Where should Skill + MCP be installed?',
    initialValue: defaultScope,
    options: [
      {
        value: 'project',
        label: 'Project',
        hint: projectRoot
      },
      {
        value: 'global',
        label: 'Global',
        hint: 'Available from every project on this machine'
      }
    ]
  });
  return prompts.isCancel(result) ? cancelled() : result;
};
