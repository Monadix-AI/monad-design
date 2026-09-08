import type { ComponentProps, ReactNode } from 'react';

import { Button, Host, Image } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  foregroundStyle,
  frame,
  disabled as nativeDisabled,
  tint
} from '@expo/ui/swift-ui/modifiers';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { createContext, useContext } from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle
} from 'react-native';

import { createThemedStyles, type ThemeColors, useColors } from '../theme';

type GlassTone = 'neutral' | 'selected' | 'accent' | 'danger';

const nativeLiquidGlassAvailable = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
const GlassGroupContext = createContext(false);

/** A non-pressable material for tool groups, menus and editable fields. */
export function GlassSurface({
  children,
  style,
  interactive = false,
  ...props
}: ViewProps & { interactive?: boolean }) {
  const colors = useColors();
  const Surface = nativeLiquidGlassAvailable ? GlassView : View;
  return (
    <Surface
      {...props}
      {...(nativeLiquidGlassAvailable ? { glassEffectStyle: 'regular' as const, isInteractive: interactive } : {})}
      style={[!nativeLiquidGlassAvailable && { backgroundColor: colors.control }, style, { overflow: 'hidden' }]}
    >
      <GlassGroupContext.Provider value={true}>{children}</GlassGroupContext.Provider>
    </Surface>
  );
}

type GlassControlProps = Omit<PressableProps, 'children' | 'style' | 'onPress'> & {
  children: ReactNode;
  systemImage?: ComponentProps<typeof Image>['systemName'];
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  tone?: GlassTone;
  glassStyle?: 'clear' | 'regular';
  solid?: boolean;
  palette?: ThemeColors;
};

export function GlassControl({
  children,
  systemImage,
  style,
  contentStyle,
  tone = 'neutral',
  glassStyle = 'regular',
  solid = false,
  palette,
  disabled,
  onPress,
  ...pressableProps
}: GlassControlProps) {
  const styles = useStyles();
  const themeColors = useColors();
  const colors = palette ?? themeColors;
  const grouped = useContext(GlassGroupContext);
  if (systemImage && Platform.OS === 'ios') {
    return (
      <Host
        matchContents
        style={[style, { minWidth: 44, minHeight: 44 }]}
      >
        <Button
          modifiers={[
            buttonStyle(grouped ? 'plain' : nativeLiquidGlassAvailable && !solid ? 'glass' : 'bordered'),
            nativeDisabled(Boolean(disabled)),
            accessibilityLabel(pressableProps.accessibilityLabel ?? ''),
            tint(tone === 'danger' ? colors.danger : colors.text)
          ]}
          onPress={onPress}
        >
          <Image
            modifiers={[foregroundStyle(colors.text), frame({ width: grouped ? 44 : 28, height: grouped ? 44 : 28 })]}
            size={19}
            systemName={systemImage}
          />
        </Button>
      </Host>
    );
  }
  const control = (
    <Pressable
      accessibilityRole="button"
      {...pressableProps}
      accessibilityState={{ ...pressableProps.accessibilityState, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.content,
        contentStyle,
        pressed && styles.pressed,
        disabled && styles.disabledContent
      ]}
    >
      {children}
    </Pressable>
  );

  if (nativeLiquidGlassAvailable && !solid && !grouped) {
    return (
      <GlassView
        glassEffectStyle={glassStyle}
        isInteractive
        style={[styles.shell, style]}
        tintColor={tone === 'accent' ? colors.accent : tone === 'danger' ? colors.dangerSurface : undefined}
      >
        {control}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        styles.shell,
        { backgroundColor: grouped ? 'transparent' : colors.control },
        tone === 'accent' && { backgroundColor: colors.accent },
        tone === 'selected' && { backgroundColor: colors.glassSelected },
        tone === 'danger' && { backgroundColor: colors.dangerSurface },
        style
      ]}
    >
      {control}
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    shell: {
      overflow: 'hidden',
      minWidth: 44,
      minHeight: 44,
      borderCurve: 'continuous'
    },
    content: {
      flex: 1
    },
    pressed: {
      backgroundColor: colors.pressed
    },
    disabledContent: {
      opacity: 0.38
    }
  })
);
