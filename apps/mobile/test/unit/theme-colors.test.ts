import { describe, expect, test } from 'bun:test';

import { darkColors, lightColors } from '../../src/theme-colors';

const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }) as number[];
  return (channels[0] as number) * 0.2126 + (channels[1] as number) * 0.7152 + (channels[2] as number) * 0.0722;
};
const contrast = (foreground: string, background: string) => {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

for (const [name, colors] of Object.entries({ light: lightColors, dark: darkColors })) {
  describe(`${name} theme readability`, () => {
    test('body, labels and placeholders remain readable on every standard surface', () => {
      for (const surface of [colors.background, colors.panel, colors.panelRaised, colors.input]) {
        for (const foreground of [colors.text, colors.muted, colors.secondaryText, colors.danger]) {
          expect(contrast(foreground, surface)).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
    test('primary button labels remain readable', () => {
      expect(contrast(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.onBlue, colors.blue)).toBeGreaterThanOrEqual(4.5);
    });
  });
}
