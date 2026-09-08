import { ChevronDown, FileText, Images, MousePointer2, SquareDashedMousePointer } from 'lucide-react';
import { AlertDialog, Collapsible } from 'radix-ui';
import { type HTMLAttributes, type ReactNode, type Ref, useRef, useState } from 'react';

import { Button } from '../../primitives/button';
import { CanvasZoomControls, type CanvasZoomControlsProps } from '../canvas-controls';
import { VariantComparison, type VariantComparisonProps } from '../variant-comparison';
import { LiveWorkspaceFrame } from './app-frame';
import { DesignGuidanceReview, DesignLibraryPicker } from './design-library';
import { LiveSimulatorWorkspaceCanvas, type LiveSimulatorWorkspaceCanvasProps } from './simulator-workspace-canvas';
import {
  LiveWorkspaceInspector,
  type LiveWorkspaceInspectorProps,
  type LiveWorkspaceMode
} from './workspace-inspector';

export interface LiveWorkspaceActiveSession {
  isEnding?: boolean;
  onEnd: () => void;
}

export interface LiveWorkspaceProps {
  activeSession?: LiveWorkspaceActiveSession;
  canvas?: ReactNode;
  canvasProps?: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };
  designDocument?: ReactNode;
  error?: ReactNode;
  header?: ReactNode;
  heading?: ReactNode;
  inspector: Omit<LiveWorkspaceInspectorProps, 'isEndingLive' | 'mode' | 'onEndLive'>;
  mode: LiveWorkspaceMode;
  preview?: ReactNode;
  simulator?: LiveSimulatorWorkspaceCanvasProps;
  showReferences?: boolean;
  variantComparison?: VariantComparisonProps;
  zoomControls: Omit<CanvasZoomControlsProps, 'mode'>;
}

/**
 * Canonical connected workspace presentation shared by Core and Desktop.
 * Runtime hooks adapt their transport and lifecycle details into this contract;
 * this component owns the DOM order and visual composition.
 */
export function LiveWorkspace({
  activeSession,
  canvas,
  canvasProps,
  designDocument,
  error,
  header,
  heading,
  inspector,
  mode,
  preview,
  simulator,
  showReferences = false,
  variantComparison,
  zoomControls
}: LiveWorkspaceProps) {
  const [confirmInteraction, setConfirmInteraction] = useState(false);
  const [annotationResetKey, setAnnotationResetKey] = useState(0);
  const annotationSubmit = useRef<(() => Promise<void>) | null>(null);
  const [annotationCount, setAnnotationCount] = useState(0);
  const [annotationToolsHost, setAnnotationToolsHost] = useState<HTMLDivElement | null>(null);
  const [annotationNotesHost, setAnnotationNotesHost] = useState<HTMLDivElement | null>(null);
  const [designOpen, setDesignOpen] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const reviewingGuidance = ['change_requested', 'working', 'variants_ready', 'selection_confirmed'].includes(
    inspector.agentStatus ?? ''
  );
  const toolsDisabled =
    mode === 'variants' || reviewingGuidance || Boolean(inspector.isBusy || inspector.isSendingRequest);
  const selectionLocked = mode === 'annotate' || annotationCount > 0;
  const changeTool = (tool: 'interact' | 'select' | 'annotate') => {
    if (toolsDisabled || (tool === 'select' && selectionLocked)) return;
    if (
      tool === 'interact' &&
      (inspector.selectedElement ||
        annotationCount > 0 ||
        inspector.request.trim() ||
        inspector.designLibrary?.selected.length ||
        inspector.designLibrary?.focus.trim() ||
        inspector.designLibrary?.preserve.trim())
    ) {
      setConfirmInteraction(true);
      return;
    }
    if (tool === 'interact') resetForInteraction();
    else inspector.onModeChange(tool);
  };
  const resetForInteraction = () => {
    if (toolsDisabled) return;
    setAnnotationResetKey((key) => key + 1);
    setAnnotationCount(0);
    inspector.onClearSelection();
    inspector.onRequestChange('');
    inspector.onVariantCountChange(1);
    inspector.designLibrary?.clearDraft?.();
    inspector.onModeChange('interact');
  };
  const canvasMode = mode === 'variants' ? 'variants' : 'interact';
  const workspaceCanvas =
    mode === 'variants'
      ? null
      : (canvas ??
        (simulator ? (
          <LiveSimulatorWorkspaceCanvas
            {...simulator}
            annotationNotesHost={annotationNotesHost}
            annotationResetKey={annotationResetKey}
            annotationSubmitRef={annotationSubmit}
            annotationToolsHost={annotationToolsHost}
            canSendAnnotation={
              inspector.agentStatus === 'awaiting_request' && !inspector.isBusy && !inspector.isSendingRequest
            }
            mode={reviewingGuidance && simulator.mode === 'annotate' ? 'interact' : simulator.mode}
            onActivateAnnotation={() => changeTool('annotate')}
            onAnnotationCountChange={setAnnotationCount}
            preserveAnnotations={!reviewingGuidance}
            toolsDisabled={toolsDisabled}
          />
        ) : null));
  return (
    <LiveWorkspaceFrame
      canvas={workspaceCanvas}
      canvasProps={canvasProps}
      error={error}
      header={header}
      heading={heading}
      inspector={
        <>
          {!toolsDisabled && (
            <div
              className="workspace-tool-rail"
              data-canvas-ui
            >
              <div
                aria-label="Workspace tools"
                aria-orientation="vertical"
                className="workspace-tools"
                role="toolbar"
              >
                {(
                  [
                    ['interact', 'Interact', MousePointer2],
                    ['select', 'Select', SquareDashedMousePointer]
                  ] as const
                ).map(([tool, label, Icon]) => (
                  <button
                    aria-label={label}
                    aria-pressed={mode === tool}
                    className="workspace-tool-button"
                    disabled={tool === 'select' && selectionLocked}
                    key={tool}
                    onClick={() => changeTool(tool)}
                    title={
                      tool === 'select' && selectionLocked
                        ? 'Return to Interact and clear the draft before selecting again'
                        : label
                    }
                    type="button"
                  >
                    <Icon className="workspace-tool-icon" />
                  </button>
                ))}
              </div>
              <div ref={setAnnotationToolsHost} />
            </div>
          )}
          {preview ?? (variantComparison ? <VariantComparison {...variantComparison} /> : null)}
          <div
            className="workspace-support-panels"
            data-canvas-ui
          >
            <WorkspaceSupportPanel
              icon={<FileText />}
              onOpenChange={setDesignOpen}
              open={designOpen}
              title="DESIGN.md"
            >
              {designDocument ?? <p className="sidebar-empty-state">Connect a project to view its DESIGN.md.</p>}
            </WorkspaceSupportPanel>
            {showReferences && (
              <WorkspaceSupportPanel
                icon={<Images />}
                onOpenChange={setReferencesOpen}
                open={referencesOpen}
                title="References"
              >
                <div className="workspace-reference-panel-body">
                  {reviewingGuidance && inspector.designGuidanceInFlight ? (
                    <DesignGuidanceReview guidance={inspector.designGuidanceInFlight} />
                  ) : inspector.designLibrary ? (
                    <DesignLibraryPicker
                      disabled={inspector.agentStatus !== 'awaiting_request' || Boolean(inspector.isSendingRequest)}
                      hasSelection={Boolean(inspector.selectedElement)}
                      library={inspector.designLibrary}
                      onDone={() => setReferencesOpen(false)}
                    />
                  ) : (
                    <p className="sidebar-empty-state">Connect a project to use design references.</p>
                  )}
                </div>
              </WorkspaceSupportPanel>
            )}
          </div>
          <LiveWorkspaceInspector
            {...inspector}
            annotationNotesHostRef={setAnnotationNotesHost}
            hasAnnotations={annotationCount > 0}
            isEndingLive={activeSession?.isEnding}
            mode={mode}
            onBeginSelection={() => changeTool('select')}
            onEndLive={activeSession?.onEnd}
            onOpenReferences={showReferences ? () => setReferencesOpen(true) : undefined}
            onSendRequest={() => {
              if (annotationCount > 0) void annotationSubmit.current?.();
              else inspector.onSendRequest();
            }}
            selectionLocked={selectionLocked}
          />
          <AlertDialog.Root
            onOpenChange={setConfirmInteraction}
            open={confirmInteraction}
          >
            <AlertDialog.Portal>
              <AlertDialog.Overlay
                className="workspace-reset-overlay"
                data-canvas-ui
              />
              <AlertDialog.Content
                className="workspace-reset-dialog"
                data-canvas-ui
              >
                <AlertDialog.Title className="workspace-reset-title">Clear draft and interact?</AlertDialog.Title>
                <AlertDialog.Description className="workspace-reset-description">
                  Returning to Interact clears the selected element, all annotations and notes, the request, and
                  attached references and goals.
                  <span className="workspace-reset-warning">This cannot be undone.</span>
                </AlertDialog.Description>
                <div className="workspace-reset-actions">
                  <AlertDialog.Cancel asChild>
                    <Button variant="secondary">Keep editing</Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action
                    asChild
                    disabled={toolsDisabled}
                    onClick={resetForInteraction}
                  >
                    <Button variant="destructive">Clear and interact</Button>
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
          <CanvasZoomControls
            {...zoomControls}
            mode={canvasMode}
          />
        </>
      }
      mode={canvasMode}
    />
  );
}

function WorkspaceSupportPanel({
  title,
  icon,
  open,
  onOpenChange,
  children
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible.Root
      className="workspace-support-panel"
      onOpenChange={onOpenChange}
      open={open}
    >
      <Collapsible.Trigger className="workspace-support-trigger">
        {icon}
        <span>{title}</span>
        <ChevronDown className="workspace-support-chevron" />
      </Collapsible.Trigger>
      <Collapsible.Content
        className="workspace-support-content"
        forceMount
      >
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
