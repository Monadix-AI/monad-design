import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from 'react-native';

import { styles } from '../styles';
import { colors } from '../theme';
import { GlassControl } from './GlassControl';

export function Action({
  icon,
  label,
  active,
  disabled,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <GlassControl
      accessibilityRole="button"
      contentStyle={styles.actionContent}
      disabled={disabled}
      onPress={onPress}
      style={styles.action}
      tone={active ? 'accent' : 'neutral'}
    >
      <Ionicons
        color={active ? '#10130e' : colors.text}
        name={icon}
        size={18}
      />
      <Text style={[styles.actionText, active && styles.actionTextActive]}>{label}</Text>
    </GlassControl>
  );
}

export function ModeButton({
  label,
  active,
  disabled,
  onPress
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <GlassControl
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      contentStyle={styles.modeButtonContent}
      disabled={disabled}
      glassStyle="clear"
      onPress={onPress}
      style={styles.modeButton}
      tone={active ? 'selected' : 'neutral'}
    >
      <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</Text>
    </GlassControl>
  );
}

export function CanvasControl({
  icon,
  label,
  disabled,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <GlassControl
      accessibilityLabel={label}
      accessibilityRole="button"
      contentStyle={styles.canvasControlContent}
      disabled={disabled}
      glassStyle="clear"
      onPress={onPress}
      style={styles.canvasControl}
    >
      <Ionicons
        color={colors.text}
        name={icon}
        size={18}
      />
      <Text style={styles.canvasControlText}>{label}</Text>
    </GlassControl>
  );
}
