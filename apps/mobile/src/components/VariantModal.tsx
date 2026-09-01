import type { SimulatorVariantId } from '@monaddesign/simulator';

import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@monaddesign/client-rtk/endpoint-helpers';
import {
  useLaunchSimulatorAppMutation,
  useLaunchSimulatorVariantMutation,
  useLazyCaptureSimulatorScreenshotQuery
} from '@monaddesign/client-rtk/endpoints';
import {
  canvasOffsetForZoom,
  canvasScaleStep,
  clampCanvasOffset,
  maximumCanvasScale,
  minimumCanvasScale,
  simulatorVariantIdsForCount,
  simulatorVariantLabels
} from '@monaddesign/simulator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassControl } from './GlassControl';

const defaultVariants = simulatorVariantIdsForCount(3);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const touchPoint = (touch: { locationX: number; locationY: number }) => ({
  x: touch.locationX,
  y: touch.locationY
});
const touchDistance = (first: { locationX: number; locationY: number }, second: typeof first) =>
  Math.hypot(second.locationX - first.locationX, second.locationY - first.locationY);
const touchMidpoint = (first: { locationX: number; locationY: number }, second: typeof first) => ({
  x: (first.locationX + second.locationX) / 2,
  y: (first.locationY + second.locationY) / 2
});

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
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasViewport, setCanvasViewport] = useState<{ width: number; height: number } | null>(null);
  const capturedKey = useRef<string | null>(null);
  const canvasScaleRef = useRef(canvasScale);
  const canvasOffsetRef = useRef(canvasOffset);
  const canvasGesture = useRef<
    | { mode: 'pan'; start: { x: number; y: number }; offset: { x: number; y: number } }
    | {
        mode: 'pinch';
        distance: number;
        midpoint: { x: number; y: number };
        offset: { x: number; y: number };
        scale: number;
      }
    | null
  >(null);
  canvasScaleRef.current = canvasScale;
  canvasOffsetRef.current = canvasOffset;
  const updateCanvasOffset = useCallback(
    (offset: { x: number; y: number }, scale: number) => {
      const next = canvasViewport
        ? clampCanvasOffset(offset, canvasViewport, {
            width: canvasViewport.width * scale,
            height: canvasViewport.height * scale
          })
        : offset;
      canvasOffsetRef.current = next;
      setCanvasOffset(next);
    },
    [canvasViewport]
  );
  const changeCanvasScale = useCallback(
    (requestedScale: number) => {
      const nextScale = Math.min(maximumCanvasScale, Math.max(minimumCanvasScale, requestedScale));
      canvasScaleRef.current = nextScale;
      setCanvasScale(nextScale);
      updateCanvasOffset(canvasOffsetRef.current, nextScale);
    },
    [updateCanvasOffset]
  );
  const fitCanvas = useCallback(() => {
    canvasGesture.current = null;
    canvasScaleRef.current = 1;
    canvasOffsetRef.current = { x: 0, y: 0 };
    setCanvasScale(1);
    setCanvasOffset({ x: 0, y: 0 });
  }, []);
  const canvasResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (event, gesture) =>
          event.nativeEvent.touches.length >= 2 || Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
        onPanResponderGrant: (event) => {
          const [first, second] = event.nativeEvent.touches;
          if (first && second && canvasViewport) {
            canvasGesture.current = {
              mode: 'pinch',
              distance: Math.max(1, touchDistance(first, second)),
              midpoint: touchMidpoint(first, second),
              offset: canvasOffsetRef.current,
              scale: canvasScaleRef.current
            };
          } else if (first) {
            canvasGesture.current = {
              mode: 'pan',
              start: touchPoint(first),
              offset: canvasOffsetRef.current
            };
          }
        },
        onPanResponderMove: (event) => {
          const [first, second] = event.nativeEvent.touches;
          if (!first) return;
          if (second && canvasViewport) {
            if (canvasGesture.current?.mode !== 'pinch') {
              canvasGesture.current = {
                mode: 'pinch',
                distance: Math.max(1, touchDistance(first, second)),
                midpoint: touchMidpoint(first, second),
                offset: canvasOffsetRef.current,
                scale: canvasScaleRef.current
              };
              return;
            }
            const gesture = canvasGesture.current;
            const midpoint = touchMidpoint(first, second);
            const nextScale = Math.min(
              maximumCanvasScale,
              Math.max(minimumCanvasScale, gesture.scale * (touchDistance(first, second) / gesture.distance))
            );
            const anchored = canvasOffsetForZoom(
              gesture.offset,
              canvasViewport,
              gesture.midpoint,
              gesture.scale,
              nextScale
            );
            canvasScaleRef.current = nextScale;
            setCanvasScale(nextScale);
            updateCanvasOffset(
              {
                x: anchored.x + midpoint.x - gesture.midpoint.x,
                y: anchored.y + midpoint.y - gesture.midpoint.y
              },
              nextScale
            );
            return;
          }
          if (canvasGesture.current?.mode !== 'pan') {
            canvasGesture.current = {
              mode: 'pan',
              start: touchPoint(first),
              offset: canvasOffsetRef.current
            };
            return;
          }
          const gesture = canvasGesture.current;
          const point = touchPoint(first);
          updateCanvasOffset(
            {
              x: gesture.offset.x + point.x - gesture.start.x,
              y: gesture.offset.y + point.y - gesture.start.y
            },
            canvasScaleRef.current
          );
        },
        onPanResponderRelease: () => {
          canvasGesture.current = null;
        },
        onPanResponderTerminate: () => {
          canvasGesture.current = null;
        }
      }),
    [canvasViewport, updateCanvasOffset]
  );
  useEffect(() => {
    if (visible) fitCanvas();
  }, [fitCanvas, visible]);
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
                ? simulatorVariantLabels[working as SimulatorVariantId]
                : `Capture ${variants.length}`}
            </Text>
          </GlassControl>
        </View>
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setCanvasViewport((current) =>
              current?.width === width && current.height === height ? current : { width, height }
            );
          }}
          style={styles.gridViewport}
          {...canvasResponder.panHandlers}
        >
          <View
            style={[
              styles.grid,
              {
                transform: [{ translateX: canvasOffset.x }, { translateY: canvasOffset.y }, { scale: canvasScale }]
              }
            ]}
          >
            {variants.map((variant) => (
              <Pressable
                disabled={!captures[variant] || Boolean(working)}
                key={variant}
                onPress={() => setSelected(variant)}
                style={[styles.tile, selected === variant && styles.selected]}
              >
                <View style={styles.tileHeader}>
                  <Text style={styles.tileTitle}>{simulatorVariantLabels[variant]}</Text>
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
          <View style={styles.zoomControls}>
            <GlassControl
              accessibilityLabel="Zoom comparison out"
              contentStyle={styles.zoomButtonContent}
              disabled={canvasScale <= minimumCanvasScale}
              glassStyle="clear"
              onPress={() => changeCanvasScale(canvasScale - canvasScaleStep)}
              style={styles.zoomButton}
            >
              <Ionicons
                color="#eef0f4"
                name="remove"
                size={18}
              />
            </GlassControl>
            <Text style={styles.zoomValue}>{Math.round(canvasScale * 100)}%</Text>
            <GlassControl
              accessibilityLabel="Zoom comparison in"
              contentStyle={styles.zoomButtonContent}
              disabled={canvasScale >= maximumCanvasScale}
              glassStyle="clear"
              onPress={() => changeCanvasScale(canvasScale + canvasScaleStep)}
              style={styles.zoomButton}
            >
              <Ionicons
                color="#eef0f4"
                name="add"
                size={18}
              />
            </GlassControl>
            <GlassControl
              accessibilityLabel="Fit comparison to view"
              contentStyle={styles.zoomButtonContent}
              glassStyle="clear"
              onPress={fitCanvas}
              style={styles.zoomButton}
            >
              <Ionicons
                color="#eef0f4"
                name="scan-outline"
                size={17}
              />
            </GlassControl>
          </View>
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
  gridViewport: { flex: 1, overflow: 'hidden' },
  grid: {
    flex: 1,
    padding: 26,
    paddingTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  zoomControls: {
    position: 'absolute',
    left: 26,
    bottom: 14,
    height: 44,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(25, 27, 31, 0.94)'
  },
  zoomButton: { width: 38, height: 38, borderRadius: 8 },
  zoomButtonContent: { alignItems: 'center', justifyContent: 'center' },
  zoomValue: { width: 52, color: '#eef0f4', fontSize: 11, textAlign: 'center' },
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
