import type { ComponentProps, ReactNode } from 'react';

import { Button, Host, Image, RoundedRectangle, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  Animation,
  accessibilityAddTraits,
  accessibilityHidden,
  accessibilityLabel,
  animation,
  background,
  buttonStyle,
  clipShape,
  disabled,
  foregroundStyle,
  frame,
  glassEffect,
  offset,
  opacity,
  padding
} from '@expo/ui/swift-ui/modifiers';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, Text, type ViewProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useWorkspaceColors } from '../workspace-theme';
import { GlassControl, GlassSurface } from './GlassControl';

export type NativeToolItem = {
  label: string;
  symbol: NonNullable<ComponentProps<typeof Image>['systemName']>;
  disabled?: boolean;
  onPress: () => void;
};
export const hasNativeToolSelection = Platform.OS === 'ios';
const liquidGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

/** One native material and one moving selection, rather than six merging glass buttons. */
export function GlassToolGroup({
  items,
  selectedIndex,
  style,
  accessibilityLabel: label
}: ViewProps & {
  children?: ReactNode;
  items: NativeToolItem[];
  selectedIndex: number;
  tint?: string;
}) {
  const colors = useWorkspaceColors();
  const reduceMotion = useReducedMotion();
  if (Platform.OS !== 'ios')
    return (
      <GlassSurface
        accessibilityLabel={label}
        style={style}
      >
        {items.map((item, index) => (
          <GlassControl
            accessibilityLabel={item.label}
            accessibilityState={{ selected: index === selectedIndex }}
            disabled={item.disabled}
            key={item.label}
            onPress={item.onPress}
            tone={index === selectedIndex ? 'selected' : 'neutral'}
          >
            <Text>{item.label}</Text>
          </GlassControl>
        ))}
      </GlassSurface>
    );
  const height = items.length * 48 + 12;
  return (
    <Host style={[style, { width: 56, height }]}>
      <ZStack
        alignment="top"
        modifiers={[
          frame({ width: 56, height }),
          ...(liquidGlass
            ? [glassEffect({ glass: { variant: 'regular' }, shape: 'capsule' })]
            : [background(colors.control), clipShape('capsule')])
        ]}
      >
        <RoundedRectangle
          cornerRadius={22}
          modifiers={[
            foregroundStyle(colors.controlSelected),
            frame({ width: 44, height: 44 }),
            offset({ y: 8 + Math.max(0, selectedIndex) * 48 }),
            opacity(selectedIndex < 0 ? 0 : 1),
            accessibilityHidden(),
            ...(reduceMotion ? [] : [animation(Animation.spring({ duration: 0.28, bounce: 0 }), selectedIndex)])
          ]}
        />
        <VStack
          modifiers={[padding({ top: 6, bottom: 6 })]}
          spacing={0}
        >
          {items.map((item, index) => (
            <Button
              key={item.label}
              modifiers={[
                buttonStyle('plain'),
                disabled(Boolean(item.disabled)),
                accessibilityLabel(item.label),
                ...(index === selectedIndex ? [accessibilityAddTraits(['isSelected'])] : [])
              ]}
              onPress={item.onPress}
            >
              <Image
                modifiers={[
                  foregroundStyle(index === selectedIndex ? colors.blue : colors.text),
                  frame({ width: 44, height: 48 })
                ]}
                size={19}
                systemName={item.symbol}
              />
            </Button>
          ))}
        </VStack>
      </ZStack>
    </Host>
  );
}
