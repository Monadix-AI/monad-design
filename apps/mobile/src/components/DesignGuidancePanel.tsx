import type { useDesignGuidance } from '../hooks/use-design-guidance';

import { adjustmentGoalReferences, adjustmentGoals } from '@monaddesign/client-contract';
import {
  ALargeSmall,
  AlignStartVertical,
  Check,
  MessageSquareText,
  Palette,
  TextCursorInput,
  Waves
} from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { createThemedStyles } from '../theme';
import { useWorkspaceColors } from '../workspace-theme';
import { WorkspacePanelControl as GlassControl } from './WorkspacePanelControl';

const icons = [ALargeSmall, AlignStartVertical, MessageSquareText, Palette, TextCursorInput, Waves];

export function DesignGuidancePanel({
  controller,
  disabled
}: {
  controller: ReturnType<typeof useDesignGuidance>;
  disabled: boolean;
}) {
  const colors = useWorkspaceColors();
  const styles = useStyles();
  const selected = adjustmentGoalReferences.find((goal) => controller.selected.some(({ id }) => id === goal.id));
  const full = !selected && controller.selected.length >= 4;
  return (
    <View style={styles.section}>
      <Text style={styles.label}>Adjustment goals</Text>
      <View style={styles.options}>
        {adjustmentGoals.map((goal, index) => {
          const reference = adjustmentGoalReferences[index];
          const Icon = icons[index];
          if (!reference || !Icon) return null;
          const active = selected?.id === reference.id;
          return (
            <GlassControl
              accessibilityHint={goal.description}
              accessibilityLabel={goal.title}
              accessibilityState={{ selected: active }}
              contentStyle={styles.optionContent}
              disabled={disabled || (!active && full)}
              key={goal.key}
              onPress={() => controller.toggle(reference)}
              style={styles.option}
              tone={active ? 'selected' : 'neutral'}
            >
              <Icon
                color={active ? colors.accent : colors.text}
                size={15}
              />
              <Text style={styles.optionText}>{goal.title}</Text>
              {active && (
                <Check
                  color={colors.accentText}
                  size={12}
                />
              )}
            </GlassControl>
          );
        })}
      </View>
      <Text style={styles.help}>
        {selected?.instructions ??
          (full ? '4 attachments selected. Remove one to choose a goal.' : 'Choose one goal to focus your adjustment.')}
      </Text>
    </View>
  );
}
const useStyles = createThemedStyles(
  (colors) =>
    StyleSheet.create({
      section: { gap: 10 },
      label: { color: colors.text, fontSize: 13, fontWeight: '600' },
      options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
      option: { width: '48%', minHeight: 44, borderRadius: 12 },
      optionContent: {
        paddingHorizontal: 4,
        paddingVertical: 6,
        justifyContent: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5
      },
      optionText: { color: colors.text, fontSize: 13 },
      help: { color: colors.muted, fontSize: 13, lineHeight: 17 }
    }),
  useWorkspaceColors
);
