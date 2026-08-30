import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '../src/session';

export default function RootLayout() {
  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar style="light" />
      <SessionProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="simulators" />
          <Stack.Screen
            name="workspace"
            options={{ gestureEnabled: false }}
          />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    userSelect: 'none'
  } as TextStyle & ViewStyle
});
