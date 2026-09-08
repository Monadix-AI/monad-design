import { adjustmentGoalReferences, type DesignGuidance, type DesignReference } from '@monaddesign/client-contract';
import { builtInDesignStyles } from '@monaddesign/client-rtk/use-design-library';
import { useEffect, useState } from 'react';

import { buildDesignGuidance, toggleDesignReference } from '../design-guidance-model';

export function useDesignGuidance(sessionKey: string, hasSelection: boolean) {
  const [selected, setSelected] = useState<DesignReference[]>([]);
  const [scope, setScope] = useState<DesignGuidance['scope']>('screen');
  const [focus, setFocus] = useState('');
  const [preserve, setPreserve] = useState('Existing content, navigation and interactions');
  useEffect(() => {
    if (!sessionKey) return;
    setSelected([]);
    setFocus('');
    setPreserve('Existing content, navigation and interactions');
  }, [sessionKey]);
  useEffect(() => setScope(hasSelection ? 'selected_element' : 'screen'), [hasSelection]);
  return {
    entries: [...adjustmentGoalReferences, ...builtInDesignStyles],
    selected,
    scope: hasSelection ? scope : ('screen' as const),
    focus,
    preserve,
    setScope,
    setFocus,
    setPreserve,
    toggle: (entry: DesignReference) => setSelected((current) => toggleDesignReference(current, entry)),
    clearDraft: () => {
      setSelected([]);
      setScope('screen');
      setFocus('');
      setPreserve('Existing content, navigation and interactions');
    },
    submitted: () => {
      setSelected([]);
      setFocus('');
    },
    guidance: buildDesignGuidance(selected, scope, hasSelection, focus, preserve)
  };
}
