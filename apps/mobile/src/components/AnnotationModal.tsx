import type { PointerEvent as NativePointerEvent } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polyline, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import {
  type Annotation,
  type AnnotationTool,
  annotationInk,
  annotationIsVisible,
  arrowHead,
  calloutAnchor,
  calloutConnectorPath,
  containFrame,
  type DrawnAnnotation,
  type FreehandAnnotation,
  freehandIsVisible,
  imagePoint,
  isDrawnAnnotation,
  isFreehandAnnotation,
  type Point,
  type Size,
  wrapAnnotationText
} from '../annotation-model';
import { GlassControl } from './GlassControl';

const tools: Array<{ id: AnnotationTool; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { id: 'rectangle', icon: 'square-outline', label: 'Rectangle' },
  { id: 'ellipse', icon: 'ellipse-outline', label: 'Ellipse' },
  { id: 'text', icon: 'text', label: 'Text' },
  { id: 'arrow', icon: 'arrow-up-outline', label: 'Arrow' }
];

const annotationId = () => `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function AnnotationModal({
  image,
  isRecapturing,
  onClose,
  onFinish,
  onRecapture
}: {
  image: string | null;
  isRecapturing: boolean;
  onClose: () => void;
  onFinish: (annotationScreenshot: string) => Promise<void>;
  onRecapture: () => void;
}) {
  const [tool, setTool] = useState<AnnotationTool>('rectangle');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<DrawnAnnotation | FreehandAnnotation | null>(null);
  const [textPoint, setTextPoint] = useState<Point | null>(null);
  const [textValue, setTextValue] = useState('');
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [viewport, setViewport] = useState<Size | null>(null);
  const [compositionSize, setCompositionSize] = useState<Size | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const captureSurface = useRef<View>(null);
  const textInput = useRef<TextInput>(null);
  const noteInputs = useRef(new Map<string, TextInput>());
  const pendingNoteFocus = useRef<string | null>(null);
  const drawing = useRef<
    | { pointerId: number; kind: 'shape'; draft: DrawnAnnotation }
    | { pointerId: number; kind: 'freehand'; draft: FreehandAnnotation }
    | null
  >(null);
  const callouts = useMemo(() => annotations.filter(isDrawnAnnotation), [annotations]);
  const incompleteCallout = callouts.some(({ note }) => !note.trim());

  useEffect(() => {
    drawing.current = null;
    setAnnotations([]);
    setDraft(null);
    setTextPoint(null);
    setTextValue('');
    noteInputs.current.clear();
    pendingNoteFocus.current = null;
    if (!image) return;
    Image.getSize(
      image,
      (width, height) => setImageSize({ width, height }),
      () => setImageSize(null)
    );
  }, [image]);

  const frame = viewport && imageSize ? containFrame(viewport, imageSize) : null;
  const all = draft ? [...annotations, draft] : annotations;
  useEffect(() => {
    const pendingId = pendingNoteFocus.current;
    if (!pendingId || !callouts.some(({ id }) => id === pendingId)) return;
    const frameId = requestAnimationFrame(() => {
      noteInputs.current.get(pendingId)?.focus();
      pendingNoteFocus.current = null;
    });
    return () => cancelAnimationFrame(frameId);
  }, [callouts]);

  const commitText = () => {
    if (textPoint && textValue.trim()) {
      setAnnotations((current) => [
        ...current,
        { id: annotationId(), type: 'text', start: textPoint, text: textValue.trim() }
      ]);
    }
    setTextPoint(null);
    setTextValue('');
  };
  const eventPoint = (event: NativePointerEvent) => {
    if (!frame || !imageSize) return null;
    return imagePoint({ x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY }, frame, imageSize);
  };
  const onPointerDown = (event: NativePointerEvent) => {
    const { pointerId, pointerType } = event.nativeEvent;
    if (drawing.current) return;
    const point = eventPoint(event);
    if (!point) return;
    if (pointerType === 'pen') {
      const next: FreehandAnnotation = { id: annotationId(), type: 'freehand', points: [point] };
      drawing.current = { pointerId, kind: 'freehand', draft: next };
      setDraft(next);
      return;
    }
    if (pointerType !== 'touch' && pointerType !== 'mouse') return;
    if (tool === 'text') {
      setTextPoint(point);
      setTextValue('');
      requestAnimationFrame(() => textInput.current?.focus());
      return;
    }
    const next: DrawnAnnotation = { id: annotationId(), type: tool, start: point, end: point, note: '' };
    drawing.current = { pointerId, kind: 'shape', draft: next };
    setDraft(next);
  };
  const onPointerMove = (event: NativePointerEvent) => {
    const { pointerId } = event.nativeEvent;
    const active = drawing.current;
    if (active?.pointerId !== pointerId) return;
    const point = eventPoint(event);
    if (!point) return;
    active.draft =
      active.kind === 'freehand'
        ? { ...active.draft, points: [...active.draft.points, point] }
        : { ...active.draft, end: point };
    setDraft(active.draft);
  };
  const finishPointer = (event: NativePointerEvent) => {
    const { pointerId } = event.nativeEvent;
    const active = drawing.current;
    if (active?.pointerId !== pointerId) return;
    if (
      (active.kind === 'freehand' && freehandIsVisible(active.draft)) ||
      (active.kind === 'shape' && annotationIsVisible(active.draft))
    ) {
      if (active.kind === 'shape') pendingNoteFocus.current = active.draft.id;
      setAnnotations((current) => [...current, active.draft]);
    }
    drawing.current = null;
    setDraft(null);
  };
  const finish = async () => {
    if (!imageSize || incompleteCallout || isFinishing) return;
    setIsFinishing(true);
    try {
      const sidecarWidth = callouts.length ? Math.max(760, Math.round(imageSize.width * 1.05)) : 0;
      const base64 = await captureRef(captureSurface, {
        format: 'png',
        quality: 1,
        result: 'base64',
        width: imageSize.width + sidecarWidth,
        height: imageSize.height
      });
      await onFinish(`data:image/png;base64,${base64}`);
      onClose();
    } catch (error) {
      Alert.alert('Could not send to agent', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setIsFinishing(false);
    }
  };
  const recapture = () => {
    drawing.current = null;
    setAnnotations([]);
    setDraft(null);
    setTextPoint(null);
    setTextValue('');
    onRecapture();
  };

  const connectorPaths = useMemo(() => {
    if (!compositionSize || !frame || !imageSize || !callouts.length) return [];
    const notesLeft = compositionSize.width - 300;
    return callouts.map((callout, index) => {
      const anchor = calloutAnchor(callout);
      const start = {
        x: frame.x + (anchor.x / imageSize.width) * frame.width,
        y: frame.y + (anchor.y / imageSize.height) * frame.height
      };
      const end = { x: notesLeft - 8, y: 84 + index * 122 };
      return {
        id: callout.id,
        d: calloutConnectorPath(start, end)
      };
    });
  }, [callouts, compositionSize, frame, imageSize]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      supportedOrientations={['landscape-left', 'landscape-right']}
      visible={Boolean(image)}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <GlassControl
            contentStyle={styles.headerButtonContent}
            glassStyle="clear"
            onPress={onClose}
            style={styles.headerButton}
          >
            <Ionicons
              color="#eef0f4"
              name="close"
              size={20}
            />
            <Text style={styles.buttonText}>Close</Text>
          </GlassControl>
          <View>
            <Text style={styles.title}>Annotate evidence</Text>
            <Text style={styles.boundary}>Touch uses the selected tool · Pencil draws freehand · source unchanged</Text>
          </View>
          <View style={styles.headerActions}>
            <GlassControl
              contentStyle={styles.headerButtonContent}
              disabled={isRecapturing}
              glassStyle="clear"
              onPress={recapture}
              style={styles.headerButton}
            >
              <Ionicons
                color="#eef0f4"
                name="refresh"
                size={18}
              />
              <Text style={styles.buttonText}>{isRecapturing ? 'Capturing…' : 'Recapture'}</Text>
            </GlassControl>
            <GlassControl
              contentStyle={styles.headerButtonContent}
              disabled={incompleteCallout || !imageSize || isFinishing}
              onPress={() => void finish()}
              style={styles.headerButton}
              tone="accent"
            >
              <Ionicons
                color="#10130e"
                name="send-outline"
                size={18}
              />
              <Text style={styles.primaryText}>{isFinishing ? 'Sending…' : 'Send to agent'}</Text>
            </GlassControl>
          </View>
        </View>
        <View style={styles.body}>
          <View
            collapsable={false}
            onLayout={({ nativeEvent: { layout } }) =>
              setCompositionSize({ width: layout.width, height: layout.height })
            }
            ref={captureSurface}
            style={styles.composition}
          >
            <View
              onLayout={({ nativeEvent: { layout } }) => setViewport({ width: layout.width, height: layout.height })}
              onPointerCancel={finishPointer}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={finishPointer}
              style={styles.canvas}
            >
              {image && frame && imageSize && (
                <View
                  pointerEvents="none"
                  style={{
                    left: frame.x,
                    top: frame.y,
                    width: frame.width,
                    height: frame.height,
                    position: 'absolute'
                  }}
                >
                  <Image
                    resizeMode="stretch"
                    source={{ uri: image }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Svg
                    height="100%"
                    viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                    width="100%"
                  >
                    {all.map((item) => {
                      if (item.type === 'text') {
                        const fontSize = Math.max(28, imageSize.width * 0.045);
                        return (
                          <SvgText
                            fill={annotationInk}
                            fontSize={fontSize}
                            fontWeight="700"
                            key={item.id}
                            stroke="#08090b"
                            strokeWidth={Math.max(3, imageSize.width * 0.0048)}
                            x={item.start.x}
                            y={item.start.y}
                          >
                            {wrapAnnotationText(item.text, item.start.x, imageSize).map((line, index) => (
                              <TSpan
                                dy={index ? fontSize * 1.18 : 0}
                                key={`${item.id}-${line.id}`}
                                x={item.start.x}
                              >
                                {line.text}
                              </TSpan>
                            ))}
                          </SvgText>
                        );
                      }
                      if (isFreehandAnnotation(item)) {
                        return (
                          <Polyline
                            fill="none"
                            key={item.id}
                            points={item.points.map(({ x, y }) => `${x},${y}`).join(' ')}
                            stroke={annotationInk}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={Math.max(4, imageSize.width * 0.006)}
                          />
                        );
                      }
                      const left = Math.min(item.start.x, item.end.x);
                      const top = Math.min(item.start.y, item.end.y);
                      const width = Math.abs(item.end.x - item.start.x);
                      const height = Math.abs(item.end.y - item.start.y);
                      const strokeWidth = Math.max(4, imageSize.width * 0.006);
                      const shape =
                        item.type === 'rectangle' ? (
                          <Rect
                            fill="rgba(255,77,103,.08)"
                            height={height}
                            stroke={annotationInk}
                            strokeWidth={strokeWidth}
                            width={width}
                            x={left}
                            y={top}
                          />
                        ) : item.type === 'ellipse' ? (
                          <Ellipse
                            cx={left + width / 2}
                            cy={top + height / 2}
                            fill="rgba(255,77,103,.08)"
                            rx={width / 2}
                            ry={height / 2}
                            stroke={annotationInk}
                            strokeWidth={strokeWidth}
                          />
                        ) : (
                          (() => {
                            const head = arrowHead(item.start, item.end, Math.max(14, imageSize.width * 0.025));
                            return (
                              <>
                                <Line
                                  stroke={annotationInk}
                                  strokeLinecap="round"
                                  strokeWidth={strokeWidth}
                                  x1={item.start.x}
                                  x2={item.end.x}
                                  y1={item.start.y}
                                  y2={item.end.y}
                                />
                                <Polyline
                                  fill="none"
                                  points={`${head[0].x},${head[0].y} ${item.end.x},${item.end.y} ${head[1].x},${head[1].y}`}
                                  stroke={annotationInk}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={strokeWidth}
                                />
                              </>
                            );
                          })()
                        );
                      const number = callouts.findIndex(({ id }) => id === item.id) + 1;
                      const anchor = calloutAnchor(item);
                      const radius = Math.max(20, imageSize.width * 0.019);
                      return (
                        <Svg key={item.id}>
                          {shape}
                          {number > 0 && (
                            <>
                              <Circle
                                cx={anchor.x}
                                cy={anchor.y}
                                fill={annotationInk}
                                r={radius}
                              />
                              <SvgText
                                fill="#0d0d0d"
                                fontSize={radius * 1.05}
                                fontWeight="800"
                                textAnchor="middle"
                                x={anchor.x}
                                y={anchor.y + radius * 0.36}
                              >
                                {number}
                              </SvgText>
                            </>
                          )}
                        </Svg>
                      );
                    })}
                  </Svg>
                </View>
              )}
              {textPoint && frame && imageSize && (
                <TextInput
                  autoFocus
                  blurOnSubmit
                  onBlur={commitText}
                  onChangeText={setTextValue}
                  onPointerDown={(event) => event.stopPropagation()}
                  onSubmitEditing={commitText}
                  placeholder="Type annotation"
                  placeholderTextColor="#777b84"
                  ref={textInput}
                  returnKeyType="done"
                  style={[
                    styles.inlineTextInput,
                    {
                      left: frame.x + (textPoint.x / imageSize.width) * frame.width,
                      top: frame.y + (textPoint.y / imageSize.height) * frame.height
                    }
                  ]}
                  value={textValue}
                />
              )}
            </View>
            {callouts.length > 0 && (
              <View style={styles.notes}>
                <Text style={styles.notesTitle}>Implementation notes</Text>
                <Text style={styles.notesMeta}>
                  {callouts.length} numbered callout{callouts.length === 1 ? '' : 's'} · prepared locally
                </Text>
                <ScrollView
                  contentContainerStyle={styles.noteList}
                  keyboardShouldPersistTaps="handled"
                >
                  {callouts.map((callout, index) => (
                    <View
                      key={callout.id}
                      style={styles.noteCard}
                    >
                      <View style={styles.noteBadge}>
                        <Text style={styles.noteBadgeText}>{index + 1}</Text>
                      </View>
                      <View style={styles.noteBody}>
                        <Text style={styles.noteType}>{callout.type.toUpperCase()}</Text>
                        <TextInput
                          multiline
                          onChangeText={(note) =>
                            setAnnotations((current) =>
                              current.map((item) =>
                                item.id === callout.id && isDrawnAnnotation(item) ? { ...item, note } : item
                              )
                            )
                          }
                          placeholder="Describe the implementation change…"
                          placeholderTextColor="#676b74"
                          ref={(node) => {
                            if (node) noteInputs.current.set(callout.id, node);
                            else noteInputs.current.delete(callout.id);
                          }}
                          style={styles.noteInput}
                          value={callout.note}
                        />
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
            {compositionSize && connectorPaths.length > 0 && (
              <Svg
                height={compositionSize.height}
                pointerEvents="none"
                style={styles.connectors}
                width={compositionSize.width}
              >
                {connectorPaths.map((connector) => (
                  <Path
                    d={connector.d}
                    fill="none"
                    key={connector.id}
                    stroke={annotationInk}
                    strokeLinecap="round"
                    strokeWidth={2}
                  />
                ))}
              </Svg>
            )}
          </View>
          <View style={styles.tools}>
            {tools.map((item) => (
              <GlassControl
                contentStyle={styles.toolContent}
                glassStyle="clear"
                key={item.id}
                onPress={() => {
                  setTool(item.id);
                  setTextPoint(null);
                  setTextValue('');
                }}
                style={styles.tool}
                tone={tool === item.id ? 'accent' : 'neutral'}
              >
                <Ionicons
                  color={tool === item.id ? '#10130e' : '#b8bbc2'}
                  name={item.icon}
                  size={20}
                />
                <Text style={tool === item.id ? styles.toolTextActive : styles.toolText}>{item.label}</Text>
              </GlassControl>
            ))}
            <GlassControl
              contentStyle={styles.toolContent}
              disabled={!annotations.length}
              glassStyle="clear"
              onPress={() => setAnnotations((items) => items.slice(0, -1))}
              style={styles.tool}
            >
              <Ionicons
                color={annotations.length ? '#b8bbc2' : '#55585f'}
                name="arrow-undo"
                size={20}
              />
              <Text style={styles.toolText}>Undo</Text>
            </GlassControl>
            <GlassControl
              contentStyle={styles.toolContent}
              disabled={!annotations.length}
              glassStyle="clear"
              onPress={() => setAnnotations([])}
              style={styles.tool}
            >
              <Ionicons
                color={annotations.length ? '#b8bbc2' : '#55585f'}
                name="trash-outline"
                size={20}
              />
              <Text style={styles.toolText}>Clear</Text>
            </GlassControl>
          </View>
          {incompleteCallout && (
            <Text style={styles.sendHint}>Add a note to every numbered callout before sending.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0e11' },
  header: {
    height: 84,
    paddingHorizontal: 24,
    paddingTop: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#292b31',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: { minWidth: 92, height: 44, borderRadius: 10 },
  headerButtonContent: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: { color: '#eef0f4', fontWeight: '600' },
  primaryText: { color: '#10130e', fontWeight: '800' },
  title: { color: '#eef0f4', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  boundary: { color: '#8d929c', fontSize: 11, marginTop: 3, textAlign: 'center' },
  body: { flex: 1, padding: 20, gap: 12 },
  composition: { flex: 1, flexDirection: 'row', gap: 14, backgroundColor: '#0f1013' },
  connectors: { position: 'absolute', inset: 0, zIndex: 3 },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#1b1e24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#6b7078'
  },
  inlineTextInput: {
    position: 'absolute',
    zIndex: 4,
    minWidth: 180,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: annotationInk,
    backgroundColor: '#111216',
    color: '#eef0f4'
  },
  notes: {
    width: 300,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#111216',
    borderWidth: 1,
    borderColor: '#303238'
  },
  notesTitle: { color: '#f2f3f5', fontSize: 18, fontWeight: '700' },
  notesMeta: { color: '#8d929c', fontSize: 11, marginTop: 4 },
  noteList: { gap: 10, paddingTop: 14, paddingBottom: 12 },
  noteCard: {
    minHeight: 112,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#191b20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3d44'
  },
  noteBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: annotationInk,
    alignItems: 'center',
    justifyContent: 'center'
  },
  noteBadgeText: { color: '#0d0d0d', fontWeight: '800' },
  noteBody: { flex: 1 },
  noteType: { color: '#9ba0a9', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  noteInput: { minHeight: 68, color: '#f1f2f4', fontSize: 13, paddingTop: 6, textAlignVertical: 'top' },
  tools: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tool: { height: 44, minWidth: 76, borderRadius: 10 },
  toolContent: { paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  toolText: { color: '#b8bbc2', fontSize: 12 },
  toolTextActive: { color: '#10130e', fontSize: 12, fontWeight: '800' },
  sendHint: { color: '#ff9aab', fontSize: 11, textAlign: 'center' }
});
