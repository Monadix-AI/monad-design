import AiProgrammingIcon from '@hugeicons/core-free-icons/AiProgrammingIcon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import CheckmarkCircle01Icon from '@hugeicons/core-free-icons/CheckmarkCircle01Icon';
import CursorRectangleSelection02Icon from '@hugeicons/core-free-icons/CursorRectangleSelection02Icon';
import { LiveWorkspaceInspector } from '@monaddesign/ui';

import { ActionIcon } from '@/components/action-icon';
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

  return (
    <LiveWorkspaceInspector
      agentError={
        agentSessionError ? (
          <p
            className="agent-copy-error"
            role="alert"
          >
            {agentSessionError}
          </p>
        ) : undefined
      }
      agentStatus={activeAgentSession?.status}
      confirmedVariant={activeAgentSession?.confirmedSelection?.variant}
      icons={{
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
        )
      }}
      isBusy={capturingVariant !== null}
      isSendingRequest={isSendingAgentRequest}
      mode={isAnnotationMode ? 'annotate' : isVariantPreviewOpen ? 'variants' : isAXTreeOpen ? 'select' : 'interact'}
      onAcceptVariant={() => void confirmSelectedVariant()}
      onBeginSelection={() => setAXTreeOpen(true)}
      onClearSelection={() => setSelectedAXPath(null)}
      onDiscardVariant={() => void discardAgentChange()}
      onModeChange={changeWorkspaceMode}
      onRequestChange={setAgentRequest}
      onSelectVariant={(variant) => setSelectedVariant(variant as (typeof variantIds)[number])}
      onSendRequest={() => void sendAgentRequest()}
      onVariantCountChange={setVariantCount}
      request={agentRequest}
      requestInFlight={activeAgentSession?.changeRequest?.request}
      selectedElement={
        selectedAXElement
          ? {
              frame: selectedAXElement.frame,
              isContainer: selectedAXElement.isContainer,
              name: axElementName(selectedAXElement),
              role: selectedAXElement.role,
              type: selectedAXElement.type
            }
          : null
      }
      selectedVariant={selectedVariant}
      variantCount={activeAgentSession?.changeRequest?.variantCount ?? variantCount}
      variantError={
        variantError ? (
          <p
            className="variant-error"
            role="alert"
          >
            {variantError}
          </p>
        ) : undefined
      }
      variants={variantIds.map((id) => ({
        id,
        label: variantLabels[id],
        ready: variantCaptures.some((capture) => capture.id === id)
      }))}
      variantTransition={variantTransition}
    />
  );
}
