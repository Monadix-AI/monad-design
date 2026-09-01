import type { ClientConnection } from '../types';

import Ionicons from '@expo/vector-icons/Ionicons';
import { ClientApi } from '@monaddesign/client-rtk/client-api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '../components/Brand';
import { GlassControl } from '../components/GlassControl';
import { PairingScanner } from '../components/PairingScanner';
import { savedClientKey } from '../session';
import { styles } from '../styles';
import { errorMessage } from '../theme';

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
  const connect = useCallback(
    async (connection: ClientConnection = { origin, pairingCode }) => {
      setBusy(true);
      setError(null);
      try {
        const api = new ClientApi(connection);
        await api.pair();
        const health = await api.health();
        if (health.protocolVersion !== 1) throw new Error('This Client uses an unsupported protocol version.');
        await Promise.all([api.simulators(), AsyncStorage.setItem(savedClientKey, JSON.stringify(api.connection))]);
        onConnected(api);
      } catch (reason) {
        setError(errorMessage(reason));
      } finally {
        setBusy(false);
      }
    },
    [onConnected, origin, pairingCode]
  );
  useEffect(() => {
    if (!initial || attemptedSavedConnection.current) return;
    attemptedSavedConnection.current = true;
    void connect(initial);
  }, [connect, initial]);
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
      <View style={styles.setupHeader}>
        <Brand />
        <Text style={styles.localOnly}>LOCAL NETWORK · PAIRED</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.setupBody, compact && styles.setupBodyCompact]}>
        <View style={styles.setupCopy}>
          <Text style={styles.eyebrow}>CONNECT A CLIENT</Text>
          <Text style={[styles.setupTitle, compact && styles.setupTitleCompact]}>
            Your Mac is the runtime. iPad is the workspace.
          </Text>
          <Text style={styles.setupDescription}>
            Open Monad Design Client on the Mac that runs Xcode. Scan its pairing code, or enter the LAN address and
            six-digit session code.
          </Text>
          <View style={styles.steps}>
            <Text style={styles.step}>01 Same local network</Text>
            <Text style={styles.step}>02 Client stays open</Text>
            <Text style={styles.step}>03 Simulator is booted</Text>
          </View>
        </View>
        <View style={styles.setupCard}>
          <GlassControl
            contentStyle={styles.scanButtonContent}
            disabled={busy}
            onPress={() => void openScanner()}
            style={styles.scanButton}
            tone="accent"
          >
            <Ionicons
              color="#10130e"
              name="scan"
              size={22}
            />
            <View>
              <Text style={styles.scanButtonTitle}>Scan pairing code</Text>
              <Text style={styles.scanButtonHint}>Fastest · connects automatically</Text>
            </View>
          </GlassControl>
          <View style={styles.setupDivider}>
            <View style={styles.setupDividerLine} />
            <Text style={styles.setupDividerText}>OR ENTER MANUALLY</Text>
            <View style={styles.setupDividerLine} />
          </View>
          <View style={styles.setupCardHeading}>
            <View style={styles.signal}>
              <View style={styles.signalDot} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Specified Client</Text>
              <Text style={styles.cardHint}>Nothing is discovered or selected implicitly.</Text>
            </View>
          </View>
          <Text style={styles.inputLabel}>CLIENT ADDRESS</Text>
          <TextInput
            accessibilityLabel="Client address"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setOrigin}
            placeholder="http://192.168.1.20:41765"
            placeholderTextColor="#62666e"
            style={styles.input}
            value={origin}
          />
          <Text style={styles.inputLabel}>PAIRING CODE</Text>
          <TextInput
            accessibilityLabel="Pairing code"
            keyboardType="number-pad"
            onChangeText={(value) => setPairingCode(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor="#62666e"
            style={[styles.input, styles.codeInput]}
            value={pairingCode}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <GlassControl
            contentStyle={styles.connectButtonContent}
            disabled={!origin.trim() || pairingCode.length !== 6 || busy}
            onPress={() => void connect()}
            style={styles.connectButton}
            tone="accent"
          >
            {busy ? (
              <ActivityIndicator color="#10130e" />
            ) : (
              <Ionicons
                color="#10130e"
                name="link-outline"
                size={20}
              />
            )}
            <Text style={styles.connectText}>{busy ? 'Connecting…' : 'Connect'}</Text>
          </GlassControl>
          <Text style={styles.securityNote}>
            Saved pairing reconnects while the Client IP is unchanged. Simulator control stays on your LAN.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
