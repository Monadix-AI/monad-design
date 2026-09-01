import type { ReactNode } from 'react';

import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle
} from 'react-native';

type GlassTone = 'neutral' | 'selected' | 'accent' | 'danger';

const nativeLiquidGlassAvailable = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

const tint: Record<GlassTone, string> = {
  neutral: 'rgba(31, 33, 39, 0.62)',
  selected: 'rgba(76, 80, 90, 0.72)',
  accent: 'rgba(168, 255, 120, 0.82)',
  danger: 'rgba(90, 35, 48, 0.68)'
};

type GlassControlProps = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  tone?: GlassTone;
  glassStyle?: 'clear' | 'regular';
  solid?: boolean;
};

export function GlassControl({
  children,
  style,
  contentStyle,
  tone = 'neutral',
  glassStyle = 'regular',
  solid = false,
  disabled,
  ...pressableProps
}: GlassControlProps) {
  const control = (
    <Pressable
      {...pressableProps}
      disabled={disabled}
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

  if (nativeLiquidGlassAvailable && !solid) {
    return (
      <GlassView
        glassEffectStyle={glassStyle}
        isInteractive={!disabled}
        key={disabled ? 'disabled' : 'interactive'}
        style={[styles.shell, style]}
        tintColor={tint[tone]}
      >
        {control}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        styles.shell,
        styles.fallback,
        tone === 'accent' && styles.fallbackAccent,
        tone === 'selected' && styles.fallbackSelected,
        tone === 'danger' && styles.fallbackDanger,
        style
      ]}
    >
      {control}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden'
  },
  content: {
    flex: 1
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  disabledContent: {
    opacity: 0.38
  },
  fallback: {
    backgroundColor: '#202228'
  },
  fallbackAccent: {
    backgroundColor: '#a8ff78'
  },
  fallbackSelected: {
    backgroundColor: '#34373e'
  },
  fallbackDanger: {
    backgroundColor: '#27171d'
  }
});
