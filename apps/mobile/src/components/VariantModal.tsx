import type { SimulatorVariantId } from '../types';

import { Ionicons } from '@expo/vector-icons';
import {
  useLaunchSimulatorAppMutation,
  useLaunchSimulatorVariantMutation,
  useLazyCaptureSimulatorScreenshotQuery
} from '@monaddesign/client-rtk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassControl } from './GlassControl';

const defaultVariants: SimulatorVariantId[] = ['original', 'v1', 'v2', 'v3'];
const labels: Record<SimulatorVariantId, string> = {
  original: 'Original',
  v1: 'Variant 1',
  v2: 'Variant 2',
  v3: 'Variant 3',
  v4: 'Variant 4',
  v5: 'Variant 5'
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : fallback;

export function VariantModal({
  bundleIdentifier,
  visible,
  variants = defaultVariants,
  autoCaptureKey,
  confirmSelection,
  onClose,
  onOpened,
  onRestored
}: {
  bundleIdentifier: string;
  visible: boolean;
  variants?: SimulatorVariantId[];
  autoCaptureKey?: string;
  confirmSelection?: (variant: SimulatorVariantId) => Promise<void>;
  onClose: () => void;
  onOpened: (variant: SimulatorVariantId) => void;
  onRestored: () => void;
}) {
  const [launchVariant] = useLaunchSimulatorVariantMutation();
  const [launchApp] = useLaunchSimulatorAppMutation();
  const [captureScreenshot] = useLazyCaptureSimulatorScreenshotQuery();
  const [captures, setCaptures] = useState<Partial<Record<SimulatorVariantId, string>>>({});
  const [selected, setSelected] = useState<SimulatorVariantId | null>(null);
  const [working, setWorking] = useState<SimulatorVariantId | 'open' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const capturedKey = useRef<string | null>(null);
  const capture = useCallback(async () => {
    setCaptures({});
    setSelected(null);
    setError(null);
    let previewLaunchStarted = false;
    try {
      for (const variant of variants) {
        setWorking(variant);
        await launchVariant({ variant }).unwrap();
        previewLaunchStarted = true;
        await wait(900);
        const { image } = await captureScreenshot().unwrap();
        setCaptures((items) => ({ ...items, [variant]: image }));
      }
    } catch (reason) {
      setError(errorMessage(reason, 'Capture failed.'));
    } finally {
      if (previewLaunchStarted) {
        try {
          await launchApp().unwrap();
        } catch (reason) {
          setError((current) => {
            const message = `Could not restart the app normally: ${errorMessage(reason, 'Unknown error.')}`;
            return current ? `${current} ${message}` : message;
          });
        }
      }
      setWorking(null);
    }
  }, [captureScreenshot, launchApp, launchVariant, variants]);
  useEffect(() => {
    if (!visible || !autoCaptureKey || capturedKey.current === autoCaptureKey) return;
    capturedKey.current = autoCaptureKey;
    void capture();
  }, [autoCaptureKey, capture, visible]);
  const restore = async () => {
    setWorking('restore');
    try {
      await launchApp().unwrap();
      setCaptures({});
      setSelected(null);
      onRestored();
      onClose();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not restore the original.'));
    } finally {
      setWorking(null);
    }
  };
  const open = async () => {
    if (!selected) return;
    setWorking('open');
    try {
      if (selected === 'original') {
        await launchApp().unwrap();
        onRestored();
      } else {
        await launchVariant({ variant: selected }).unwrap();
        onOpened(selected);
      }
      await confirmSelection?.(selected);
      onClose();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not open the variant.'));
    } finally {
      setWorking(null);
    }
  };
  return (
    <Modal
      animationType="slide"
      onRequestClose={() => void restore()}
      supportedOrientations={['landscape-left', 'landscape-right']}
      visible={visible}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Compare native variants</Text>
            <Text style={styles.boundary}>
              {working
                ? 'Capturing runtime evidence…'
                : selected
                  ? 'Selected · not applied to source'
                  : 'Preview evidence only'}
            </Text>
          </View>
          <GlassControl
            accessibilityLabel="Close variant comparison"
            contentStyle={styles.closeContent}
            glassStyle="clear"
            onPress={() => void restore()}
            style={styles.close}
          >
            <Ionicons
              color="#eef0f4"
              name="close"
              size={20}
            />
          </GlassControl>
        </View>
        <View style={styles.captureBar}>
          <View style={styles.field}>
            <Text style={styles.label}>TARGET BUNDLE IDENTIFIER</Text>
            <Text style={styles.targetBundle}>{bundleIdentifier}</Text>
          </View>
          <Text style={styles.help}>Requires the Debug-only Monad Design variant hook.</Text>
          <GlassControl
            contentStyle={styles.primaryContent}
            disabled={Boolean(working)}
            onPress={() => void capture()}
            style={styles.primary}
            tone="accent"
          >
            {working && working !== 'open' && working !== 'restore' ? (
              <ActivityIndicator color="#10130e" />
            ) : (
              <Ionicons
                color="#10130e"
                name="camera-outline"
                size={19}
              />
            )}
            <Text style={styles.primaryText}>
              {working && variants.includes(working as SimulatorVariantId)
                ? labels[working as SimulatorVariantId]
                : `Capture ${variants.length}`}
            </Text>
          </GlassControl>
        </View>
        <View style={styles.grid}>
          {variants.map((variant) => (
            <Pressable
              disabled={!captures[variant] || Boolean(working)}
              key={variant}
              onPress={() => setSelected(variant)}
              style={[styles.tile, selected === variant && styles.selected]}
            >
              <View style={styles.tileHeader}>
                <Text style={styles.tileTitle}>{labels[variant]}</Text>
                <Text style={styles.tileState}>
                  {working === variant
                    ? 'CAPTURING'
                    : captures[variant]
                      ? selected === variant
                        ? 'SELECTED'
                        : 'CAPTURED'
                      : 'WAITING'}
                </Text>
              </View>
              {captures[variant] ? (
                <Image
                  resizeMode="contain"
                  source={{ uri: captures[variant] }}
                  style={styles.image}
                />
              ) : (
                <View style={styles.placeholder}>{working === variant && <ActivityIndicator color="#a8ff78" />}</View>
              )}
            </Pressable>
          ))}
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.footer}>
          <GlassControl
            contentStyle={styles.secondaryContent}
            disabled={Boolean(working)}
            onPress={() => void restore()}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Discard & restore</Text>
          </GlassControl>
          <GlassControl
            contentStyle={styles.primaryContent}
            disabled={!selected || Boolean(working)}
            onPress={() => void open()}
            style={styles.primary}
            tone="accent"
          >
            {working === 'open' && <ActivityIndicator color="#10130e" />}
            <Text style={styles.primaryText}>{confirmSelection ? 'Confirm selection' : 'Open selected live'}</Text>
          </GlassControl>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0e11', paddingTop: 44 },
  header: {
    height: 76,
    paddingHorizontal: 26,
    borderBottomWidth: 1,
    borderBottomColor: '#292b31',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: { color: '#eef0f4', fontSize: 22, fontWeight: '700' },
  boundary: { color: '#a8ff78', fontSize: 11, marginTop: 4 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  closeContent: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  captureBar: {
    minHeight: 94,
    padding: 18,
    paddingHorizontal: 26,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14
  },
  field: { width: 280, gap: 6 },
  label: {
    color: '#8d929c',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1
  },
  targetBundle: {
    height: 44,
    borderWidth: 1,
    borderColor: '#363940',
    backgroundColor: '#15171b',
    borderRadius: 10,
    color: '#eef0f4',
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontFamily: 'Courier'
  },
  help: { flex: 1, color: '#777b84', fontSize: 12, marginBottom: 13 },
  primary: {
    minHeight: 44,
    borderRadius: 10
  },
  primaryContent: {
    paddingHorizontal: 17,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryText: { color: '#10130e', fontWeight: '800' },
  grid: {
    flex: 1,
    padding: 26,
    paddingTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  tile: {
    width: '48.9%',
    height: '47%',
    minHeight: 220,
    borderWidth: 1,
    borderColor: '#303238',
    borderRadius: 14,
    backgroundColor: '#15171b',
    overflow: 'hidden'
  },
  selected: { borderColor: '#a8ff78', borderWidth: 2 },
  tileHeader: {
    height: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  tileTitle: { color: '#eef0f4', fontWeight: '700' },
  tileState: { color: '#8d929c', fontSize: 9, letterSpacing: 1 },
  image: { flex: 1, backgroundColor: '#090a0c' },
  placeholder: {
    flex: 1,
    backgroundColor: '#111216',
    alignItems: 'center',
    justifyContent: 'center'
  },
  error: { color: '#ff7388', marginHorizontal: 26, marginBottom: 8 },
  footer: {
    height: 76,
    paddingHorizontal: 26,
    borderTopWidth: 1,
    borderTopColor: '#292b31',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10
  },
  secondary: {
    height: 44,
    borderRadius: 10
  },
  secondaryContent: {
    paddingHorizontal: 17,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryText: { color: '#eef0f4', fontWeight: '600' }
});
