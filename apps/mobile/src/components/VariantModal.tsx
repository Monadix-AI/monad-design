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

import { createThemedStyles, useColors } from '../theme';
import { applyVariantReviewAction, variantComparisonLayout } from '../variant-review';
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
  onBusyChange,
  embedded = false,
  locked = false,
  selectedVariant,
  onSelectionChange,
  bundleIdentifier,
  visible,
  variants = defaultVariants,
  autoCaptureKey,
  confirmSelection,
  onClose,
  onOpened,
  onRestored
}: {
  onBusyChange?: (busy: boolean) => void;
  embedded?: boolean;
  locked?: boolean;
  selectedVariant?: SimulatorVariantId | null;
  onSelectionChange?: (variant: SimulatorVariantId) => void;
  bundleIdentifier: string;
  visible: boolean;
  variants?: SimulatorVariantId[];
  autoCaptureKey?: string;
  confirmSelection?: (variant: SimulatorVariantId) => Promise<void>;
  onClose: () => void;
  onOpened: (variant: SimulatorVariantId) => void;
  onRestored: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [launchVariant] = useLaunchSimulatorVariantMutation();
  const [launchApp] = useLaunchSimulatorAppMutation();
  const [captureScreenshot] = useLazyCaptureSimulatorScreenshotQuery();
  const [captures, setCaptures] = useState<Partial<Record<SimulatorVariantId, string>>>({});
  const [selected, setSelected] = useState<SimulatorVariantId | null>(null);
  useEffect(() => {
    if (selectedVariant !== undefined) setSelected(selectedVariant);
  }, [selectedVariant]);
  const [working, setWorking] = useState<SimulatorVariantId | 'open' | 'restore' | null>(null);
  useEffect(() => {
    onBusyChange?.(working !== null);
  }, [working, onBusyChange]);
  const [error, setError] = useState<string | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasViewport, setCanvasViewport] = useState<{ width: number; height: number } | null>(null);
  const comparisonLayout = variantComparisonLayout(canvasViewport ?? { width: 800, height: 600 }, variants.length);
  const operationActive = useRef(false);
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
            width: comparisonLayout.width * scale,
            height: comparisonLayout.height * scale
          })
        : offset;
      canvasOffsetRef.current = next;
      setCanvasOffset(next);
    },
    [canvasViewport, comparisonLayout.width, comparisonLayout.height]
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
    const fittedScale = canvasViewport
      ? Math.max(
          minimumCanvasScale,
          Math.min(1, canvasViewport.width / comparisonLayout.width, canvasViewport.height / comparisonLayout.height)
        )
      : 1;
    canvasScaleRef.current = fittedScale;
    canvasOffsetRef.current = { x: 0, y: 0 };
    setCanvasScale(fittedScale);
    setCanvasOffset({ x: 0, y: 0 });
  }, [canvasViewport, comparisonLayout.width, comparisonLayout.height]);
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
    if (operationActive.current) return;
    operationActive.current = true;
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
          onRestored();
        } catch (reason) {
          setError((current) => {
            const message = `Could not restart the app normally: ${errorMessage(reason, 'Unknown error.')}`;
            return current ? `${current} ${message}` : message;
          });
        }
      }
      operationActive.current = false;
      setWorking(null);
    }
  }, [captureScreenshot, launchApp, launchVariant, variants, onRestored]);
  useEffect(() => {
    if (!visible || !autoCaptureKey || capturedKey.current === autoCaptureKey) return;
    capturedKey.current = autoCaptureKey;
    void capture();
  }, [autoCaptureKey, capture, visible]);
  const restore = async () => {
    if (operationActive.current) return;
    operationActive.current = true;
    setError(null);
    setWorking('restore');
    try {
      await applyVariantReviewAction({
        action: 'discard',
        variant: 'original',
        launchOriginal: () => launchApp().unwrap(),
        launchVariant: (variant) => launchVariant({ variant }).unwrap(),
        onPreview: onRestored,
        confirmSelection
      });
      setCaptures({});
      setSelected(null);
      onClose();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not restore the original.'));
    } finally {
      operationActive.current = false;
      setWorking(null);
    }
  };
  const open = async (accept: boolean) => {
    if (!selected || operationActive.current) return;
    operationActive.current = true;
    setError(null);
    setWorking('open');
    try {
      await applyVariantReviewAction({
        action: accept ? 'accept' : 'preview',
        variant: selected,
        launchOriginal: () => launchApp().unwrap(),
        launchVariant: (variant) => launchVariant({ variant }).unwrap(),
        onPreview: (variant) => (variant === 'original' ? onRestored() : onOpened(variant)),
        confirmSelection
      });
      onClose();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not open the variant.'));
    } finally {
      operationActive.current = false;
      setWorking(null);
    }
  };
  const content = (
    <View style={[styles.root, embedded && { paddingTop: 0 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Compare native variants</Text>
          <Text style={styles.boundary}>
            {working === 'open'
              ? 'Opening selected variant…'
              : working === 'restore'
                ? 'Restoring original…'
                : working
                  ? 'Capturing runtime evidence…'
                  : selected
                    ? 'Selected · not applied to source'
                    : 'Preview evidence only'}
          </Text>
        </View>
        <GlassControl
          accessibilityLabel="Close variant comparison"
          contentStyle={styles.closeContent}
          disabled={locked || Boolean(working)}
          glassStyle="clear"
          onPress={onClose}
          style={styles.close}
        >
          <Ionicons
            color={colors.text}
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
          disabled={locked || Boolean(working)}
          onPress={() => void capture()}
          style={styles.primary}
          tone="accent"
        >
          {working && working !== 'open' && working !== 'restore' ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Ionicons
              color={colors.onAccent}
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
              width: comparisonLayout.width,
              height: comparisonLayout.height,
              transform: [{ translateX: canvasOffset.x }, { translateY: canvasOffset.y }, { scale: canvasScale }]
            }
          ]}
        >
          {variants.map((variant) => (
            <Pressable
              accessibilityLabel={simulatorVariantLabels[variant]}
              accessibilityRole="button"
              accessibilityState={{
                selected: selected === variant,
                disabled: !captures[variant] || Boolean(working)
              }}
              disabled={locked || !captures[variant] || Boolean(working)}
              key={variant}
              onPress={() => {
                setSelected(variant);
                onSelectionChange?.(variant);
              }}
              style={[
                styles.tile,
                { width: comparisonLayout.tileWidth, height: comparisonLayout.tileHeight },
                selected === variant && styles.selected
              ]}
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
                <View style={styles.placeholder}>
                  {working === variant && <ActivityIndicator color={colors.accentText} />}
                </View>
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
              color={colors.text}
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
              color={colors.text}
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
              color={colors.text}
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
          disabled={locked || Boolean(working)}
          onPress={() => void restore()}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>{confirmSelection ? 'Discard' : 'Restore original'}</Text>
        </GlassControl>
        {confirmSelection && (
          <GlassControl
            contentStyle={styles.secondaryContent}
            disabled={locked || !selected || Boolean(working)}
            onPress={() => void open(false)}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Preview live</Text>
          </GlassControl>
        )}
        <GlassControl
          contentStyle={styles.primaryContent}
          disabled={locked || !selected || Boolean(working)}
          onPress={() => void open(true)}
          style={styles.primary}
          tone="accent"
        >
          {working === 'open' && <ActivityIndicator color={colors.onAccent} />}
          <Text style={styles.primaryText}>{confirmSelection ? 'Accept' : 'Open selected live'}</Text>
        </GlassControl>
      </View>
    </View>
  );
  if (embedded) return visible ? content : null;
  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!operationActive.current) onClose();
      }}
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      visible={visible}
    >
      {content}
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, paddingTop: 44 },
    header: {
      minHeight: 76,
      paddingHorizontal: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    title: { color: colors.text, fontSize: 22, fontWeight: '700' },
    boundary: { color: colors.accentText, fontSize: 13, marginTop: 4 },
    close: {
      width: 44,
      height: 44,
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
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      gap: 14
    },
    field: { flexGrow: 1, flexBasis: 200, gap: 6 },
    label: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1
    },
    targetBundle: {
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.panel,
      borderRadius: 10,
      color: colors.text,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontFamily: 'Courier'
    },
    help: { flexGrow: 1, flexBasis: 150, color: colors.muted, fontSize: 12, marginBottom: 13 },
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
    primaryText: { color: colors.onAccent, fontWeight: '800' },
    gridViewport: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    grid: {
      padding: 18,
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
      backgroundColor: colors.panelRaised
    },
    zoomButton: { width: 44, height: 44, borderRadius: 8 },
    zoomButtonContent: { alignItems: 'center', justifyContent: 'center' },
    zoomValue: { width: 52, color: colors.text, fontSize: 13, textAlign: 'center' },
    tile: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.panel,
      overflow: 'hidden'
    },
    selected: { borderColor: colors.accentText, borderWidth: 2 },
    tileHeader: {
      height: 44,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    tileTitle: { color: colors.text, fontWeight: '700' },
    tileState: { color: colors.muted, fontSize: 12, letterSpacing: 1 },
    image: { flex: 1, backgroundColor: '#090a0c' },
    placeholder: {
      flex: 1,
      backgroundColor: colors.panel,
      alignItems: 'center',
      justifyContent: 'center'
    },
    error: { color: colors.danger, marginHorizontal: 26, marginBottom: 8 },
    footer: {
      minHeight: 76,
      paddingHorizontal: 18,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      paddingVertical: 12,
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
    secondaryText: { color: colors.text, fontWeight: '600' }
  })
);
