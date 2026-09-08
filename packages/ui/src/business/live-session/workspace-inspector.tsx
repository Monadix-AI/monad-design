import type { DesignGuidance } from '@monaddesign/client-contract';
import type { DesignLibraryController } from './design-library';

import {
  AiProgrammingIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  CursorRectangleSelection02Icon
} from '@hugeicons/core-free-icons';
import { isAdjustmentGoal, resolveAdjustmentRequest } from '@monaddesign/client-contract';
import { ChevronDown } from 'lucide-react';
import { RadioGroup, Select } from 'radix-ui';
import { type ReactNode, type Ref } from 'react';

import { Button } from '../../primitives/button';
import { Label } from '../../primitives/label';
import { Textarea } from '../../primitives/textarea';
import { ActionIcon } from '../action-icon';
import { AdjustmentGoals } from './adjustment-goals';

export type LiveWorkspaceMode = 'annotate' | 'interact' | 'select' | 'variants';

export interface LiveWorkspaceInspectorElement {
  frame: { height: number; width: number; x: number; y: number };
  isContainer: boolean;
  name: string;
  role: string;
  type: string;
}

export interface LiveWorkspaceInspectorVariant {
  id: string;
  label: string;
  ready: boolean;
}

export interface LiveWorkspaceInspectorIcons {
  accept?: ReactNode;
  agent?: ReactNode;
  agentSpinning?: ReactNode;
  clear?: ReactNode;
  discard?: ReactNode;
  select?: ReactNode;
  sending?: ReactNode;
}

export interface LiveWorkspaceInspectorProps {
  hasAnnotations?: boolean;
  selectionLocked?: boolean;
  annotationNotesHostRef?: Ref<HTMLDivElement>;
  agentError?: ReactNode;
  agentStatus?:
    | 'awaiting_request'
    | 'change_requested'
    | 'closed'
    | 'configuring_project'
    | 'selecting_simulator'
    | 'selection_confirmed'
    | 'variants_ready'
    | 'working';
  confirmedVariant?: string;
  designLibrary?: DesignLibraryController;
  designGuidanceInFlight?: DesignGuidance;
  icons?: LiveWorkspaceInspectorIcons;
  isBusy?: boolean;
  isEndingLive?: boolean;
  isSendingRequest?: boolean;
  mode: LiveWorkspaceMode;
  onAcceptVariant: () => void;
  onBeginSelection: () => void;
  onClearSelection: () => void;
  onDiscardVariant: () => void;
  onEndLive?: () => void;
  onOpenReferences?: () => void;
  onModeChange: (mode: Exclude<LiveWorkspaceMode, 'variants'>) => void;
  onRequestChange: (request: string) => void;
  onSelectVariant: (variant: string) => void;
  onSendRequest: () => void;
  onVariantCountChange: (count: number) => void;
  request: string;
  requestInFlight?: string;
  selectedElement?: LiveWorkspaceInspectorElement | null;
  selectedVariant?: string | null;
  variantCount: number;
  variantCountControl?: 'system' | 'web';
  variantError?: ReactNode;
  variants?: LiveWorkspaceInspectorVariant[];
  variantTransition?: 'confirming' | 'discarding' | 'opening' | 'restoring' | null;
}

const agentStatusLabel = (status: LiveWorkspaceInspectorProps['agentStatus']) => {
  if (!status) return 'No responsive agent';
  if (status === 'awaiting_request') return 'Agent connected · ready';
  if (status === 'change_requested') return 'Request sent';
  if (status === 'working') return 'Agent is applying changes';
  if (status === 'variants_ready') return 'Variants ready for review';
  if (status === 'selection_confirmed') return 'Selection sent · agent is finalizing';
  return 'Agent session active';
};

export function LiveWorkspaceInspector({
  hasAnnotations = false,
  annotationNotesHostRef,
  agentError,
  agentStatus,
  confirmedVariant,
  designLibrary,
  designGuidanceInFlight,
  icons,
  isBusy = false,
  isEndingLive = false,
  isSendingRequest = false,
  onAcceptVariant,
  onClearSelection,
  onDiscardVariant,
  onEndLive,
  onOpenReferences,
  onRequestChange,
  onSelectVariant,
  onSendRequest,
  onVariantCountChange,
  request,
  requestInFlight,
  selectedElement,
  selectedVariant,
  variantCount,
  variantCountControl = 'web',
  variantError,
  variants = [],
  variantTransition = null
}: LiveWorkspaceInspectorProps) {
  const resolvedIcons: LiveWorkspaceInspectorIcons = {
    accept: <ActionIcon icon={CheckmarkCircle01Icon} />,
    agent: <ActionIcon icon={AiProgrammingIcon} />,
    agentSpinning: (
      <ActionIcon
        icon={AiProgrammingIcon}
        spinning
      />
    ),
    clear: <ActionIcon icon={Cancel01Icon} />,
    discard: <ActionIcon icon={Cancel01Icon} />,
    select: <ActionIcon icon={CursorRectangleSelection02Icon} />,
    sending: (
      <ActionIcon
        icon={AiProgrammingIcon}
        spinning
      />
    ),
    ...icons
  };
  const canRequestAgent = agentStatus === 'awaiting_request';
  const hasAdjustmentGoals = designLibrary?.selected.some(isAdjustmentGoal) ?? false;
  const effectiveRequest = resolveAdjustmentRequest(request, designLibrary?.selected);
  const isAgentWorking = agentStatus === 'change_requested' || agentStatus === 'working';
  const isReviewingVariants = agentStatus === 'variants_ready' || agentStatus === 'selection_confirmed';
  const selectionConfirmed = agentStatus === 'selection_confirmed';
  const activeVariant = variants.find(({ id }) => id === confirmedVariant || id === selectedVariant);
  const agentConnected = Boolean(agentStatus && agentStatus !== 'closed');
  const agentIndicator = !agentConnected
    ? 'Agent offline'
    : isAgentWorking
      ? 'Agent working'
      : selectionConfirmed
        ? 'Agent finalizing'
        : isReviewingVariants
          ? 'Ready for review'
          : canRequestAgent
            ? 'Agent ready'
            : 'Agent connected';

  return (
    <aside
      aria-label="Live workspace controls"
      className="floating-inspector compact"
      data-canvas-ui
    >
      {onOpenReferences && Boolean(designLibrary?.selected.length) && !isAgentWorking && !isReviewingVariants && (
        <button
          className="sidebar-reference-summary"
          onClick={onOpenReferences}
          type="button"
        >
          {designLibrary?.selected.length} design {designLibrary?.selected.length === 1 ? 'reference' : 'references'}{' '}
          attached · View
        </button>
      )}
      <section className="inspector-section prompt-workbench prompt-workbench-polished prompt-workbench-delight-trace prompt-workbench-animated-cascade">
        <div className="inspector-section-heading">
          <strong>{isReviewingVariants ? 'Review request' : 'Change request'}</strong>
        </div>
        {(isAgentWorking || isReviewingVariants) && designGuidanceInFlight?.references.some(isAdjustmentGoal) && (
          <details className="adjustment-goal-guidance">
            <summary>
              Requested goals · {designGuidanceInFlight.scope === 'screen' ? 'Current screen' : 'Selected element'}
            </summary>
            {designGuidanceInFlight.references.filter(isAdjustmentGoal).map((goal) => (
              <div key={goal.id}>
                <strong>{goal.title}</strong>
                <p>{goal.instructions}</p>
                {goal.skillName && <small>{goal.skillName}</small>}
              </div>
            ))}
          </details>
        )}
        {!agentConnected && (
          <div
            className="agent-live-required"
            id="agent-live-required"
            role="status"
          >
            {resolvedIcons.agent}
            <div>
              <strong>Start Live in your coding agent</strong>
              <span>Open this project in your agent, then run /monad-design to enable editing and sending.</span>
            </div>
          </div>
        )}
        {isAgentWorking ? (
          <div
            aria-live="polite"
            className="agent-waiting-state"
            role="status"
          >
            <span className="agent-waiting-orbit">{resolvedIcons.agentSpinning ?? resolvedIcons.agent}</span>
            <strong>{agentStatus === 'working' ? 'Agent is building variants' : 'Waiting for agent'}</strong>
            <p>{requestInFlight}</p>
            <small>
              Preparing Original + {variantCount} {variantCount === 1 ? 'variant' : 'variants'}
            </small>
          </div>
        ) : isReviewingVariants ? (
          <div className="agent-variant-review">
            <div className="agent-review-request">
              <span>Requested change</span>
              <p>{requestInFlight}</p>
            </div>
            <RadioGroup.Root
              aria-label="Select a variant in the panel"
              className="agent-variant-options"
              onValueChange={onSelectVariant}
              value={selectedVariant ?? ''}
            >
              {variants.map((variant) => (
                <RadioGroup.Item
                  className="agent-variant-option"
                  disabled={!variant.ready || selectionConfirmed}
                  key={variant.id}
                  value={variant.id}
                >
                  <span>{variant.label}</span>
                  <small>{variant.ready ? (selectedVariant === variant.id ? 'Selected' : 'Ready') : 'Waiting'}</small>
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
            {selectionConfirmed ? (
              <div
                className="agent-finalizing-state"
                role="status"
              >
                {resolvedIcons.agentSpinning ?? resolvedIcons.agent}
                <span>
                  {confirmedVariant === 'original'
                    ? 'Discard sent · agent is restoring the original'
                    : `${activeVariant?.label ?? 'Selection'} accepted · agent is finalizing`}
                </span>
              </div>
            ) : (
              <div className="agent-review-actions">
                <Button
                  className="secondary-action"
                  disabled={isBusy || variantTransition !== null}
                  onClick={onDiscardVariant}
                  type="button"
                >
                  {resolvedIcons.discard}
                  {variantTransition === 'discarding' ? 'Discarding…' : 'Discard'}
                </Button>
                <Button
                  className="primary-action"
                  disabled={isBusy || !selectedVariant || variantTransition !== null}
                  onClick={onAcceptVariant}
                  type="button"
                >
                  {resolvedIcons.accept}
                  {variantTransition === 'confirming' ? 'Accepting…' : 'Accept'}
                </Button>
              </div>
            )}
            {typeof variantError === 'string' ? (
              <p
                className="variant-error"
                role="alert"
              >
                {variantError}
              </p>
            ) : (
              variantError
            )}
          </div>
        ) : selectedElement ? (
          <div className={`handoff-selection ${selectedElement.isContainer ? 'container' : ''}`}>
            <span>Selected element</span>
            <div>
              <strong>{selectedElement.name}</strong>
              <Button
                disabled={isBusy || isSendingRequest}
                onClick={onClearSelection}
                title="Remove selected element"
                type="button"
              >
                {resolvedIcons.clear}
                <span className="sr-only">Clear selection</span>
              </Button>
            </div>
            <span>{selectedElement.role || selectedElement.type}</span>
            <code>
              {Math.round(selectedElement.frame.width)} × {Math.round(selectedElement.frame.height)} at{' '}
              {Math.round(selectedElement.frame.x)}, {Math.round(selectedElement.frame.y)}
            </code>
          </div>
        ) : null}

        {hasAnnotations && !isAgentWorking && !isReviewingVariants && (
          <section
            aria-label="Implementation notes"
            className="inspector-annotation-body"
            ref={annotationNotesHostRef}
          />
        )}
        {!isAgentWorking && !isReviewingVariants && (
          <div className="request-composer">
            {designLibrary && (
              <AdjustmentGoals
                disabled={!canRequestAgent || isBusy || isSendingRequest}
                library={designLibrary}
              />
            )}
            <Label
              className="handoff-request"
              htmlFor="canvas-agent-request"
            >
              <span>Adjustment request</span>
              <Textarea
                aria-describedby={!agentConnected ? 'agent-live-required' : undefined}
                disabled={!canRequestAgent}
                id="canvas-agent-request"
                onChange={(event) => onRequestChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === '@' && designLibrary && onOpenReferences) {
                    event.preventDefault();
                    onOpenReferences?.();
                  }
                }}
                placeholder={
                  hasAdjustmentGoals
                    ? 'Optional: describe the result you want and what must stay intact…'
                    : 'Describe what should change and what must stay intact…'
                }
                rows={5}
                value={request}
              />
            </Label>
            <Label
              className="variant-count-field"
              htmlFor="canvas-agent-variant-count"
            >
              <span>Variants</span>
              {variantCountControl === 'system' ? (
                <select
                  aria-describedby={!agentConnected ? 'agent-live-required' : undefined}
                  className="variant-count-native"
                  disabled={!canRequestAgent}
                  id="canvas-agent-variant-count"
                  onChange={(event) => onVariantCountChange(Number(event.target.value))}
                  value={variantCount}
                >
                  {[1, 2, 3, 4, 5].map((count) => (
                    <option
                      key={count}
                      value={count}
                    >
                      {count}
                    </option>
                  ))}
                </select>
              ) : (
                <Select.Root
                  disabled={!canRequestAgent}
                  onValueChange={(value) => onVariantCountChange(Number(value))}
                  value={String(variantCount)}
                >
                  <Select.Trigger
                    aria-describedby={!agentConnected ? 'agent-live-required' : undefined}
                    className="variant-count-trigger"
                    id="canvas-agent-variant-count"
                  >
                    <Select.Value />
                    <Select.Icon asChild>
                      <ChevronDown aria-hidden="true" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content
                      className="variant-count-menu"
                      position="popper"
                      sideOffset={4}
                    >
                      <Select.Viewport className="variant-count-options">
                        {[1, 2, 3, 4, 5].map((count) => (
                          <Select.Item
                            className="variant-count-option"
                            key={count}
                            value={String(count)}
                          >
                            <Select.ItemText>{count}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              )}
              <small>Generate 1–5 alternatives. Default: 1.</small>
            </Label>
          </div>
        )}
        {!isAgentWorking && !isReviewingVariants && (
          <div className="request-footer">
            <Button
              aria-describedby={!agentConnected ? 'agent-live-required' : undefined}
              className="copy-prompt-action"
              disabled={!canRequestAgent || (!effectiveRequest.trim() && !hasAnnotations) || isSendingRequest || isBusy}
              onClick={onSendRequest}
              type="button"
            >
              {isSendingRequest ? (resolvedIcons.sending ?? resolvedIcons.agentSpinning) : resolvedIcons.agent}
              {isSendingRequest
                ? 'Sending…'
                : canRequestAgent
                  ? 'Send to agent'
                  : agentConnected
                    ? 'Request sent'
                    : 'Agent unavailable'}
            </Button>
          </div>
        )}
        {typeof agentError === 'string' ? (
          <p
            className="agent-copy-error"
            role="alert"
          >
            {agentError}
          </p>
        ) : (
          agentError
        )}
      </section>
      <footer className="live-session-footer">
        <span
          className={`agent-connection-status ${agentConnected ? 'connected' : 'offline'} ${isAgentWorking || selectionConfirmed ? 'working' : ''}`}
          role="status"
          title={agentStatusLabel(agentStatus)}
        >
          <i aria-hidden="true" />
          {agentIndicator}
        </span>
        {onEndLive && (
          <Button
            className="end-live-action"
            disabled={isEndingLive}
            onClick={onEndLive}
            type="button"
            variant="ghost"
          >
            {isEndingLive ? 'Ending live…' : 'End live'}
          </Button>
        )}
      </footer>
    </aside>
  );
}
