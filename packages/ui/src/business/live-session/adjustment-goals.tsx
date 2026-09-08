import type { DesignLibraryController } from './design-library';

import { adjustmentGoalReferences, adjustmentGoals } from '@monaddesign/client-contract';
import {
  ALargeSmall,
  AlignStartVertical,
  Check,
  MessageSquareText,
  Palette,
  TextCursorInput,
  Waves
} from 'lucide-react';
import { useId } from 'react';

const goalIcons = [ALargeSmall, AlignStartVertical, MessageSquareText, Palette, TextCursorInput, Waves];

export function AdjustmentGoals({ library, disabled }: { library: DesignLibraryController; disabled: boolean }) {
  const id = useId();
  const selected = adjustmentGoalReferences.filter((goal) => library.selected.some(({ id }) => id === goal.id));
  const full = library.selected.length >= 4;

  return (
    <fieldset
      className="adjustment-goals"
      disabled={disabled}
    >
      <legend>Adjustment goals</legend>
      <div
        aria-describedby={`${id}-hint`}
        className="adjustment-goal-options"
      >
        {adjustmentGoals.map((goal, index) => {
          const reference = adjustmentGoalReferences[index];
          const Icon = goalIcons[index];
          if (!reference || !Icon) return null;
          const active = selected.some(({ id }) => id === reference.id);
          return (
            <button
              aria-pressed={active}
              className="adjustment-goal-option"
              disabled={!active && full}
              key={goal.key}
              onClick={() => library.toggle(reference)}
              title={goal.description}
              type="button"
            >
              <Icon
                aria-hidden="true"
                size={15}
              />
              <span>{goal.title}</span>
              {active && (
                <Check
                  aria-hidden="true"
                  className="adjustment-goal-check"
                  size={12}
                />
              )}
            </button>
          );
        })}
      </div>
      <p id={`${id}-hint`}>
        {full ? '4 attachments selected. Remove one to add another.' : 'Combine goals, then add direction if needed.'}
      </p>
      {selected.length > 0 && (
        <details className="adjustment-goal-guidance">
          <summary>Skills for this request · {selected.length}</summary>
          {selected.map((goal) => (
            <div key={goal.id}>
              <strong>{goal.title}</strong>
              <p>{goal.instructions}</p>
              <small>{goal.skillName} · Loaded by your agent when sent</small>
            </div>
          ))}
        </details>
      )}
    </fieldset>
  );
}
