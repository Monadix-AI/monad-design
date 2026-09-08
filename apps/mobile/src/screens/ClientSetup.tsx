import type { ClientConnection } from '../types';

import Ionicons from '@expo/vector-icons/Ionicons';
import { ClientApi } from '@monaddesign/client-rtk/client-api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassControl } from '../components/GlassControl';
import { PairingScanner } from '../components/PairingScanner';
import { savedClientKey } from '../session';
import { styles } from '../styles';
import { colors, errorMessage } from '../theme';

const connectionTimeoutMilliseconds = 30_000;

interface ConnectionAttempt {
  api: ClientApi<ClientConnection>;
  controller: AbortController;
  timeout: ReturnType<typeof setTimeout>;
  timedOut: boolean;
}

export function ClientSetup({
  initial,
  onConnected
}: {
  initial: ClientConnection | null;
  onConnected: (api: ClientApi<ClientConnection>) => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const [origin, setOrigin] = useState(initial?.origin ?? '');
  const [pairingCode, setPairingCode] = useState(initial?.pairingCode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const attemptedSavedConnection = useRef(false);
  const activeAttempt = useRef<ConnectionAttempt | null>(null);
  const cancelConnection = useCallback(() => {
    const attempt = activeAttempt.current;
    if (!attempt) return;
    activeAttempt.current = null;
    clearTimeout(attempt.timeout);
    attempt.controller.abort();
    attempt.api.dispose();
    setBusy(false);
    setError(null);
  }, []);
  const connect = useCallback(
    async (connection: ClientConnection = { origin, pairingCode }) => {
      if (activeAttempt.current) return;
      setBusy(true);
      setError(null);
      const controller = new AbortController();
      const api = new ClientApi(connection, { signal: controller.signal });
      const attempt: ConnectionAttempt = {
        api,
        controller,
        timedOut: false,
        timeout: setTimeout(() => {
          attempt.timedOut = true;
          controller.abort();
        }, connectionTimeoutMilliseconds)
      };
      activeAttempt.current = attempt;
      try {
        await api.pair();
        const health = await api.health();
        if (health.protocolVersion !== 1) throw new Error('This Client uses an unsupported protocol version.');
        await Promise.all([api.simulators(), AsyncStorage.setItem(savedClientKey, JSON.stringify(api.connection))]);
        if (activeAttempt.current !== attempt) return;
        onConnected(api);
      } catch (reason) {
        if (activeAttempt.current !== attempt) return;
        attempt.api.dispose();
        setError(attempt.timedOut ? 'Connection timed out after 30 seconds.' : errorMessage(reason));
      } finally {
        clearTimeout(attempt.timeout);
        if (activeAttempt.current === attempt) {
          activeAttempt.current = null;
          setBusy(false);
        }
      }
    },
    [onConnected, origin, pairingCode]
  );
  useEffect(() => {
    if (!initial || attemptedSavedConnection.current) return;
    attemptedSavedConnection.current = true;
    void connect(initial);
  }, [connect, initial]);
  useEffect(
    () => () => {
      const attempt = activeAttempt.current;
      if (!attempt) return;
      activeAttempt.current = null;
      clearTimeout(attempt.timeout);
      attempt.controller.abort();
      attempt.api.dispose();
    },
    []
  );
  const openScanner = async () => {
    setError(null);
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) {
      setError('Camera access is required to scan. You can still enter the address and code manually.');
      return;
    }
    setScannerVisible(true);
  };
  const useScannedConnection = (connection: ClientConnection) => {
    setOrigin(connection.origin);
    setPairingCode(connection.pairingCode);
    setScannerVisible(false);
    void connect(connection);
  };
  return (
    <SafeAreaView style={styles.setupRoot}>
      <PairingScanner
        onClose={() => setScannerVisible(false)}
        onScanned={useScannedConnection}
        visible={scannerVisible}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={local.keyboard}
      >
        <ScrollView
          contentContainerStyle={[local.body, compact && local.bodyCompact]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[local.intro, compact && local.introCompact]}>
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
              style={local.artwork}
            >
              <View style={[local.frame, local.frameOuter]} />
              <View style={[local.frame, local.frameMiddle]} />
              <View style={local.scanTile}>
                <Ionicons
                  color={colors.accent}
                  name="scan-outline"
                  size={76}
                />
              </View>
              <View style={local.linkBadge}>
                <Ionicons
                  color="#10130e"
                  name="link"
                  size={22}
                />
              </View>
            </View>
            <Text style={[local.title, compact && local.titleCompact]}>Connect your Mac.</Text>
          </View>
          <View style={local.form}>
            <GlassControl
              accessibilityLabel="Scan pairing code"
              contentStyle={local.scanContent}
              disabled={busy}
              onPress={() => void openScanner()}
              style={local.scanButton}
              tone="accent"
            >
              <Ionicons
                color="#10130e"
                name="scan"
                size={24}
              />
              <Text style={local.scanTitle}>Scan to connect</Text>
              <Ionicons
                color="#10130e"
                name="arrow-forward"
                size={20}
              />
            </GlassControl>
            <View style={local.divider}>
              <View style={local.dividerLine} />
              <Text style={local.dividerText}>or</Text>
              <View style={local.dividerLine} />
            </View>
            <Text style={local.label}>Mac address</Text>
            <TextInput
              accessibilityLabel="Client address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              keyboardType="url"
              onChangeText={setOrigin}
              placeholder="http://192.168.1.20:41765"
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              style={local.input}
              value={origin}
            />
            <Text style={local.label}>Pairing code</Text>
            <TextInput
              accessibilityLabel="Pairing code"
              editable={!busy}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setPairingCode(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              style={[local.input, local.codeInput]}
              value={pairingCode}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <GlassControl
              accessibilityLabel={busy ? 'Cancel connection' : 'Connect'}
              contentStyle={local.connectContent}
              disabled={!busy && (!origin.trim() || pairingCode.length !== 6)}
              onPress={busy ? cancelConnection : () => void connect()}
              style={local.connectButton}
              tone="neutral"
            >
              {busy ? (
                <Ionicons
                  color={colors.text}
                  name="close-circle-outline"
                  size={20}
                />
              ) : (
                <Ionicons
                  color={colors.text}
                  name="link-outline"
                  size={20}
                />
              )}
              <Text style={local.connectText}>{busy ? 'Cancel connection' : 'Connect'}</Text>
            </GlassControl>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  keyboard: { flex: 1 },
  body: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 80 },
  bodyCompact: { flexDirection: 'column', paddingHorizontal: 24, paddingVertical: 32, gap: 36 },
  intro: { alignItems: 'center', width: 360, gap: 32 },
  introCompact: { width: '100%', maxWidth: 420, gap: 20 },
  artwork: { width: 240, height: 210, alignItems: 'center', justifyContent: 'center' },
  frame: { position: 'absolute', borderWidth: 1, borderRadius: 40 },
  frameOuter: { width: 196, height: 196, borderColor: '#23292a', transform: [{ rotate: '-16deg' }] },
  frameMiddle: { width: 166, height: 166, borderColor: '#3b4935', transform: [{ rotate: '12deg' }] },
  scanTile: {
    width: 136,
    height: 136,
    borderRadius: 32,
    backgroundColor: colors.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 24
  },
  linkBadge: {
    position: 'absolute',
    right: 36,
    bottom: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-12deg' }]
  },
  title: {
    color: colors.text,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1.2,
    textAlign: 'center'
  },
  titleCompact: { fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  form: { width: '100%', maxWidth: 380 },
  scanButton: { borderRadius: 16, minHeight: 64 },
  scanContent: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 18 },
  scanTitle: { flex: 1, color: '#10130e', fontSize: 17, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 24 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontSize: 13 },
  label: { color: colors.muted, fontSize: 13, fontWeight: '500', marginBottom: 10 },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panel,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 20
  },
  codeInput: { fontSize: 24, fontWeight: '600', letterSpacing: 8, fontVariant: ['tabular-nums'] },
  connectButton: { minHeight: 56, borderRadius: 14, marginTop: 4 },
  connectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20
  },
  connectText: { color: colors.text, fontSize: 16, fontWeight: '600' }
});
