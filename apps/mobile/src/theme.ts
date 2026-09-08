import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './theme-colors';

export { errorMessage } from '@monaddesign/client-rtk/endpoint-helpers';

export { darkColors, lightColors, type ThemeColors } from './theme-colors';

export function useColors(): ThemeColors {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}

/** Cache each stylesheet per palette while subscribing to system appearance changes. */
export function createThemedStyles<T>(create: (colors: ThemeColors) => T, usePalette: () => ThemeColors = useColors) {
  const cache = new Map<ThemeColors, T>();
  return function useThemedStyles() {
    const colors = usePalette();
    let styles = cache.get(colors);
    if (!styles) {
      styles = create(colors);
      cache.set(colors, styles);
    }
    return styles;
  };
}
