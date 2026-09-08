import type { useDesignGuidance } from '../hooks/use-design-guidance';

import { isAdjustmentGoal } from '@monaddesign/client-contract';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../theme';
import { GlassControl } from './GlassControl';

type GuidanceController = ReturnType<typeof useDesignGuidance>;
export function DesignGuidancePanel({
  controller,
  disabled,
  hasSelection,
  referencesOnly = false
}: {
  controller: GuidanceController;
  disabled: boolean;
  hasSelection: boolean;
  referencesOnly?: boolean;
}) {
  return (
    <View style={styles.section}>
      {(referencesOnly ? [false] : [true]).map((goals) => (
        <View
          key={String(goals)}
          style={styles.section}
        >
          <Text style={styles.label}>{goals ? 'Adjustment goals' : 'Design styles'}</Text>
          <View style={styles.options}>
            {controller.entries
              .filter((entry) => isAdjustmentGoal(entry) === goals)
              .map((entry) => {
                const selected = controller.selected.some(({ id }) => id === entry.id);
                return (
                  <GlassControl
                    accessibilityHint={entry.instructions}
                    accessibilityLabel={entry.title}
                    accessibilityState={{ selected }}
                    contentStyle={styles.optionContent}
                    disabled={disabled || (!selected && controller.selected.length >= 4)}
                    key={entry.id}
                    onPress={() => controller.toggle(entry)}
                    solid
                    style={styles.option}
                    tone={selected ? 'accent' : 'neutral'}
                  >
                    <Text style={[styles.optionText, selected && styles.selected]}>
                      {selected ? '✓ ' : ''}
                      {entry.title}
                    </Text>
                  </GlassControl>
                );
              })}
          </View>
        </View>
      ))}
      <Text style={styles.help}>Choose up to four goals or references · {controller.selected.length}/4</Text>
      {!referencesOnly && controller.selected.length > 0 && (
        <>
          <Text style={styles.label}>Apply to</Text>
          <View style={styles.options}>
            {(['screen', 'selected_element'] as const).map((scope) => (
              <GlassControl
                accessibilityState={{ selected: controller.scope === scope }}
                contentStyle={styles.optionContent}
                disabled={disabled || (scope === 'selected_element' && !hasSelection)}
                key={scope}
                onPress={() => controller.setScope(scope)}
                solid
                style={styles.option}
                tone={controller.scope === scope ? 'selected' : 'neutral'}
              >
                <Text style={styles.optionText}>{scope === 'screen' ? 'Current screen' : 'Selected element'}</Text>
              </GlassControl>
            ))}
          </View>
          <Text style={styles.label}>Focus</Text>
          <TextInput
            accessibilityLabel="Design focus"
            editable={!disabled}
            maxLength={1000}
            multiline
            onChangeText={controller.setFocus}
            placeholder="What should stand out?"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={controller.focus}
          />
          <Text style={styles.label}>Preserve</Text>
          <TextInput
            accessibilityLabel="What to preserve"
            editable={!disabled}
            maxLength={1000}
            multiline
            onChangeText={controller.setPreserve}
            style={styles.input}
            value={controller.preserve}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, borderRadius: 9 },
  optionContent: { paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'center' },
  optionText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  selected: { color: '#10130e' },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  input: {
    color: colors.text,
    backgroundColor: colors.panelRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    minHeight: 44,
    padding: 12,
    fontSize: 14
  }
});
