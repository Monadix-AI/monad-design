import { Button, Host } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  tint
} from '@expo/ui/swift-ui/modifiers';
import Ionicons from '@expo/vector-icons/Ionicons';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, Text } from 'react-native';

import { useStyles } from '../styles';
import { useColors } from '../theme';
import { GlassControl } from './GlassControl';

export function BackButton({
  disabled = false,
  label,
  onPress
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  if (Platform.OS === 'ios')
    return (
      <Host matchContents>
        <Button
          label={label}
          modifiers={[
            buttonStyle(isGlassEffectAPIAvailable() && isLiquidGlassAvailable() ? 'glass' : 'bordered'),
            controlSize('large'),
            tint(colors.text),
            accessibilityLabel(`Back to ${label}`),
            disabledModifier(disabled)
          ]}
          onPress={onPress}
          systemImage="chevron.left"
        />
      </Host>
    );
  return (
    <GlassControl
      accessibilityLabel={`Back to ${label}`}
      accessibilityRole="button"
      contentStyle={styles.backButtonContent}
      disabled={disabled}
      glassStyle="clear"
      onPress={onPress}
      style={styles.backButton}
    >
      <Ionicons
        color={colors.muted}
        name="arrow-back"
        size={20}
      />
      <Text style={styles.backButtonLabel}>{label}</Text>
    </GlassControl>
  );
}

export function HeaderActionButton({
  disabled,
  icon,
  label,
  onPress
}: {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  if (Platform.OS === 'ios')
    return (
      <Host matchContents>
        <Button
          label={label}
          modifiers={[
            buttonStyle(isGlassEffectAPIAvailable() && isLiquidGlassAvailable() ? 'glass' : 'bordered'),
            controlSize('large'),
            tint(colors.text),
            accessibilityLabel(label),
            disabledModifier(disabled)
          ]}
          onPress={onPress}
          systemImage="arrow.clockwise"
        />
      </Host>
    );
  return (
    <GlassControl
      accessibilityLabel={label}
      accessibilityRole="button"
      contentStyle={styles.backButtonContent}
      disabled={disabled}
      glassStyle="clear"
      onPress={onPress}
      style={styles.backButton}
    >
      <Ionicons
        color={colors.muted}
        name={icon}
        size={20}
      />
      <Text style={styles.backButtonLabel}>{label}</Text>
    </GlassControl>
  );
}
