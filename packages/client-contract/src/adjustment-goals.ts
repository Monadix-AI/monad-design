import type { DesignReference } from './index';

/** UI metadata and invocation routing only. Skill bodies ship with the CLI. */
export const adjustmentGoals = [
  {
    key: 'typography',
    title: 'Fonts',
    description: 'Clarify text hierarchy and reading comfort.',
    skillName: 'monad-design-typography'
  },
  {
    key: 'layout',
    title: 'Layout',
    description: 'Improve spacing, alignment and grouping.',
    skillName: 'monad-design-layout'
  },
  {
    key: 'callout',
    title: 'Callout',
    description: 'Make a hint or key message easier to notice.',
    skillName: 'monad-design-callout'
  },
  {
    key: 'color',
    title: 'Color',
    description: 'Balance emphasis, surfaces and contrast.',
    skillName: 'monad-design-color'
  },
  {
    key: 'copy',
    title: 'Copy',
    description: 'Make labels and guidance easier to understand.',
    skillName: 'monad-design-copy'
  },
  {
    key: 'motion',
    title: 'Motion',
    description: 'Explain transitions and interaction feedback.',
    skillName: 'monad-design-motion'
  }
] as const;

export const adjustmentSkillNames = adjustmentGoals.map(({ skillName }) => skillName);
export const adjustmentSkillVersion = '2';

export const adjustmentGoalReferences: DesignReference[] = adjustmentGoals.map((goal) => ({
  id: `monad-goal-${goal.key}`,
  title: goal.title,
  kind: 'skill',
  source: 'Monad Design adjustment goals',
  version: adjustmentSkillVersion,
  platform: 'native',
  skillName: goal.skillName,
  instructions: goal.description
}));

export function isAdjustmentGoal(reference: DesignReference) {
  return reference.kind === 'skill' && adjustmentGoalReferences.some(({ id }) => id === reference.id);
}

/** Resolve only the built-in allowlist, never a path supplied by imported text. */
export function requiredAdjustmentSkills(references: DesignReference[] = []) {
  return adjustmentGoals
    .filter((goal) =>
      references.some((reference) => isAdjustmentGoal(reference) && reference.id === `monad-goal-${goal.key}`)
    )
    .map((goal) => ({
      name: goal.skillName,
      version: references.find(({ id }) => id === `monad-goal-${goal.key}`)?.version ?? adjustmentSkillVersion,
      relativePath: `../${goal.skillName}/SKILL.md`
    }));
}

/** Preserve authored text; only synthesize a request for explicitly selected goals. */
export function resolveAdjustmentRequest(request: string, references: DesignReference[] = []) {
  if (request.trim()) return request;
  const goals = adjustmentGoals.filter((goal) =>
    references.some((reference) => isAdjustmentGoal(reference) && reference.id === `monad-goal-${goal.key}`)
  );
  return goals.length
    ? `Refine ${goals.map(({ title }) => title.toLowerCase()).join(', ')} using the selected adjustment skills. Preserve existing content, navigation and behavior.`
    : '';
}
