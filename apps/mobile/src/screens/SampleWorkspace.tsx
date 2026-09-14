import type { GestureResponderEvent } from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '../theme';

type Mode = 'interact' | 'select' | 'annotate';
type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };
type MarkedBox = Box & { id: number };

const screen = require('../../assets/demo/daylight.png');
const screenAspectRatio = 1206 / 2622;
const targets: { name: string; box: Box }[] = [
  { name: 'Page headline', box: { x: 0.07, y: 0.17, width: 0.77, height: 0.09 } },
  { name: 'Today’s intention card', box: { x: 0.07, y: 0.3, width: 0.86, height: 0.19 } },
  { name: 'First ritual', box: { x: 0.07, y: 0.59, width: 0.86, height: 0.08 } },
  { name: 'Bottom navigation', box: { x: 0.06, y: 0.9, width: 0.88, height: 0.08 } }
];

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const boxFromPoints = (start: Point, end: Point): Box => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y)
});
const boxStyle = (box: Box) => ({
  left: `${box.x * 100}%` as const,
  top: `${box.y * 100}%` as const,
  width: `${box.width * 100}%` as const,
  height: `${box.height * 100}%` as const
});

export function SampleWorkspace({ onExit }: { onExit: () => void }) {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const compact = width < 900;
  const phoneHeight = Math.max(340, Math.min(height - 185, compact ? 480 : 640));
  const phoneWidth = phoneHeight * screenAspectRatio;
  const [mode, setMode] = useState<Mode>('interact');
  const [selected, setSelected] = useState<(typeof targets)[number] | null>(null);
  const [annotations, setAnnotations] = useState<MarkedBox[]>([]);
  const [draft, setDraft] = useState<Box | null>(null);
  const [ritualDone, setRitualDone] = useState(false);
  const [request, setRequest] = useState('Make the intention card easier to scan while keeping its calm tone.');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState(false);
  const start = useRef<Point | null>(null);
  const nextAnnotationId = useRef(1);
  const imageSize = useRef({ width: phoneWidth, height: phoneHeight });
  imageSize.current = { width: phoneWidth, height: phoneHeight };

  const point = (event: GestureResponderEvent): Point => ({
    x: clamp(event.nativeEvent.locationX / imageSize.current.width),
    y: clamp(event.nativeEvent.locationY / imageSize.current.height)
  });
  const selectedBox = mode === 'select' ? selected?.box : null;
  const instruction = useMemo(() => {
    if (mode === 'select') return 'Tap the headline, intention card, ritual, or navigation to inspect it.';
    if (mode === 'annotate') return 'Drag on the sample screen to mark an area, then add a note.';
    return 'Tap “Step outside” to try a touch interaction. The sample stays on this iPad.';
  }, [mode]);

  const handleScreenPress = (event: GestureResponderEvent) => {
    const location = point(event);
    if (mode === 'select') {
      setSelected(
        targets.find(
          ({ box }) =>
            location.x >= box.x &&
            location.x <= box.x + box.width &&
            location.y >= box.y &&
            location.y <= box.y + box.height
        ) ?? null
      );
      setPreview(false);
    } else if (mode === 'interact' && location.y >= 0.67 && location.y <= 0.76) {
      setRitualDone((current) => !current);
    }
  };

  const controls: { id: Mode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'interact', label: 'Interact', icon: 'hand-left-outline' },
    { id: 'select', label: 'Select', icon: 'scan-outline' },
    { id: 'annotate', label: 'Annotate', icon: 'create-outline' }
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityLabel="Back to connection"
          accessibilityRole="button"
          onPress={onExit}
          style={styles.back}
        >
          <Ionicons
            color={colors.text}
            name="arrow-back"
            size={22}
          />
          <Text style={[styles.backText, { color: colors.text }]}>Connect</Text>
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={[styles.title, { color: colors.text }]}>Sample workspace</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Explore the canvas without connecting a Mac</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.selectedSurface, borderColor: colors.border }]}>
          <Text style={[styles.badgeText, { color: colors.text }]}>OFFLINE SAMPLE</Text>
        </View>
      </View>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <View style={[styles.canvasArea, { backgroundColor: colors.canvas }]}>
          <View style={[styles.toolbar, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            {controls.map((control) => (
              <Pressable
                accessibilityLabel={control.label}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === control.id }}
                key={control.id}
                onPress={() => {
                  setMode(control.id);
                  setPreview(false);
                }}
                style={[styles.tool, mode === control.id && { backgroundColor: colors.controlSelected }]}
              >
                <Ionicons
                  color={mode === control.id ? colors.text : colors.muted}
                  name={control.icon}
                  size={18}
                />
                <Text style={[styles.toolLabel, { color: mode === control.id ? colors.text : colors.muted }]}>
                  {control.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.phone, { width: phoneWidth, height: phoneHeight, borderColor: colors.strongBorder }]}>
            <Image
              accessibilityLabel="Daylight sample iOS app screen"
              resizeMode="stretch"
              source={screen}
              style={{ width: phoneWidth - 8, height: phoneHeight - 8 }}
            />
            {ritualDone && (
              <View
                pointerEvents="none"
                style={[styles.ritualCover, { backgroundColor: '#fdfbf5' }]}
              >
                <Ionicons
                  color="#293c32"
                  name="checkmark-circle"
                  size={26}
                />
              </View>
            )}
            {selectedBox && (
              <View
                pointerEvents="none"
                style={[styles.selection, boxStyle(selectedBox)]}
              />
            )}
            {annotations.map((annotation) => (
              <View
                key={annotation.id}
                pointerEvents="none"
                style={[styles.annotation, boxStyle(annotation)]}
              />
            ))}
            {draft && (
              <View
                pointerEvents="none"
                style={[styles.annotation, boxStyle(draft)]}
              />
            )}
            {mode === 'annotate' ? (
              <View
                accessibilityLabel="Draw annotation on sample screen"
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(event) => {
                  start.current = point(event);
                  setDraft(null);
                }}
                onResponderMove={(event) => {
                  if (start.current) setDraft(boxFromPoints(start.current, point(event)));
                }}
                onResponderRelease={(event) => {
                  if (!start.current) return;
                  const next = boxFromPoints(start.current, point(event));
                  if (next.width > 0.025 && next.height > 0.012) {
                    setAnnotations((current) => [...current, { ...next, id: nextAnnotationId.current++ }]);
                  }
                  start.current = null;
                  setDraft(null);
                  setPreview(false);
                }}
                onStartShouldSetResponder={() => true}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <Pressable
                accessibilityLabel="Sample app canvas"
                onPress={handleScreenPress}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
          <Text style={[styles.canvasCaption, { color: colors.muted }]}>
            Original sample app screen · no code is changed in sample mode
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.inspectorContent}
          style={[
            styles.inspector,
            compact && styles.inspectorCompact,
            { backgroundColor: colors.panel, borderColor: colors.border }
          ]}
        >
          <Text style={[styles.sectionEyebrow, { color: colors.muted }]}>TRY THE WORKFLOW</Text>
          <Text style={[styles.instruction, { color: colors.text }]}>{instruction}</Text>
          {mode === 'select' && (
            <View style={[styles.infoCard, { backgroundColor: colors.panelRaised, borderColor: colors.border }]}>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>SELECTED ELEMENT</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {selected?.name ?? 'Tap an element on the canvas'}
              </Text>
            </View>
          )}
          {mode === 'annotate' && (
            <View style={styles.annotationRow}>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {annotations.length} marked {annotations.length === 1 ? 'area' : 'areas'}
              </Text>
              <Pressable
                accessibilityLabel="Clear annotations"
                accessibilityRole="button"
                onPress={() => setAnnotations([])}
              >
                <Text style={[styles.clearText, { color: colors.blue }]}>Clear</Text>
              </Pressable>
            </View>
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>CHANGE REQUEST</Text>
          <TextInput
            accessibilityLabel="Sample change request"
            multiline
            onChangeText={(value) => {
              setRequest(value);
              setPreview(false);
            }}
            placeholder="Describe what you want to change"
            placeholderTextColor={colors.muted}
            style={[styles.textArea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
            value={request}
          />
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>VISUAL NOTE</Text>
          <TextInput
            accessibilityLabel="Sample visual note"
            onChangeText={(value) => {
              setNote(value);
              setPreview(false);
            }}
            placeholder="What should stay or change?"
            placeholderTextColor={colors.muted}
            style={[
              styles.noteInput,
              { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }
            ]}
            value={note}
          />
          <Pressable
            accessibilityLabel="Preview request context"
            accessibilityRole="button"
            onPress={() => setPreview(true)}
            style={[styles.previewButton, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.previewText, { color: colors.onAccent }]}>Preview request context</Text>
            <Ionicons
              color={colors.onAccent}
              name="arrow-forward"
              size={18}
            />
          </Pressable>
          {preview && (
            <View
              accessibilityLabel="Sample request context preview"
              style={[styles.infoCard, { backgroundColor: colors.panelRaised, borderColor: colors.border }]}
            >
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>LOCAL PREVIEW · NOTHING SENT</Text>
              <Text style={[styles.previewDetail, { color: colors.text }]}>Request: {request.trim() || '(empty)'}</Text>
              <Text style={[styles.previewDetail, { color: colors.text }]}>Selected: {selected?.name ?? 'None'}</Text>
              <Text style={[styles.previewDetail, { color: colors.text }]}>Marked areas: {annotations.length}</Text>
              {note.trim() ? (
                <Text style={[styles.previewDetail, { color: colors.text }]}>Note: {note.trim()}</Text>
              ) : null}
            </View>
          )}
          <Text style={[styles.disclosure, { color: colors.muted }]}>
            To send a request to a coding agent, pair this iPad with Monad Design Core on your Mac. The live workflow
            can edit source and compare results.
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 86, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 28 },
  back: { minWidth: 125, flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 3 },
  badge: { minWidth: 125, padding: 9, borderWidth: 1, borderRadius: 9, alignItems: 'center' },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  body: { flex: 1, flexDirection: 'row' },
  bodyCompact: { flexDirection: 'column' },
  canvasArea: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 20 },
  toolbar: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4 },
  tool: {
    minWidth: 106,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 10
  },
  toolLabel: { fontSize: 13, fontWeight: '600' },
  phone: {
    borderWidth: 4,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18
  },
  ritualCover: {
    position: 'absolute',
    right: '6.8%',
    top: '69.6%',
    width: '8%',
    height: '3.5%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  selection: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#338dff',
    backgroundColor: 'rgba(51, 141, 255, 0.12)'
  },
  annotation: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#f84e69',
    backgroundColor: 'rgba(248, 78, 105, 0.08)'
  },
  canvasCaption: { fontSize: 11, textAlign: 'center' },
  inspector: { width: 370, borderLeftWidth: 1 },
  inspectorCompact: { width: '100%', maxHeight: 280, borderLeftWidth: 0, borderTopWidth: 1 },
  inspectorContent: { padding: 24, gap: 12 },
  sectionEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  instruction: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  infoCard: { borderWidth: 1, borderRadius: 12, padding: 13, gap: 7 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  annotationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearText: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginVertical: 5 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  textArea: { minHeight: 96, borderWidth: 1, borderRadius: 11, padding: 12, fontSize: 14, textAlignVertical: 'top' },
  noteInput: { minHeight: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, fontSize: 14 },
  previewButton: {
    minHeight: 48,
    borderRadius: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10
  },
  previewText: { fontSize: 14, fontWeight: '700' },
  previewDetail: { fontSize: 13, lineHeight: 18 },
  disclosure: { fontSize: 12, lineHeight: 18, marginTop: 5 }
});
