import Ionicons from '@expo/vector-icons/Ionicons';
import { MousePointer2, SquareDashedMousePointer } from 'lucide-react-native';
import { Text } from 'react-native';

import { useStyles } from '../styles';
import { useColors } from '../theme';
import { GlassControl } from './GlassControl';
import { hasNativeToolSelection } from './GlassToolGroup';
import { WorkspacePanelControl } from './WorkspacePanelControl';

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
  const colors = useColors();
  const styles = useStyles();
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
        color={active ? colors.onAccent : colors.text}
        name={icon}
        size={20}
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
  const styles = useStyles();
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

export function WorkspaceToolButton({
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
  const colors = useColors();
  const styles = useStyles();
  return (
    <WorkspacePanelControl
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      contentStyle={styles.workspaceToolButtonContent}
      disabled={disabled}
      glassStyle="clear"
      onPress={onPress}
      style={styles.workspaceToolButton}
      tone={active && !hasNativeToolSelection ? 'selected' : 'neutral'}
    >
      {icon === 'navigate-outline' ? (
        <MousePointer2
          color={active ? colors.blue : colors.muted}
          size={20}
        />
      ) : (
        <SquareDashedMousePointer
          color={active ? colors.blue : colors.muted}
          size={20}
        />
      )}
    </WorkspacePanelControl>
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
  const colors = useColors();
  const styles = useStyles();
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
        size={20}
      />
      <Text style={styles.canvasControlText}>{label}</Text>
    </GlassControl>
  );
}
