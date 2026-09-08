import type { DesignGuidance, DesignReference } from '@monaddesign/client-contract';

export function toggleDesignReference(current: DesignReference[], entry: DesignReference) {
  if (current.some(({ id }) => id === entry.id)) return current.filter(({ id }) => id !== entry.id);
  return current.length < 4 ? [...current, entry] : current;
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
