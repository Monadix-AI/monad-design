import type { ClientConnection } from '../types';

import Ionicons from '@expo/vector-icons/Ionicons';
import { parsePairingPayload } from '@monaddesign/pairing';
import { type BarcodeScanningResult, CameraView } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from '../styles';
import { colors } from '../theme';
import { GlassControl } from './GlassControl';

export function PairingScanner({
  visible,
  onClose,
  onScanned
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (connection: ClientConnection) => void;
}) {
  const [locked, setLocked] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLocked(false);
    setScanError(null);
  }, [visible]);

  const handleBarcode = ({ data }: BarcodeScanningResult) => {
    if (locked) return;
    setLocked(true);
    const connection = parsePairingPayload(data);
    if (!connection) {
      setScanError('This is not a valid Monad Design pairing code.');
      return;
    }
    onScanned(connection);
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      supportedOrientations={['landscape-left', 'landscape-right']}
      visible={visible}
    >
      <View style={styles.scannerRoot}>
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={locked ? undefined : handleBarcode}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.scannerShade} />
        <SafeAreaView style={styles.scannerContent}>
          <View style={styles.scannerHeader}>
            <View>
              <Text style={styles.scannerEyebrow}>PAIR A CLIENT</Text>
              <Text style={styles.scannerTitle}>Scan the code on your Mac</Text>
            </View>
            <GlassControl
              accessibilityLabel="Close scanner"
              accessibilityRole="button"
              contentStyle={styles.scannerCloseContent}
              glassStyle="clear"
              onPress={onClose}
              style={styles.scannerClose}
            >
              <Ionicons
                color={colors.text}
                name="close"
                size={24}
              />
            </GlassControl>
          </View>
          <View
            pointerEvents="none"
            style={styles.scanFrame}
          >
            <View style={[styles.scanCorner, styles.scanCornerTopLeft]} />
            <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
          </View>
          <View style={styles.scannerFooter}>
            {scanError ? (
              <>
                <Text style={styles.scannerError}>{scanError}</Text>
                <GlassControl
                  contentStyle={styles.scanAgainContent}
                  onPress={() => {
                    setScanError(null);
                    setLocked(false);
                  }}
                  style={styles.scanAgainButton}
                >
                  <Ionicons
                    color={colors.text}
                    name="scan"
                    size={18}
                  />
                  <Text style={styles.scanAgainText}>Scan again</Text>
                </GlassControl>
              </>
            ) : (
              <Text style={styles.scannerHint}>Keep both devices on the same local network.</Text>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
