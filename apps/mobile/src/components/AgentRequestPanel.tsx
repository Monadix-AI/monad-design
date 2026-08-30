import type { AgentSessionSnapshot } from '@monaddesign/client-rtk';
import type { AXElement, AXSnapshot, SimulatorVariantId } from '../types';

import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { agentPanelStatus } from '../agent-panel-model';
import { colors } from '../theme';
import { GlassControl } from './GlassControl';

const labels: Record<SimulatorVariantId, string> = {
  original: 'Original',
  v1: 'Variant 1',
  v2: 'Variant 2',
  v3: 'Variant 3',
  v4: 'Variant 4',
  v5: 'Variant 5'
};

export function AgentRequestPanel({
  session,
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
  onSelectEvidence,
  onSend,
  onPreviewVariant,
  onAccept,
  onDiscard,
  onCompare
}: {
  session: AgentSessionSnapshot | null;
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
  onSelectEvidence: () => void;
  onSend: () => void;
  onPreviewVariant: (variant: SimulatorVariantId) => void;
  onAccept: () => void;
  onDiscard: () => void;
  onCompare: () => void;
}) {
  const canRequest = session?.status === 'awaiting_request';
  const isWorking = session?.status === 'change_requested' || session?.status === 'working';
  const isReviewing = session?.status === 'variants_ready' || session?.status === 'selection_confirmed';
  const confirmed = session?.status === 'selection_confirmed';

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.title}>Request</Text>
        <Text style={styles.status}>{agentPanelStatus(session)}</Text>
      </View>

      {!session && (
        <View style={styles.liveRequired}>
          <View style={styles.iconShell}>
            <Ionicons
              color={colors.accent}
              name="sparkles-outline"
              size={20}
            />
          </View>
          <View style={styles.liveCopy}>
            <Text style={styles.liveTitle}>Start Live in your coding agent</Text>
            <Text style={styles.liveText}>
              Open this project in your agent, then start Monad Design Live to enable editing and sending.
            </Text>
          </View>
        </View>
      )}
      {isWorking ? (
        <View style={styles.waiting}>
          <ActivityIndicator
            color={colors.accent}
            size="small"
          />
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
            <Text style={styles.fieldLabel}>REQUESTED CHANGE</Text>
            <Text style={styles.requestSummaryText}>{session.changeRequest?.request}</Text>
          </View>
          <View style={styles.variantOptions}>
            {variants.map((variant) => {
              const active = selectedVariant === variant || session.confirmedSelection?.variant === variant;
              return (
                <GlassControl
                  contentStyle={styles.variantOptionContent}
                  disabled={confirmed || transition !== null}
                  glassStyle="clear"
                  key={variant}
                  onPress={() => onPreviewVariant(variant)}
                  style={[styles.variantOption, active && styles.variantOptionActive]}
                  tone={active ? 'accent' : 'neutral'}
                >
                  <Text style={active ? styles.variantLabelActive : styles.variantLabel}>{labels[variant]}</Text>
                  <Text style={active ? styles.variantStateActive : styles.variantState}>
                    {active ? 'SELECTED' : 'READY'}
                  </Text>
                </GlassControl>
              );
            })}
          </View>
          {confirmed ? (
            <View style={styles.finalizing}>
              <ActivityIndicator
                color={colors.accent}
                size="small"
              />
              <Text style={styles.finalizingText}>
                {session.confirmedSelection?.variant === 'original'
                  ? 'Discard sent · agent is restoring the original'
                  : `${labels[session.confirmedSelection?.variant ?? 'original']} accepted · agent is finalizing`}
              </Text>
            </View>
          ) : (
            <>
              <GlassControl
                contentStyle={styles.compareContent}
                glassStyle="clear"
                onPress={onCompare}
                style={styles.compare}
              >
                <Ionicons
                  color={colors.text}
                  name="git-compare-outline"
                  size={17}
                />
                <Text style={styles.compareText}>Open visual comparison</Text>
              </GlassControl>
              <View style={styles.reviewActions}>
                <GlassControl
                  contentStyle={styles.actionContent}
                  disabled={transition !== null}
                  glassStyle="clear"
                  onPress={onDiscard}
                  style={styles.reviewAction}
                >
                  <Ionicons
                    color={colors.text}
                    name="close-circle-outline"
                    size={18}
                  />
                  <Text style={styles.secondaryActionText}>
                    {transition === 'discarding' ? 'Discarding…' : 'Discard'}
                  </Text>
                </GlassControl>
                <GlassControl
                  contentStyle={styles.actionContent}
                  disabled={!selectedVariant || transition !== null}
                  onPress={onAccept}
                  style={styles.reviewAction}
                  tone="accent"
                >
                  <Ionicons
                    color="#10130e"
                    name="checkmark-circle-outline"
                    size={18}
                  />
                  <Text style={styles.primaryActionText}>{transition === 'accepting' ? 'Accepting…' : 'Accept'}</Text>
                </GlassControl>
              </View>
            </>
          )}
        </View>
      ) : (
        <>
          {selected && snapshot ? (
            <View style={styles.evidence}>
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
                  glassStyle="clear"
                  onPress={onClearSelection}
                  style={styles.clear}
                >
                  <Ionicons
                    color={colors.muted}
                    name="close"
                    size={17}
                  />
                </GlassControl>
              </View>
              <Text style={styles.evidenceMeta}>{selected.role || selected.type}</Text>
              <Text style={styles.evidenceCode}>
                {Math.round(selected.frame.width)} × {Math.round(selected.frame.height)} at{' '}
                {Math.round(selected.frame.x)}, {Math.round(selected.frame.y)}
              </Text>
            </View>
          ) : (
            <GlassControl
              contentStyle={styles.emptyContent}
              glassStyle="clear"
              onPress={onSelectEvidence}
              style={styles.empty}
            >
              <Ionicons
                color={colors.muted}
                name="scan-outline"
                size={22}
              />
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>
                  {session ? 'No element selected' : 'Select an element on the simulator'}
                </Text>
                <Text style={styles.emptyText}>
                  {session
                    ? 'The current screen accessibility context will be attached.'
                    : 'Runtime geometry and accessibility evidence will be attached.'}
                </Text>
              </View>
            </GlassControl>
          )}
          <Text style={styles.fieldLabel}>ADJUSTMENT REQUEST</Text>
          <TextInput
            editable={canRequest}
            multiline
            onChangeText={onRequestChange}
            placeholder="Describe what should change and what must stay intact…"
            placeholderTextColor="#656971"
            style={[styles.requestInput, !canRequest && styles.disabled]}
            value={request}
          />
          <View style={styles.variantField}>
            <Text style={styles.fieldLabel}>VARIANTS</Text>
            <View style={styles.countButtons}>
              {[1, 2, 3, 4, 5].map((count) => (
                <GlassControl
                  accessibilityLabel={`${count} variant${count === 1 ? '' : 's'}`}
                  contentStyle={styles.countContent}
                  disabled={!canRequest}
                  glassStyle="clear"
                  key={count}
                  onPress={() => onVariantCountChange(count)}
                  style={styles.countButton}
                  tone={variantCount === count ? 'accent' : 'neutral'}
                >
                  <Text style={variantCount === count ? styles.countActive : styles.countText}>{count}</Text>
                </GlassControl>
              ))}
            </View>
            <Text style={styles.help}>Generate 1–5 alternatives. Default: 1.</Text>
          </View>
          <GlassControl
            contentStyle={styles.sendContent}
            disabled={!canRequest || !request.trim() || isSending}
            onPress={onSend}
            style={styles.send}
            tone="accent"
          >
            {isSending ? (
              <ActivityIndicator
                color="#10130e"
                size="small"
              />
            ) : (
              <Ionicons
                color="#10130e"
                name="sparkles-outline"
                size={18}
              />
            )}
            <Text style={styles.sendText}>
              {session ? (isSending ? 'Sending…' : 'Send to agent') : 'Agent unavailable'}
            </Text>
          </GlassControl>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#23252a' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 12, fontWeight: '800' },
  status: { color: colors.muted, fontSize: 9, textAlign: 'right' },
  liveRequired: {
    padding: 13,
    flexDirection: 'row',
    gap: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34373e',
    backgroundColor: '#17191e'
  },
  iconShell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1d2719',
    alignItems: 'center',
    justifyContent: 'center'
  },
  liveCopy: { flex: 1 },
  liveTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  liveText: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  waiting: {
    padding: 18,
    minHeight: 170,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#34373e',
    backgroundColor: '#15171b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  waitingTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 10 },
  waitingRequest: { color: '#c4c7cd', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 8 },
  waitingMeta: { color: colors.muted, fontSize: 9, marginTop: 8 },
  review: { gap: 10 },
  requestSummary: { padding: 12, borderRadius: 10, backgroundColor: '#16181c', borderWidth: 1, borderColor: '#303238' },
  requestSummaryText: { color: colors.text, fontSize: 11, lineHeight: 16, marginTop: 6 },
  fieldLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  variantOptions: { gap: 7 },
  variantOption: { minHeight: 44, borderRadius: 10 },
  variantOptionActive: { borderColor: colors.accent },
  variantOptionContent: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  variantLabel: { color: colors.text, fontSize: 11, fontWeight: '700' },
  variantLabelActive: { color: '#10130e', fontSize: 11, fontWeight: '900' },
  variantState: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  variantStateActive: { color: '#26301e', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  finalizing: {
    minHeight: 58,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    backgroundColor: '#192018'
  },
  finalizingText: { flex: 1, color: colors.text, fontSize: 10, lineHeight: 15 },
  compare: { minHeight: 44, borderRadius: 10 },
  compareContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  compareText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  reviewActions: { flexDirection: 'row', gap: 8 },
  reviewAction: { flex: 1, minHeight: 44, borderRadius: 10 },
  actionContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryActionText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  primaryActionText: { color: '#10130e', fontSize: 10, fontWeight: '900' },
  evidence: { borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 13, backgroundColor: '#16181c' },
  evidenceHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  evidenceName: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800' },
  evidenceMeta: { color: colors.muted, fontSize: 9, marginTop: 5 },
  evidenceCode: { color: '#b8bbc2', fontSize: 9, marginTop: 8 },
  clear: { width: 44, height: 44, borderRadius: 22, margin: -12 },
  clearContent: { alignItems: 'center', justifyContent: 'center' },
  empty: { minHeight: 78, borderRadius: 12 },
  emptyContent: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: colors.text, fontSize: 11, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  requestInput: {
    minHeight: 104,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#16181c',
    color: colors.text,
    padding: 12,
    textAlignVertical: 'top'
  },
  disabled: { opacity: 0.56 },
  variantField: { gap: 7 },
  countButtons: { flexDirection: 'row', gap: 6 },
  countButton: { width: 44, height: 44, borderRadius: 9 },
  countContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  countText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  countActive: { color: '#10130e', fontSize: 11, fontWeight: '900' },
  help: { color: colors.muted, fontSize: 9 },
  send: { minHeight: 46, borderRadius: 10 },
  sendContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  sendText: { color: '#10130e', fontSize: 11, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 10 }
});
