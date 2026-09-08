import type { AgentSessionSnapshot, AccessibilitySnapshotResponse as AXSnapshot } from '@monaddesign/client-contract';
import type { SimulatorVariantId } from '@monaddesign/simulator';

import { createThemedStyles } from '../theme';

type AXElement = AXSnapshot['elements'][number];

import type { useDesignGuidance } from '../hooks/use-design-guidance';

import { Host, Text as NativeText, Picker } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  frame,
  disabled as nativeDisabled,
  pickerStyle,
  tag,
  tint
} from '@expo/ui/swift-ui/modifiers';
import { AiProgrammingIcon, Cancel01Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { resolveAdjustmentRequest } from '@monaddesign/client-contract';
import { simulatorVariantLabels } from '@monaddesign/simulator';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useWorkspaceColors } from '../workspace-theme';
import { DesignGuidancePanel } from './DesignGuidancePanel';
import { GlassSurface } from './GlassControl';
import { WorkspaceAgentActivity } from './WorkspaceAgentActivity';
import { WorkspacePanelControl as GlassControl } from './WorkspacePanelControl';

export function AgentRequestPanel({
  annotationNotes,
  hasAnnotations = false,
  session,
  designGuidance,
  onEndLive,
  isEndingLive,
  selected,
  snapshot,
  request,
  variantCount,
  variants,
  selectedVariant,
  isSending,
  transition,
  error,
  onRequestChange,
  onVariantCountChange,
  onClearSelection,
  onSend,
  onPreviewVariant,
  onAccept,
  onDiscard
}: {
  annotationNotes?: ReactNode;
  hasAnnotations?: boolean;
  session: AgentSessionSnapshot | null;
  designGuidance: ReturnType<typeof useDesignGuidance>;
  onEndLive: () => void;
  isEndingLive: boolean;
  selected: AXElement | undefined;
  snapshot: AXSnapshot | null;
  request: string;
  variantCount: number;
  variants: SimulatorVariantId[];
  selectedVariant: SimulatorVariantId | null;
  isSending: boolean;
  transition: 'previewing' | 'accepting' | 'discarding' | null;
  error: string | null;
  onRequestChange: (value: string) => void;
  onVariantCountChange: (count: number) => void;
  onClearSelection: () => void;
  onSend: () => void;
  onPreviewVariant: (variant: SimulatorVariantId) => void;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  const colors = useWorkspaceColors();
  const styles = useStyles();
  const [goalsOpen, setGoalsOpen] = useState(false);
  const connected = Boolean(session && session.status !== 'closed');
  const canRequest = session?.status === 'awaiting_request' && !isSending && !isEndingLive;
  const isWorking = session?.status === 'change_requested' || session?.status === 'working';
  const isReviewing = session?.status === 'variants_ready' || session?.status === 'selection_confirmed';
  const confirmed = session?.status === 'selection_confirmed';
  const sendDisabled =
    !canRequest || (!resolveAdjustmentRequest(request, designGuidance.selected).trim() && !hasAnnotations) || isSending;

  return (
    <View style={styles.panel}>
      <ScrollView
        contentContainerStyle={styles.section}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={styles.title}>{isReviewing ? 'Review request' : 'Change request'}</Text>
        </View>

        {!connected && (
          <View style={styles.liveRequired}>
            <View style={styles.iconShell}>
              <HugeiconsIcon
                color={colors.accentText}
                icon={AiProgrammingIcon}
                size={13}
                strokeWidth={1.8}
              />
            </View>
            <View style={styles.liveCopy}>
              <Text style={styles.liveTitle}>Start Live in your coding agent</Text>
              <Text style={styles.liveText}>
                Open this project in your agent, then run /monad-design to enable editing and sending.
              </Text>
            </View>
          </View>
        )}
        {(isWorking || isReviewing) && session?.changeRequest?.context.designGuidance && (
          <View style={styles.requestSummary}>
            <GlassControl
              accessibilityRole="button"
              accessibilityState={{ expanded: goalsOpen }}
              contentStyle={{ justifyContent: 'center' }}
              onPress={() => setGoalsOpen(!goalsOpen)}
              solid
            >
              <Text style={styles.help}>
                {goalsOpen ? '▾' : '▸'} Requested goals ·{' '}
                {session.changeRequest.context.designGuidance.scope === 'screen'
                  ? 'Current screen'
                  : 'Selected element'}
              </Text>
            </GlassControl>
            {goalsOpen && (
              <View>
                <Text style={styles.requestSummaryText}>
                  {session.changeRequest.context.designGuidance.references
                    .map(({ title, instructions }) => `${title}\n${instructions ?? ''}`)
                    .join('\n\n')}
                </Text>
                <Text style={styles.help}>
                  {session.changeRequest.context.designGuidance.scope === 'screen'
                    ? 'Current screen'
                    : 'Selected element'}
                </Text>
                {Boolean(session.changeRequest.context.designGuidance.focus) && (
                  <Text style={styles.requestSummaryText}>
                    Focus: {session.changeRequest.context.designGuidance.focus}
                  </Text>
                )}
                {Boolean(session.changeRequest.context.designGuidance.preserve) && (
                  <Text style={styles.requestSummaryText}>
                    Preserve: {session.changeRequest.context.designGuidance.preserve}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
        {isWorking ? (
          <View style={styles.waiting}>
            <WorkspaceAgentActivity color={colors.accentText} />
            <Text style={styles.waitingTitle}>
              {session.status === 'working' ? 'Agent is building variants' : 'Waiting for agent'}
            </Text>
            <Text style={styles.waitingRequest}>{session.changeRequest?.request}</Text>
            <Text style={styles.waitingMeta}>
              Preparing Original + {session.changeRequest?.variantCount ?? variantCount}{' '}
              {(session.changeRequest?.variantCount ?? variantCount) === 1 ? 'variant' : 'variants'}
            </Text>
          </View>
        ) : isReviewing ? (
          <View style={styles.review}>
            <View style={styles.requestSummary}>
              <Text style={styles.fieldLabel}>Requested change</Text>
              <Text style={styles.requestSummaryText}>{session.changeRequest?.request}</Text>
            </View>
            <View style={styles.variantOptions}>
              {variants.map((variant) => {
                const active = selectedVariant === variant || session.confirmedSelection?.variant === variant;
                return (
                  <GlassControl
                    accessibilityState={{ selected: active }}
                    contentStyle={styles.variantOptionContent}
                    disabled={confirmed || isEndingLive || transition !== null}
                    glassStyle="clear"
                    key={variant}
                    onPress={() => onPreviewVariant(variant)}
                    style={[styles.variantOption, active && styles.variantOptionActive]}
                    tone={active ? 'selected' : 'neutral'}
                  >
                    <Text style={active ? styles.variantLabelActive : styles.variantLabel}>
                      {simulatorVariantLabels[variant]}
                    </Text>
                    <Text style={active ? styles.variantStateActive : styles.variantState}>
                      {active ? 'Selected' : 'Ready'}
                    </Text>
                  </GlassControl>
                );
              })}
            </View>
            {confirmed ? (
              <View style={styles.finalizing}>
                <WorkspaceAgentActivity color={colors.accentText} />
                <Text style={styles.finalizingText}>
                  {session.confirmedSelection?.variant === 'original'
                    ? 'Discard sent · agent is restoring the original'
                    : `${simulatorVariantLabels[session.confirmedSelection?.variant ?? 'original']} accepted · agent is finalizing`}
                </Text>
              </View>
            ) : (
              <View style={styles.reviewActions}>
                <GlassControl
                  contentStyle={styles.actionContent}
                  disabled={isEndingLive || isSending || transition !== null}
                  glassStyle="clear"
                  onPress={onDiscard}
                  style={styles.reviewAction}
                >
                  <HugeiconsIcon
                    color={colors.text}
                    icon={Cancel01Icon}
                    size={13}
                    strokeWidth={1.8}
                  />
                  <Text style={styles.secondaryActionText}>
                    {transition === 'discarding' ? 'Discarding…' : 'Discard'}
                  </Text>
                </GlassControl>
                <GlassControl
                  contentStyle={styles.actionContent}
                  disabled={isEndingLive || isSending || !selectedVariant || transition !== null}
                  onPress={onAccept}
                  style={styles.reviewAction}
                  tone="accent"
                >
                  <HugeiconsIcon
                    color={colors.onBlue}
                    icon={CheckmarkCircle01Icon}
                    size={13}
                    strokeWidth={1.8}
                  />
                  <Text style={styles.primaryActionText}>{transition === 'accepting' ? 'Accepting…' : 'Accept'}</Text>
                </GlassControl>
              </View>
            )}
          </View>
        ) : (
          <>
            {selected && snapshot ? (
              <View style={styles.evidence}>
                <Text style={styles.fieldLabel}>Selected element</Text>
                <View style={styles.evidenceHeading}>
                  <Text
                    numberOfLines={1}
                    style={styles.evidenceName}
                  >
                    {selected.label || selected.value || selected.role || selected.type}
                  </Text>
                  <GlassControl
                    accessibilityLabel="Clear selection"
                    contentStyle={styles.clearContent}
                    disabled={isSending || isEndingLive}
                    glassStyle="clear"
                    onPress={onClearSelection}
                    style={styles.clear}
                  >
                    <HugeiconsIcon
                      color={colors.muted}
                      icon={Cancel01Icon}
                      size={13}
                      strokeWidth={1.8}
                    />
                  </GlassControl>
                </View>
                <Text style={styles.evidenceMeta}>{selected.role || selected.type}</Text>
                <Text style={styles.evidenceCode}>
                  {Math.round(selected.frame.width)} × {Math.round(selected.frame.height)} at{' '}
                  {Math.round(selected.frame.x)}, {Math.round(selected.frame.y)}
                </Text>
              </View>
            ) : null}
            {annotationNotes}
            <DesignGuidancePanel
              controller={designGuidance}
              disabled={!canRequest}
            />
            <Text style={styles.fieldLabel}>Adjustment request</Text>
            <GlassSurface
              interactive
              style={styles.requestShell}
            >
              <TextInput
                accessibilityLabel="Adjustment request"
                editable={canRequest}
                multiline
                onChangeText={onRequestChange}
                placeholder={
                  designGuidance.selected.length
                    ? 'Optional: describe the result you want and what must stay intact…'
                    : 'Describe what should change and what must stay intact…'
                }
                placeholderTextColor={colors.muted}
                style={[styles.requestInput, !canRequest && styles.disabled]}
                value={request}
              />
            </GlassSurface>
            <View style={styles.variantField}>
              <Text style={styles.fieldLabel}>Variants</Text>
              <Host
                ignoreSafeArea="all"
                matchContents
              >
                <Picker
                  label="Variants"
                  modifiers={[
                    pickerStyle('menu'),
                    nativeDisabled(!canRequest),
                    tint(colors.accentText),
                    frame({ minHeight: 44 }),
                    accessibilityLabel('Number of variants')
                  ]}
                  onSelectionChange={onVariantCountChange}
                  selection={variantCount}
                >
                  {[1, 2, 3, 4, 5].map((count) => (
                    <NativeText
                      key={count}
                      modifiers={[tag(count)]}
                    >
                      {`${count} variant${count === 1 ? '' : 's'}`}
                    </NativeText>
                  ))}
                </Picker>
              </Host>
              <Text style={[styles.help, { width: '100%' }]}>Generate 1–5 alternatives. Default: 1.</Text>
            </View>
          </>
        )}
        {error && (
          <Text
            accessibilityRole="alert"
            style={styles.error}
          >
            {error}
          </Text>
        )}
      </ScrollView>
      {!isWorking && !isReviewing && (
        <View style={styles.sendFooter}>
          <GlassControl
            contentStyle={styles.sendContent}
            disabled={sendDisabled}
            onPress={onSend}
            style={styles.send}
            tone={sendDisabled ? 'neutral' : 'accent'}
          >
            {isSending ? (
              <WorkspaceAgentActivity color={colors.muted} />
            ) : (
              <HugeiconsIcon
                color={sendDisabled ? colors.muted : colors.onBlue}
                icon={AiProgrammingIcon}
                size={13}
                strokeWidth={1.8}
              />
            )}
            <Text style={[styles.sendText, sendDisabled && { color: colors.muted }]}>
              {isSending ? 'Sending…' : canRequest ? 'Send to agent' : connected ? 'Request sent' : 'Agent unavailable'}
            </Text>
          </GlassControl>
        </View>
      )}
      <View style={styles.footer}>
        <View style={styles.connectionStatus}>
          <View style={[styles.connectionDot, connected && { backgroundColor: colors.success }]} />
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.help, { fontSize: 12 }]}
          >
            {!connected
              ? 'Agent offline'
              : isWorking
                ? 'Agent working'
                : confirmed
                  ? 'Agent finalizing'
                  : isReviewing
                    ? 'Ready for review'
                    : session?.status === 'awaiting_request'
                      ? 'Agent ready'
                      : 'Agent connected'}
          </Text>
        </View>
        {connected && (
          <GlassControl
            accessibilityLabel="End live session"
            contentStyle={styles.actionContent}
            disabled={isEndingLive || isSending}
            onPress={onEndLive}
            style={styles.endLive}
          >
            <Text style={styles.endLiveText}>{isEndingLive ? 'Ending live…' : 'End live'}</Text>
          </GlassControl>
        )}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(
  (colors) =>
    StyleSheet.create({
      sendFooter: { paddingHorizontal: 14, paddingTop: 11, paddingBottom: 14 },
      panel: { flex: 1, minHeight: 0 },
      connectionStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
      connectionDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.muted },
      endLiveText: { color: colors.danger, fontSize: 12 },
      footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingVertical: 8,
        paddingHorizontal: 14,
        minHeight: 46
      },
      endLive: { minHeight: 44, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'transparent' },
      section: { padding: 14, gap: 11 },
      heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
      title: { color: colors.text, fontSize: 13, fontWeight: '600', letterSpacing: -0.26 },
      status: { color: colors.muted, fontSize: 12, textAlign: 'right' },
      liveRequired: {
        padding: 13,
        flexDirection: 'row',
        gap: 11,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.panel
      },
      iconShell: {
        width: 16,
        height: 16,
        borderRadius: 19,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center'
      },
      liveCopy: { flex: 1 },
      liveTitle: { color: colors.text, fontSize: 12, fontWeight: '600' },
      liveText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
      waiting: {
        padding: 18,
        minHeight: 250,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.panel,
        alignItems: 'center',
        justifyContent: 'center'
      },
      waitingTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 10 },
      waitingRequest: { color: colors.secondaryText, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
      waitingMeta: { color: colors.muted, fontSize: 12, marginTop: 8 },
      review: { gap: 10 },
      requestSummary: {
        padding: 12,
        borderRadius: 10,
        backgroundColor: colors.panelRaised,
        borderWidth: 1,
        borderColor: colors.border
      },
      requestSummaryText: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 6 },
      fieldLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
      variantOptions: { gap: 7 },
      variantOption: { minHeight: 44, borderRadius: 10 },
      variantOptionActive: { borderColor: colors.accentText },
      variantOptionContent: {
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
      },
      variantLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
      variantLabelActive: { color: colors.text, fontSize: 14, fontWeight: '900' },
      variantState: { color: colors.muted, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
      variantStateActive: { color: colors.accentText, fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
      finalizing: {
        minHeight: 58,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 10,
        backgroundColor: colors.selectedSurface
      },
      finalizingText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19 },
      compare: { minHeight: 44, borderRadius: 10 },
      compareContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
      compareText: { color: colors.text, fontSize: 13, fontWeight: '700' },
      reviewActions: { flexDirection: 'row', gap: 8 },
      reviewAction: { flex: 1, minHeight: 44, borderRadius: 10 },
      actionContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
      secondaryActionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
      primaryActionText: { color: colors.onBlue, fontSize: 13, fontWeight: '900' },
      evidence: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 11,
        padding: 13,
        backgroundColor: colors.panelRaised
      },
      evidenceHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
      evidenceName: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800' },
      evidenceMeta: { color: colors.muted, fontSize: 12, marginTop: 5 },
      evidenceCode: { color: colors.secondaryText, fontSize: 12, marginTop: 8 },
      clear: { width: 44, height: 44, borderRadius: 22, margin: -12 },
      clearContent: { alignItems: 'center', justifyContent: 'center' },
      empty: { minHeight: 78, borderRadius: 12 },
      emptyContent: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
      emptyCopy: { flex: 1 },
      emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
      emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
      requestShell: { borderRadius: 18 },
      requestInput: {
        minHeight: 94,
        backgroundColor: 'transparent',
        color: colors.text,
        padding: 10,
        fontSize: 17,
        lineHeight: 22,
        textAlignVertical: 'top'
      },
      disabled: { opacity: 0.56 },
      variantField: {
        gap: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10
      },
      countButtons: { flexDirection: 'row', gap: 6 },
      countButton: { width: 44, height: 44, borderRadius: 9 },
      countContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
      countText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
      countActive: { color: colors.onBlue, fontSize: 14, fontWeight: '900' },
      help: { color: colors.muted, fontSize: 13, lineHeight: 16 },
      send: { minHeight: 44, borderRadius: 14, marginTop: 0, marginBottom: 0 },
      sendContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
      sendText: { color: colors.onBlue, fontSize: 17, fontWeight: '700' },
      error: { color: colors.danger, fontSize: 13 }
    }),
  useWorkspaceColors
);
