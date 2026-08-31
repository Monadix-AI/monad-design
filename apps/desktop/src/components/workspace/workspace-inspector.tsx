import AiProgrammingIcon from '@hugeicons/core-free-icons/AiProgrammingIcon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import CheckmarkCircle01Icon from '@hugeicons/core-free-icons/CheckmarkCircle01Icon';
import CursorRectangleSelection02Icon from '@hugeicons/core-free-icons/CursorRectangleSelection02Icon';
import { RadioGroup, ToggleGroup } from 'radix-ui';

import { ActionIcon } from '@/components/action-icon';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDesktopApp } from '@/desktop-app-provider';

export function WorkspaceInspector() {
  const {
    activeAgentSession,
    agentRequest,
    agentSessionError,
    axElementName,
    capturingVariant,
    changeWorkspaceMode,
    confirmSelectedVariant,
    discardAgentChange,
    isAXTreeOpen,
    isAnnotationMode,
    isSendingAgentRequest,
    isVariantPreviewOpen,
    selectedVariant,
    selectedAXElement,
    sendAgentRequest,
    setAgentRequest,
    setAXTreeOpen,
    setSelectedAXPath,
    setSelectedVariant,
    setVariantCount,
    variantCaptures,
    variantCount,
    variantError,
    variantIds,
    variantLabels,
    variantTransition
  } = useDesktopApp();
  const canRequestAgent = activeAgentSession?.status === 'awaiting_request';
  const isAgentWorking = activeAgentSession?.status === 'change_requested' || activeAgentSession?.status === 'working';
  const isReviewingVariants =
    activeAgentSession?.status === 'variants_ready' || activeAgentSession?.status === 'selection_confirmed';
  const selectionConfirmed = activeAgentSession?.status === 'selection_confirmed';

  return (
    <aside
      className={`floating-inspector ${isAnnotationMode ? 'annotation-only' : ''}`}
      data-canvas-ui
    >
      <section className="inspector-section">
        <div className="inspector-section-heading">
          <strong>Mode</strong>
          <span>
            {isAnnotationMode
              ? 'Annotate live view'
              : isVariantPreviewOpen
                ? 'Review variants'
                : isAXTreeOpen
                  ? 'Select runtime element'
                  : 'Control app'}
          </span>
        </div>
        <ToggleGroup.Root
          aria-label="Workspace mode"
          className="mode-switch"
          onValueChange={changeWorkspaceMode}
          type="single"
          value={isAnnotationMode ? 'annotate' : isAXTreeOpen ? 'select' : 'interact'}
        >
          <ToggleGroup.Item
            disabled={isVariantPreviewOpen || capturingVariant !== null}
            value="interact"
          >
            Interact
          </ToggleGroup.Item>
          <ToggleGroup.Item
            disabled={isVariantPreviewOpen || capturingVariant !== null}
            value="select"
          >
            Select
          </ToggleGroup.Item>
          <ToggleGroup.Item
            disabled={isVariantPreviewOpen || capturingVariant !== null}
            value="annotate"
          >
            Annotate
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </section>

      <section className="inspector-section prompt-workbench">
        <div className="inspector-section-heading">
          <strong>Request</strong>
          <span>
            {activeAgentSession
              ? activeAgentSession.status === 'awaiting_request'
                ? 'Agent connected · ready'
                : activeAgentSession.status === 'change_requested'
                  ? 'Request sent'
                  : activeAgentSession.status === 'working'
                    ? 'Agent is applying changes'
                    : activeAgentSession.status === 'variants_ready'
                      ? 'Variants ready for review'
                      : activeAgentSession.status === 'selection_confirmed'
                        ? 'Selection sent · agent is finalizing'
                        : 'Agent session active'
              : 'No responsive agent'}
          </span>
        </div>
        {!activeAgentSession && (
          <div
            className="agent-live-required"
            id="agent-live-required"
            role="status"
          >
            <ActionIcon icon={AiProgrammingIcon} />
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
            <span className="agent-waiting-orbit">
              <ActionIcon
                icon={AiProgrammingIcon}
                spinning
              />
            </span>
            <strong>
              {activeAgentSession.status === 'working' ? 'Agent is building variants' : 'Waiting for agent'}
            </strong>
            <p>{activeAgentSession.changeRequest?.request}</p>
            <small>
              Preparing Original + {activeAgentSession.changeRequest?.variantCount ?? variantCount}{' '}
              {(activeAgentSession.changeRequest?.variantCount ?? variantCount) === 1 ? 'variant' : 'variants'}
            </small>
          </div>
        ) : isReviewingVariants ? (
          <div className="agent-variant-review">
            <div className="agent-review-request">
              <span>Requested change</span>
              <p>{activeAgentSession.changeRequest?.request}</p>
            </div>
            <RadioGroup.Root
              aria-label="Select a variant in the panel"
              className="agent-variant-options"
              onValueChange={(value) => setSelectedVariant(value as (typeof variantIds)[number])}
              value={selectedVariant ?? ''}
            >
              {variantIds.map((variant) => {
                const captured = variantCaptures.some((capture) => capture.id === variant);
                return (
                  <RadioGroup.Item
                    className="agent-variant-option"
                    disabled={!captured || selectionConfirmed}
                    key={variant}
                    value={variant}
                  >
                    <span>{variantLabels[variant]}</span>
                    <small>{captured ? (selectedVariant === variant ? 'Selected' : 'Ready') : 'Waiting'}</small>
                  </RadioGroup.Item>
                );
              })}
            </RadioGroup.Root>
            {selectionConfirmed ? (
              <div
                className="agent-finalizing-state"
                role="status"
              >
                <ActionIcon
                  icon={AiProgrammingIcon}
                  spinning
                />
                <span>
                  {activeAgentSession.confirmedSelection?.variant === 'original'
                    ? 'Discard sent · agent is restoring the original'
                    : `${variantLabels[activeAgentSession.confirmedSelection?.variant ?? 'original']} accepted · agent is finalizing`}
                </span>
              </div>
            ) : (
              <div className="agent-review-actions">
                <Button
                  className="secondary-action"
                  disabled={capturingVariant !== null || variantTransition !== null}
                  onClick={() => void discardAgentChange()}
                  type="button"
                >
                  <ActionIcon icon={Cancel01Icon} />
                  {variantTransition === 'discarding' ? 'Discarding…' : 'Discard'}
                </Button>
                <Button
                  className="primary-action"
                  disabled={capturingVariant !== null || !selectedVariant || variantTransition !== null}
                  onClick={() => void confirmSelectedVariant()}
                  type="button"
                >
                  <ActionIcon icon={CheckmarkCircle01Icon} />
                  {variantTransition === 'confirming' ? 'Accepting…' : 'Accept'}
                </Button>
              </div>
            )}
            {variantError && (
              <p
                className="variant-error"
                role="alert"
              >
                {variantError}
              </p>
            )}
          </div>
        ) : selectedAXElement ? (
          <div className={`handoff-selection ${selectedAXElement.isContainer ? 'container' : ''}`}>
            <div>
              <strong>{axElementName(selectedAXElement)}</strong>
              <Button
                onClick={() => setSelectedAXPath(null)}
                type="button"
              >
                <ActionIcon icon={Cancel01Icon} />
                <span className="sr-only">Clear selection</span>
              </Button>
            </div>
            <span>{selectedAXElement.role || selectedAXElement.type}</span>
            <code>
              {Math.round(selectedAXElement.frame.width)} × {Math.round(selectedAXElement.frame.height)} at{' '}
              {Math.round(selectedAXElement.frame.x)}, {Math.round(selectedAXElement.frame.y)}
            </code>
          </div>
        ) : (
          <button
            className="selection-empty"
            onClick={() => setAXTreeOpen(true)}
            type="button"
          >
            <ActionIcon icon={CursorRectangleSelection02Icon} />
            <strong>{activeAgentSession ? 'No element selected' : 'Select an element on the simulator'}</strong>
            <span>
              {activeAgentSession
                ? 'The current screen accessibility context will be attached.'
                : 'Runtime geometry and accessibility evidence will be attached.'}
            </span>
          </button>
        )}

        {!isAgentWorking && !isReviewingVariants && (
          <Label
            className="handoff-request"
            htmlFor="canvas-agent-request"
          >
            <span>Adjustment request</span>
            <Textarea
              aria-describedby={!activeAgentSession ? 'agent-live-required' : undefined}
              disabled={!canRequestAgent}
              id="canvas-agent-request"
              onChange={(event) => {
                setAgentRequest(event.target.value);
              }}
              placeholder="Describe what should change and what must stay intact…"
              rows={5}
              value={agentRequest}
            />
          </Label>
        )}
        {!isAgentWorking && !isReviewingVariants && (
          <Label
            className="variant-count-field"
            htmlFor="canvas-agent-variant-count"
          >
            <span>Variants</span>
            <select
              aria-describedby={!activeAgentSession ? 'agent-live-required' : undefined}
              disabled={!canRequestAgent}
              id="canvas-agent-variant-count"
              onChange={(event) => setVariantCount(Number(event.target.value))}
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
        )}
        {!isAgentWorking && !isReviewingVariants && (
          <Button
            aria-describedby={!activeAgentSession ? 'agent-live-required' : undefined}
            className="copy-prompt-action"
            disabled={!canRequestAgent || !agentRequest.trim() || isSendingAgentRequest}
            onClick={() => void sendAgentRequest()}
            type="button"
          >
            <ActionIcon
              icon={activeAgentSession?.status === 'change_requested' ? CheckmarkCircle01Icon : AiProgrammingIcon}
              spinning={isSendingAgentRequest}
            />
            {activeAgentSession
              ? isSendingAgentRequest
                ? 'Sending…'
                : activeAgentSession.status === 'awaiting_request'
                  ? 'Send to agent'
                  : activeAgentSession.status === 'working'
                    ? 'Agent is working…'
                    : activeAgentSession.status === 'variants_ready'
                      ? 'Review variants'
                      : activeAgentSession.status === 'selection_confirmed'
                        ? 'Agent is finalizing…'
                        : 'Request sent'
              : 'Agent unavailable'}
          </Button>
        )}
        {agentSessionError && (
          <p
            className="agent-copy-error"
            role="alert"
          >
            {agentSessionError}
          </p>
        )}
      </section>
    </aside>
  );
}
