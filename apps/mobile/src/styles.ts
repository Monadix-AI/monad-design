import { StyleSheet } from 'react-native';

import { colors } from './theme';

export const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  loadingText: { color: colors.muted },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandLetter: { color: '#10130e', fontWeight: '900', fontSize: 15 },
  brandName: { color: colors.text, fontWeight: '800', fontSize: 14 },
  brandSub: { color: colors.muted, fontSize: 10, marginTop: 1 },
  setupRoot: { flex: 1, backgroundColor: colors.background },
  setupHeader: {
    height: 68,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#23252a'
  },
  localOnly: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '700'
  },
  setupBody: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    gap: 90
  },
  setupBodyCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 32,
    gap: 34
  },
  setupCopy: { maxWidth: 460 },
  eyebrow: {
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: '800',
    marginBottom: 15
  },
  setupTitle: {
    color: colors.text,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.7,
    fontWeight: '700'
  },
  setupTitleCompact: { fontSize: 34, lineHeight: 39 },
  setupDescription: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 25,
    marginTop: 22
  },
  steps: { marginTop: 34, gap: 13 },
  step: { color: '#c2c5cb', fontSize: 12, letterSpacing: 0.7 },
  setupCard: {
    width: 390,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.panel
  },
  scanButton: { minHeight: 62, borderRadius: 12 },
  scanButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  scanButtonTitle: { color: '#10130e', fontSize: 14, fontWeight: '800' },
  scanButtonHint: { color: '#35402e', fontSize: 10, marginTop: 2 },
  setupDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 20
  },
  setupDividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  setupDividerText: {
    color: '#686c75',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1
  },
  setupCardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 26
  },
  signal: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#20291d',
    alignItems: 'center',
    justifyContent: 'center'
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 8
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cardHint: { color: colors.muted, fontSize: 11, marginTop: 3 },
  inputLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 7,
    marginTop: 14
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#16181c',
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 15,
    userSelect: 'text'
  },
  codeInput: { fontSize: 22, fontWeight: '800', letterSpacing: 7 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 12 },
  connectButton: {
    height: 50,
    borderRadius: 11,
    marginTop: 22
  },
  connectButtonContent: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  connectText: { color: '#10130e', fontSize: 14, fontWeight: '800' },
  securityNote: {
    color: '#686c75',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 13
  },
  scannerRoot: { flex: 1, backgroundColor: '#050607' },
  scannerShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 6, 7, 0.28)'
  },
  scannerContent: { flex: 1, paddingHorizontal: 32, paddingVertical: 20 },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  scannerEyebrow: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5
  },
  scannerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 5
  },
  scannerClose: {
    width: 44,
    height: 44,
    borderRadius: 22
  },
  scannerCloseContent: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  scanFrame: {
    position: 'absolute',
    width: 286,
    height: 286,
    alignSelf: 'center',
    top: '50%',
    marginTop: -143
  },
  scanCorner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: colors.accent
  },
  scanCornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4
  },
  scanCornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4
  },
  scanCornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4
  },
  scanCornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4
  },
  scannerFooter: { marginTop: 'auto', alignItems: 'center', minHeight: 72 },
  scannerHint: {
    color: '#d5d8de',
    fontSize: 12,
    backgroundColor: 'rgba(13, 14, 17, 0.78)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20
  },
  scannerError: {
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(120, 24, 42, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    marginBottom: 10
  },
  scanAgainButton: { minWidth: 150, minHeight: 42, borderRadius: 12 },
  scanAgainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  scanAgainText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.72 },
  projectRoot: { flex: 1, backgroundColor: colors.background },
  projectBody: {
    flex: 1,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 42,
    paddingTop: 38,
    paddingBottom: 28
  },
  projectHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#282a2f'
  },
  projectTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1
  },
  projectHint: { color: colors.muted, fontSize: 13, marginTop: 8 },
  pairedState: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pairedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent
  },
  pairedText: { color: colors.muted, fontSize: 11 },
  projectList: { flex: 1 },
  projectListContent: { flexGrow: 1, paddingVertical: 8 },
  projectItem: { minHeight: 76, borderRadius: 12, marginVertical: 4 },
  projectItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  projectIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#1b211a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  projectIdentity: { flex: 1 },
  projectName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  projectMeta: { color: colors.muted, fontSize: 10, marginTop: 5 },
  projectStatus: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  projectStatusText: { color: colors.muted, fontSize: 12 },
  pickerRoot: { flex: 1, backgroundColor: colors.background },
  pickerHeader: {
    height: 68,
    paddingHorizontal: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#23252a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textButton: { minHeight: 42, borderRadius: 12 },
  textButtonContent: {
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textButtonLabel: { color: colors.muted, fontSize: 12 },
  pickerBody: {
    flex: 1,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 42,
    paddingTop: 42,
    paddingBottom: 32
  },
  pickerScroll: { flex: 1 },
  pickerBodyContent: { flexGrow: 1, paddingBottom: 12 },
  pickerIntro: { marginBottom: 28 },
  pickerTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1
  },
  pickerHint: { color: colors.muted, fontSize: 14, marginTop: 10 },
  pickerSectionLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8
  },
  targetAppGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28
  },
  targetAppCard: {
    width: '100%',
    minHeight: 66,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  targetAppContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12
  },
  targetAppCardSelected: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }
  },
  targetAppIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#202228',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  targetAppIconImage: { width: '100%', height: '100%' },
  targetAppName: { color: colors.text, fontSize: 11, fontWeight: '700' },
  targetAppBundle: {
    color: colors.accent,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
    fontFamily: 'Courier'
  },
  targetAppSelection: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5f636c',
    alignItems: 'center',
    justifyContent: 'center'
  },
  targetAppSelectionSelected: { borderColor: colors.accent },
  targetAppSelectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent
  },
  deviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    gap: 12
  },
  deviceCard: {
    width: '48.8%',
    height: 92,
    borderRadius: 14
  },
  deviceCardContent: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  deviceDetails: { flex: 1 },
  deviceName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  deviceRuntime: { color: colors.muted, fontSize: 11, marginTop: 5 },
  booted: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bootedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent
  },
  bootedText: { color: colors.muted, fontSize: 8, letterSpacing: 1 },
  connectedText: { color: colors.accent },
  empty: {
    width: '100%',
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 16
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14
  },
  emptyText: { color: colors.muted, marginTop: 7 },
  pickerConnect: { width: 250, alignSelf: 'flex-end', marginTop: 12 },
  workspaceRoot: { flex: 1, backgroundColor: colors.background },
  workspaceHeader: {
    height: 62,
    paddingHorizontal: 22,
    borderBottomWidth: 1,
    borderBottomColor: '#23252a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  liveStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#5e6269' },
  liveDotOn: { backgroundColor: colors.accent },
  liveName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  liveText: { color: colors.muted, fontSize: 9, letterSpacing: 1 },
  previewBoundary: { color: '#ffd37a', fontSize: 9, marginLeft: 10 },
  exitButton: {
    minHeight: 42,
    borderRadius: 12
  },
  exitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12
  },
  exitText: { color: colors.muted, fontSize: 11 },
  action: {
    minHeight: 42,
    borderRadius: 9,
    marginBottom: 1
  },
  actionContent: {
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  actionText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  actionTextActive: { color: '#10130e', fontWeight: '800' },
  modeButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8
  },
  modeButtonContent: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  modeButtonText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  modeButtonTextActive: { color: colors.text },
  canvasArea: { flex: 1, backgroundColor: '#1b1e24', position: 'relative' },
  canvasReadout: {
    position: 'absolute',
    top: 16,
    left: 18,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7
  },
  canvasReadoutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#656971'
  },
  canvasSize: { color: '#777b84', fontSize: 10 },
  canvasGestureHint: {
    position: 'absolute',
    top: 64,
    right: 18,
    zIndex: 2,
    color: '#777b84',
    fontSize: 10
  },
  canvasModeBar: {
    position: 'absolute',
    top: 12,
    right: 18,
    zIndex: 4,
    width: 276,
    minHeight: 44,
    padding: 3,
    borderRadius: 11,
    flexDirection: 'row',
    gap: 3,
    backgroundColor: 'rgba(20, 22, 26, 0.86)'
  },
  canvasCenter: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    paddingTop: 38,
    paddingBottom: 82,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  canvasGestureSurface: {
    position: 'absolute',
    inset: 0,
    zIndex: 0
  },
  deviceCluster: { zIndex: 1, alignItems: 'center', justifyContent: 'center' },
  canvasSelectionCard: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    zIndex: 4,
    width: 360,
    minHeight: 62,
    padding: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#3a3d44',
    backgroundColor: 'rgba(20, 22, 26, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  canvasSelectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1b1e22',
    alignItems: 'center',
    justifyContent: 'center'
  },
  canvasSelectionCopy: { flex: 1 },
  canvasSelectionTitle: { color: colors.text, fontSize: 11, fontWeight: '800' },
  canvasSelectionMeta: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  canvasSelectionAction: { width: 44, height: 44, borderRadius: 10 },
  canvasSelectionActionContent: { alignItems: 'center', justifyContent: 'center' },
  deviceFrame: {
    position: 'relative',
    borderWidth: 1,
    borderColor: '#6b7078',
    backgroundColor: '#050506',
    shadowColor: '#000',
    shadowOpacity: 0.48,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 }
  },
  nativeDeviceFrame: {
    borderWidth: 0,
    backgroundColor: 'transparent'
  },
  nativeDeviceChrome: {
    position: 'absolute',
    zIndex: 0
  },
  deviceScreen: {
    position: 'absolute',
    zIndex: 1
  },
  screenMaskCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screenSurface: { flex: 1, backgroundColor: '#000' },
  deviceHardware: { position: 'absolute', backgroundColor: '#020203' },
  deviceHomeButton: {
    borderWidth: 1,
    borderColor: '#3d3f44',
    backgroundColor: '#090a0b'
  },
  deviceCamera: {
    borderWidth: 1,
    borderColor: '#050607',
    backgroundColor: '#141a20'
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  deviceControls: {
    marginTop: 14,
    minHeight: 54,
    padding: 4,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  canvasControl: {
    minWidth: 66,
    height: 46,
    borderRadius: 10
  },
  canvasControlContent: {
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  },
  canvasControlText: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  zoomControls: {
    position: 'absolute',
    left: 18,
    bottom: 18,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 12
  },
  zoomButtonContent: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  zoomValue: {
    minWidth: 48,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center'
  },
  axFrame: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(168,255,120,.9)',
    backgroundColor: 'rgba(168,255,120,.08)'
  },
  axContainer: {
    borderColor: 'rgba(106,184,255,.8)',
    backgroundColor: 'rgba(106,184,255,.05)'
  },
  axSelected: {
    borderWidth: 3,
    borderColor: '#ff4d67',
    backgroundColor: 'rgba(255,77,103,.13)'
  },
  canvasError: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: '#27171d',
    borderWidth: 1,
    borderColor: '#5a2936',
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center'
  },
  canvasErrorText: { flex: 1, color: '#ffd6dd', fontSize: 11 },
  inspectorModal: { flex: 1, backgroundColor: colors.panel },
  inspectorTitlebar: {
    height: 68,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#23252a'
  },
  inspectorTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  inspectorRuntime: { color: colors.muted, fontSize: 10, marginTop: 3 },
  inspectorContent: { paddingBottom: 16 },
  inspectorSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#23252a'
  },
  inspectorSectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  inspectorSectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800'
  },
  inspectorSectionMeta: { color: colors.muted, fontSize: 9 },
  modeSwitch: {
    minHeight: 48,
    padding: 3,
    borderRadius: 11,
    flexDirection: 'row',
    gap: 4
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.65)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pasteCard: {
    width: 430,
    borderRadius: 16,
    padding: 22,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border
  },
  pasteHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalClose: { width: 44, height: 44, borderRadius: 22 },
  modalCloseContent: { alignItems: 'center', justifyContent: 'center' },
  pasteInput: {
    height: 150,
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#16181c',
    color: colors.text,
    padding: 12,
    textAlignVertical: 'top',
    userSelect: 'text'
  }
});
