import { createInterface } from 'node:readline/promises';

import { writeLine } from './output';

const ask = async (question: string) => {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await prompt.question(question)).trim();
  } finally {
    prompt.close();
  }
};

export const chooseFromList = async <T extends string>(
  question: string,
  values: readonly T[],
  defaults: readonly T[]
): Promise<T[]> => {
  const allowed = new Set(values);
  while (true) {
    const suffix = defaults.length > 0 ? ` [${defaults.join(', ')}]` : '';
    const answer = await ask(`${question}${suffix}: `);
    if (!answer && defaults.length > 0) return [...defaults];
    const selected = [
      ...new Set(
        answer
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      )
    ];
    const invalid = selected.filter((value) => !allowed.has(value as T));
    if (invalid.length === 0 && selected.length > 0) return selected as T[];
    if (invalid.length > 0) writeLine(`Unknown selection: ${invalid.join(', ')}`);
    else writeLine('Choose at least one agent.');
  }
};

export const chooseScope = async (projectRoot: string, defaultScope: 'project' | 'global') => {
  while (true) {
    const answer = (
      await ask(`Install Skill + MCP for this project (${projectRoot}) or globally? [${defaultScope}] `)
    ).toLowerCase();
    if (!answer) return defaultScope;
    if (answer === 'project' || answer === 'p') return 'project' as const;
    if (answer === 'global' || answer === 'g' || answer === 'user') return 'global' as const;
    writeLine('Choose project or global.');
  }
};
