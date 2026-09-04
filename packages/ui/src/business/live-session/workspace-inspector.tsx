import type { ReactNode, Ref } from 'react';

import AiProgrammingIcon from '@hugeicons/core-free-icons/AiProgrammingIcon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import CheckmarkCircle01Icon from '@hugeicons/core-free-icons/CheckmarkCircle01Icon';
import CursorRectangleSelection02Icon from '@hugeicons/core-free-icons/CursorRectangleSelection02Icon';
import { RadioGroup, ToggleGroup } from 'radix-ui';

import { Button } from '../../primitives/button';
import { Label } from '../../primitives/label';
import { Textarea } from '../../primitives/textarea';
import { ActionIcon } from '../action-icon';

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
  annotationNotesHostRef,
  agentError,
  agentStatus,
  confirmedVariant,
  icons,
  isBusy = false,
  isEndingLive = false,
  isSendingRequest = false,
  mode,
  onAcceptVariant,
  onBeginSelection,
  onClearSelection,
  onDiscardVariant,
  onEndLive,
  onModeChange,
  onRequestChange,
  onSelectVariant,
  onSendRequest,
  onVariantCountChange,
  request,
  requestInFlight,
  selectedElement,
  selectedVariant,
  variantCount,
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
  const isAgentWorking = agentStatus === 'change_requested' || agentStatus === 'working';
  const isReviewingVariants = agentStatus === 'variants_ready' || agentStatus === 'selection_confirmed';
  const selectionConfirmed = agentStatus === 'selection_confirmed';
  const activeVariant = variants.find(({ id }) => id === confirmedVariant || id === selectedVariant);
  const modeLabel =
    mode === 'annotate'
      ? 'Annotating live view'
      : mode === 'variants'
        ? 'Reviewing variants'
        : mode === 'select'
          ? 'Selecting runtime element'
          : 'Controlling app';

  return (
    <aside
      aria-label="Live workspace controls"
      className={`floating-inspector compact ${mode === 'annotate' ? 'annotation-only' : ''}`}
      data-canvas-ui
    >
      <header className="inspector-command-header">
        <div className="inspector-command-title">
          <div>
            <strong>Live workspace</strong>
            <span>{modeLabel}</span>
          </div>
          <span
            className={`agent-connection-status ${agentStatus ? 'connected' : 'offline'}`}
            title={agentStatusLabel(agentStatus)}
          >
            <i aria-hidden="true" />
            {agentStatus ? 'Agent live' : 'Agent offline'}
          </span>
        </div>
        <ToggleGroup.Root
          aria-label="Workspace mode"
          className="mode-switch"
          onValueChange={(value) => {
            if (value === 'annotate' || value === 'interact' || value === 'select') onModeChange(value);
          }}
          type="single"
          value={mode === 'variants' ? 'interact' : mode}
        >
          {(['interact', 'select', 'annotate'] as const).map((value) => (
            <ToggleGroup.Item
              disabled={mode === 'variants' || isBusy}
              key={value}
              value={value}
            >
              {value.slice(0, 1).toUpperCase() + value.slice(1)}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </header>

      {mode === 'annotate' ? (
        <section
          aria-label="Implementation notes"
          className="inspector-annotation-body"
          ref={annotationNotesHostRef}
        />
      ) : (
        <section className="inspector-section prompt-workbench prompt-workbench-polished prompt-workbench-delight-trace prompt-workbench-animated-cascade">
          <div className="inspector-section-heading">
            <strong>{isReviewingVariants ? 'Review request' : 'Change request'}</strong>
            <span>{agentStatusLabel(agentStatus)}</span>
          </div>
          {!agentStatus && (
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
              <div>
                <strong>{selectedElement.name}</strong>
                <Button
                  onClick={onClearSelection}
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
          ) : (
            <button
              className="selection-empty"
              onClick={onBeginSelection}
              type="button"
            >
              {resolvedIcons.select}
              <strong>{agentStatus ? 'No element selected' : 'Select an element on the simulator'}</strong>
              <span>
                {agentStatus
                  ? 'The current screen accessibility context will be attached.'
                  : 'Runtime geometry and accessibility evidence will be attached.'}
              </span>
            </button>
          )}

          {!isAgentWorking && !isReviewingVariants && (
            <div className="request-composer">
              <Label
                className="handoff-request"
                htmlFor="canvas-agent-request"
              >
                <span>Adjustment request</span>
                <Textarea
                  aria-describedby={!agentStatus ? 'agent-live-required' : undefined}
                  disabled={!canRequestAgent}
                  id="canvas-agent-request"
                  onChange={(event) => onRequestChange(event.target.value)}
                  placeholder="Describe what should change and what must stay intact…"
                  rows={5}
                  value={request}
                />
              </Label>
              <Label
                className="variant-count-field"
                htmlFor="canvas-agent-variant-count"
              >
                <span>Variants</span>
                <select
                  aria-describedby={!agentStatus ? 'agent-live-required' : undefined}
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
                <small>Generate 1–5 alternatives. Default: 1.</small>
              </Label>
            </div>
          )}
          {!isAgentWorking && !isReviewingVariants && (
            <div className="request-footer">
              <Button
                aria-describedby={!agentStatus ? 'agent-live-required' : undefined}
                className="copy-prompt-action"
                disabled={!canRequestAgent || !request.trim() || isSendingRequest}
                onClick={onSendRequest}
                type="button"
              >
                {isSendingRequest ? (resolvedIcons.sending ?? resolvedIcons.agentSpinning) : resolvedIcons.agent}
                {isSendingRequest
                  ? 'Sending…'
                  : canRequestAgent
                    ? 'Send to agent'
                    : agentStatus
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
      )}
      {onEndLive && (
        <section className="live-session-footer">
          <Button
            className="end-live-action"
            disabled={isEndingLive}
            onClick={onEndLive}
            type="button"
            variant="ghost"
          >
            {isEndingLive ? 'Ending live…' : 'End live'}
          </Button>
        </section>
      )}
    </aside>
  );
}
