import { useColorScheme } from 'react-native';

import { darkColors, lightColors } from './theme-colors';

const darkWorkspaceColors = {
  ...darkColors,
  background: '#131519',
  panel: '#23262c',
  panelRaised: '#2c3038',
  text: '#e7e9ed',
  muted: '#a6adb9',
  accentText: darkColors.blue,
  accent: darkColors.blue
};
const lightWorkspaceColors = { ...lightColors, accentText: lightColors.blue, accent: lightColors.blue };

export function useWorkspaceColors() {
  return useColorScheme() === 'dark' ? darkWorkspaceColors : lightWorkspaceColors;
}
