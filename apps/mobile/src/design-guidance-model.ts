import { type DesignGuidance, type DesignReference, isAdjustmentGoal } from '@monaddesign/client-contract';

export function toggleDesignReference(current: DesignReference[], entry: DesignReference) {
  if (current.some(({ id }) => id === entry.id)) return current.filter(({ id }) => id !== entry.id);
  const remaining = isAdjustmentGoal(entry) ? current.filter((reference) => !isAdjustmentGoal(reference)) : current;
  return remaining.length < 4 ? [...remaining, structuredClone(entry)] : current;
}

export function buildDesignGuidance(
  references: DesignReference[],
  scope: DesignGuidance['scope'],
  hasSelection: boolean,
  focus: string,
  preserve: string
): DesignGuidance | undefined {
  if (!references.length) return undefined;
  return { references, scope: hasSelection ? scope : 'screen', focus, preserve };
}
