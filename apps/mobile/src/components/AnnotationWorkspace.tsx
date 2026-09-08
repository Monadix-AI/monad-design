import type { NativeToolItem } from './GlassToolGroup';

import {
  ArrowUpRight01Icon,
  CleanIcon,
  Delete02Icon,
  EllipseIcon,
  Redo02Icon,
  SquareIcon,
  TextIcon,
  Undo02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  type Annotation,
  type AnnotationResizeHandle,
  type AnnotationTool,
  annotationBounds,
  annotationContainsPoint,
  annotationId,
  annotationInk,
  annotationIsVisible,
  annotationArrowHead as arrowHead,
  calloutBadgeGeometry,
  containAnnotationFrame as containFrame,
  type DrawnAnnotation,
  type FreehandAnnotation,
  freehandIsVisible,
  annotationImagePoint as imagePoint,
  isDrawnAnnotation,
  isFreehandAnnotation,
  type AnnotationPoint as Point,
  resizeDrawnAnnotation,
  type AnnotationSize as Size,
  serializeAnnotationNotes,
  translateAnnotation,
  wrapAnnotationText
} from '@monaddesign/simulator/annotation';
import { type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Polyline, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import { annotationHistoryReducer, initialAnnotationHistory } from '../annotation-history';
import { createThemedStyles, useColors } from '../theme';
import {
  type AnnotationInputEvent,
  type AnnotationInputSample,
  AnnotationInputSurface
} from './AnnotationInputSurface';
import { GlassSurface } from './GlassControl';
import { WorkspacePanelControl as GlassControl } from './WorkspacePanelControl';

const tools: Array<{ id: AnnotationTool; icon: typeof SquareIcon; label: string; symbol: NativeToolItem['symbol'] }> = [
  { id: 'rectangle', icon: SquareIcon, label: 'Rectangle', symbol: 'rectangle' },
  { id: 'ellipse', icon: EllipseIcon, label: 'Ellipse', symbol: 'oval' },
  { id: 'text', icon: TextIcon, label: 'Text', symbol: 'textformat' },
  { id: 'arrow', icon: ArrowUpRight01Icon, label: 'Arrow', symbol: 'arrow.up.right' }
];

export interface AnnotationWorkspaceParts {
  canvas: ReactNode;
  tools: ReactNode;
  drawingTools: NativeToolItem[];
  selectedToolIndex: number;
  notes: ReactNode;
  count: number;
  isFinishing: boolean;
  submit: () => Promise<void>;
}

export function AnnotationWorkspace({
  image,
  disabled,
  onClose,
  onFinish,
  onActivate,
  children
}: {
  image: string | null;
  disabled: boolean;
  onClose: () => void;
  onFinish: (screenshot: string, notes: string) => Promise<void>;
  onActivate: () => void;
  children: (parts: AnnotationWorkspaceParts) => ReactNode;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [tool, setTool] = useState<AnnotationTool>('rectangle');
  const [history, dispatchHistory] = useReducer(annotationHistoryReducer, initialAnnotationHistory);
  const annotations = history.present;
  const setAnnotations = (next: Annotation[] | ((current: Annotation[]) => Annotation[])) => {
    dispatchHistory({ type: 'commit', next: typeof next === 'function' ? next(annotations) : next });
  };
  const undo = () => {
    dispatchHistory({ type: 'undo' });
    setSelectedId(null);
  };
  const redo = () => {
    dispatchHistory({ type: 'redo' });
    setSelectedId(null);
  };
  const [draft, setDraft] = useState<DrawnAnnotation | FreehandAnnotation | null>(null);
  const [textPoint, setTextPoint] = useState<Point | null>(null);
  const [textValue, setTextValue] = useState('');
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [viewport, setViewport] = useState<Size | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const captureSurface = useRef<View>(null);
  const textInput = useRef<TextInput>(null);
  const noteInputs = useRef(new Map<string, TextInput>());
  const drawing = useRef<
    | { pointerId: number; kind: 'shape'; draft: DrawnAnnotation }
    | { pointerId: number; kind: 'freehand'; draft: FreehandAnnotation }
    | {
        pointerId: number;
        kind: 'resize';
        annotation: DrawnAnnotation;
        handle: AnnotationResizeHandle;
        previous: Annotation[];
      }
    | { pointerId: number; kind: 'move'; annotation: Annotation; origin: Point; previous: Annotation[] }
    | null
  >(null);
  const callouts = useMemo(() => annotations.filter(isDrawnAnnotation), [annotations]);

  useEffect(() => {
    drawing.current = null;
    dispatchHistory({ type: 'reset' });
    setDraft(null);
    setTextPoint(null);
    setTextValue('');
    setSelectedId(null);
    noteInputs.current.clear();
    if (!image) return;
    Image.getSize(
      image,
      (width, height) => setImageSize({ width, height }),
      () => setImageSize(null)
    );
  }, [image]);

  const frame = viewport && imageSize ? containFrame(viewport, imageSize) : null;
  const all = draft ? [...annotations, draft] : annotations;
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
  const eventPoint = (event: AnnotationInputSample) => {
    if (!frame || !imageSize) return null;
    return imagePoint({ x: event.x - frame.x, y: event.y - frame.y }, frame, imageSize);
  };
  const onPointerDown = (event: AnnotationInputSample) => {
    const { pointerId, pointerType } = event;
    if (disabled || isFinishing || drawing.current) return;
    const point = eventPoint(event);
    if (!point) return;
    if (pointerType === 'pen') {
      const next: FreehandAnnotation = { id: annotationId(), type: 'freehand', points: [point] };
      drawing.current = { pointerId, kind: 'freehand', draft: next };
      setDraft(next);
      return;
    }
    if (pointerType !== 'touch' && pointerType !== 'mouse') return;
    const currentSelection = annotations.find((annotation) => annotation.id === selectedId);
    if (currentSelection && isDrawnAnnotation(currentSelection)) {
      const handle = resizeHandles(currentSelection).find(
        ({ point: target }) =>
          Math.hypot(target.x - point.x, target.y - point.y) <=
          (imageSize && frame ? (18 * imageSize.width) / frame.width : 18)
      );
      if (handle) {
        drawing.current = {
          pointerId,
          kind: 'resize',
          annotation: currentSelection,
          handle: handle.id,
          previous: annotations
        };
        return;
      }
    }
    const selected = [...annotations].reverse().find((annotation) => annotationContainsPoint(annotation, point));
    if (selected) {
      setSelectedId(selected.id);
      drawing.current = { pointerId, kind: 'move', annotation: selected, origin: point, previous: annotations };
      return;
    }
    setSelectedId(null);
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
  const onPointerMove = (event: AnnotationInputSample) => {
    const { pointerId } = event;
    const active = drawing.current;
    if (active?.pointerId !== pointerId) return;
    const point = eventPoint(event);
    if (!point) return;
    if (active.kind === 'resize') {
      if (!imageSize) return;
      const resized = resizeDrawnAnnotation(active.annotation, active.handle, point, imageSize);
      dispatchHistory({ type: 'replace', next: annotations.map((item) => (item.id === resized.id ? resized : item)) });
      return;
    }
    if (active.kind === 'move') {
      const moved = translateAnnotation(
        active.annotation,
        { x: point.x - active.origin.x, y: point.y - active.origin.y },
        imageSize ?? { width: 0, height: 0 }
      );
      dispatchHistory({
        type: 'replace',
        next: annotations.map((annotation) => (annotation.id === moved.id ? moved : annotation))
      });
      return;
    }
    active.draft =
      active.kind === 'freehand'
        ? { ...active.draft, points: [...active.draft.points, point] }
        : { ...active.draft, end: point };
    setDraft(active.draft);
  };
  const finishPointer = (event: AnnotationInputSample) => {
    const { pointerId } = event;
    const active = drawing.current;
    if (active?.pointerId !== pointerId) return;
    if (active.kind === 'move' || active.kind === 'resize') {
      dispatchHistory({ type: 'record', previous: active.previous });
      drawing.current = null;
      return;
    }
    if (
      (active.kind === 'freehand' && freehandIsVisible(active.draft)) ||
      (active.kind === 'shape' && annotationIsVisible(active.draft))
    ) {
      if (active.kind === 'shape') setSelectedId(active.draft.id);
      setAnnotations((current) => [...current, active.draft]);
    }
    drawing.current = null;
    setDraft(null);
  };
  const finish = async () => {
    if (!imageSize || disabled || isFinishing) return;
    setIsFinishing(true);
    try {
      setSelectedId(null);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const base64 = await captureRef(captureSurface, {
        format: 'png',
        quality: 1,
        result: 'base64',
        width: imageSize.width,
        height: imageSize.height
      });
      await onFinish(`data:image/png;base64,${base64}`, serializeAnnotationNotes(annotations));
      onClose();
    } catch (error) {
      Alert.alert('Could not send to agent', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setIsFinishing(false);
    }
  };
  const handleInput = (event: AnnotationInputEvent) => {
    if (event.phase === 'cancel') {
      const active = drawing.current;
      if (active?.pointerId !== event.pointerId) return;
      if (active.kind === 'move' || active.kind === 'resize') {
        dispatchHistory({ type: 'replace', next: active.previous });
      }
      drawing.current = null;
      setDraft(null);
      return;
    }
    for (const point of event.points) {
      const sample = { ...point, pointerId: event.pointerId, pointerType: event.pointerType };
      if (event.phase === 'start') onPointerDown(sample);
      else onPointerMove(sample);
      if (event.phase === 'end') finishPointer(sample);
    }
  };
  const canvas = (
    <AnnotationInputSurface
      inputEnabled={!textPoint}
      onInput={handleInput}
      onLayout={({ nativeEvent: { layout } }) => setViewport({ width: layout.width, height: layout.height })}
      style={styles.canvas}
    >
      {image && frame && imageSize && (
        <View
          collapsable={false}
          pointerEvents="none"
          ref={captureSurface}
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
              const radius = Math.max(20, imageSize.width * 0.019);
              const badge = calloutBadgeGeometry(item, imageSize, radius);
              return (
                <Svg key={item.id}>
                  {shape}
                  {selectedId === item.id &&
                    resizeHandles(item).map(({ id, point }) => (
                      <Circle
                        cx={point.x}
                        cy={point.y}
                        fill="#ffffff"
                        key={id}
                        r={(imageSize.width / Math.max(1, frame.width)) * 5}
                        stroke={annotationInk}
                        strokeWidth={2}
                      />
                    ))}
                  {selectedId === item.id &&
                    (() => {
                      const bounds = annotationBounds(item);
                      const padding = Math.max(7, imageSize.width * 0.009);
                      return (
                        <Rect
                          fill="none"
                          height={bounds.height + padding * 2}
                          rx={padding}
                          stroke="#ffffff"
                          strokeDasharray={`${padding} ${padding * 0.7}`}
                          strokeWidth={Math.max(2, imageSize.width * 0.0025)}
                          width={bounds.width + padding * 2}
                          x={bounds.x - padding}
                          y={bounds.y - padding}
                        />
                      );
                    })()}
                  {number > 0 && (
                    <>
                      <Circle
                        cx={badge.center.x}
                        cy={badge.center.y}
                        fill={annotationInk}
                        r={radius}
                      />
                      <SvgText
                        fill="#0d0d0d"
                        fontSize={radius * 1.05}
                        fontWeight="800"
                        textAnchor="middle"
                        x={badge.center.x}
                        y={badge.center.y + radius * 0.36}
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
          placeholderTextColor={colors.muted}
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
    </AnnotationInputSurface>
  );
  const notes =
    callouts.length > 0 ? (
      <View style={[styles.notes, styles.notesCompact]}>
        <Text style={styles.notesTitle}>Implementation notes</Text>
        <Text style={styles.notesMeta}>
          {callouts.length} numbered callout{callouts.length === 1 ? '' : 's'} · optional · not in sent image
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
                <GlassSurface style={{ borderRadius: 8, marginTop: 6 }}>
                  <TextInput
                    editable={!disabled && !isFinishing}
                    multiline
                    onChangeText={(note) =>
                      setAnnotations((current) =>
                        current.map((item) =>
                          item.id === callout.id && isDrawnAnnotation(item) ? { ...item, note } : item
                        )
                      )
                    }
                    placeholder="Describe the implementation change…"
                    placeholderTextColor={colors.muted}
                    ref={(node) => {
                      if (node) noteInputs.current.set(callout.id, node);
                      else noteInputs.current.delete(callout.id);
                    }}
                    style={styles.noteInput}
                    value={callout.note}
                  />
                </GlassSurface>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    ) : null;
  const toolbar = (
    <View style={styles.tools}>
      <GlassSurface
        accessibilityLabel="Annotation actions"
        style={styles.toolGroup}
      >
        <GlassControl
          accessibilityLabel="Undo annotation"
          contentStyle={styles.toolContent}
          disabled={disabled || isFinishing || !history.past.length}
          glassStyle="clear"
          onPress={undo}
          style={styles.tool}
          systemImage="arrow.uturn.backward"
        >
          <HugeiconsIcon
            color={annotations.length ? colors.secondaryText : colors.muted}
            icon={Undo02Icon}
            size={13}
            strokeWidth={1.8}
          />
        </GlassControl>
        <GlassControl
          accessibilityLabel="Redo annotation"
          contentStyle={styles.toolContent}
          disabled={disabled || isFinishing || !history.future.length}
          onPress={redo}
          style={styles.tool}
          systemImage="arrow.uturn.forward"
        >
          <HugeiconsIcon
            color={colors.secondaryText}
            icon={Redo02Icon}
            size={13}
            strokeWidth={1.8}
          />
        </GlassControl>
        <View style={styles.toolDivider} />
        <GlassControl
          accessibilityLabel="Delete annotation"
          contentStyle={styles.toolContent}
          disabled={disabled || isFinishing || !selectedId}
          glassStyle="clear"
          onPress={() => {
            setAnnotations((items) => items.filter(({ id }) => id !== selectedId));
            setSelectedId(null);
          }}
          style={styles.tool}
          systemImage="trash"
        >
          <HugeiconsIcon
            color={selectedId ? colors.secondaryText : colors.muted}
            icon={Delete02Icon}
            size={13}
            strokeWidth={1.8}
          />
        </GlassControl>
        <GlassControl
          accessibilityLabel="Clear annotations"
          contentStyle={styles.toolContent}
          disabled={disabled || isFinishing || !annotations.length}
          glassStyle="clear"
          onPress={() => setAnnotations([])}
          style={styles.tool}
          systemImage="eraser"
        >
          <HugeiconsIcon
            color={annotations.length ? colors.secondaryText : colors.muted}
            icon={CleanIcon}
            size={13}
            strokeWidth={1.8}
          />
        </GlassControl>
      </GlassSurface>
    </View>
  );
  return children({
    canvas,
    tools: toolbar,
    notes,
    count: annotations.length,
    isFinishing,
    submit: finish,
    drawingTools: tools.map((item) => ({
      label: item.label,
      symbol: item.symbol,
      disabled: disabled || isFinishing,
      onPress: () => {
        if (!image) onActivate();
        setTool(item.id);
        setTextPoint(null);
        setTextValue('');
      }
    })),
    selectedToolIndex: image ? tools.findIndex((item) => item.id === tool) : -1
  });
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    canvas: {
      flex: 1,
      overflow: 'hidden',
      backgroundColor: 'transparent'
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
      backgroundColor: colors.panel,
      color: colors.text
    },
    notes: {
      width: 300,
      padding: 16,
      borderRadius: 14,
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border
    },
    notesCompact: { width: '100%', maxHeight: 280, padding: 0, borderWidth: 0, backgroundColor: 'transparent' },
    notesTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
    notesMeta: { color: colors.muted, fontSize: 13, marginTop: 4 },
    noteList: { gap: 10, paddingTop: 14, paddingBottom: 12 },
    noteCard: {
      minHeight: 84,
      padding: 12,
      flexDirection: 'row',
      gap: 10,
      backgroundColor: colors.panelRaised,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border
    },
    noteBadge: {
      width: 22,
      height: 22,
      borderRadius: 15,
      backgroundColor: annotationInk,
      alignItems: 'center',
      justifyContent: 'center'
    },
    noteBadgeText: { color: colors.onAccent, fontWeight: '800' },
    noteBody: { flex: 1 },
    noteType: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
    noteInput: { minHeight: 48, color: colors.text, fontSize: 13, padding: 8, textAlignVertical: 'top' },
    tools: { flexDirection: 'column', alignItems: 'center', gap: 10 },
    toolGroup: { padding: 6, gap: 4, borderRadius: 14, alignItems: 'center' },
    toolDivider: { height: 1, width: 24, backgroundColor: colors.border, marginVertical: 3 },
    tool: { height: 44, width: 44, borderRadius: 8 },
    toolContent: { alignItems: 'center', justifyContent: 'center' },
    toolText: { color: colors.secondaryText, fontSize: 12 },
    toolTextActive: { color: colors.onAccent, fontSize: 12, fontWeight: '800' }
  })
);

function resizeHandles(annotation: DrawnAnnotation): { id: AnnotationResizeHandle; point: Point }[] {
  if (annotation.type === 'arrow')
    return [
      { id: 'arrow-start', point: annotation.start },
      { id: 'arrow-end', point: annotation.end }
    ];
  const { x, y, width, height } = annotationBounds(annotation);
  return [
    { id: 'nw', point: { x, y } },
    { id: 'n', point: { x: x + width / 2, y } },
    { id: 'ne', point: { x: x + width, y } },
    { id: 'w', point: { x, y: y + height / 2 } },
    { id: 'e', point: { x: x + width, y: y + height / 2 } },
    { id: 'sw', point: { x, y: y + height } },
    { id: 's', point: { x: x + width / 2, y: y + height } },
    { id: 'se', point: { x: x + width, y: y + height } }
  ];
}
