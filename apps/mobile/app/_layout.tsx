import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, type TextStyle, useColorScheme, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EdgeAtmosphere } from '../src/components/EdgeAtmosphere';
import { SessionProvider } from '../src/session';
import { createThemedStyles } from '../src/theme';

// Native Stack paints its container from the theme, independently of contentStyle.
const lightNavigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };
const darkNavigationTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: 'transparent' } };

export default function RootLayout() {
  const styles = useStyles();
  const navigationTheme = useColorScheme() === 'dark' ? darkNavigationTheme : lightNavigationTheme;
  const navigation = (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationTypeForReplace: 'pop',
        contentStyle: { backgroundColor: 'transparent' }
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="simulators" />
      <Stack.Screen
        name="workspace"
        options={{ gestureEnabled: false }}
      />
    </Stack>
  );
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        {/* Pairing changes the provider tree; keep the shared animation outside it. */}
        <EdgeAtmosphere>
          <SessionProvider>
            <ThemeProvider value={navigationTheme}>{navigation}</ThemeProvider>
          </SessionProvider>
        </EdgeAtmosphere>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      userSelect: 'none'
    } as TextStyle & ViewStyle
  })
);
