import { ChevronDown, FileText, Images } from 'lucide-react';
import { Collapsible } from 'radix-ui';
import { type HTMLAttributes, type ReactNode, type Ref, useState } from 'react';

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
  const [annotationNotesHost, setAnnotationNotesHost] = useState<HTMLDivElement | null>(null);
  const [designOpen, setDesignOpen] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const reviewingGuidance = ['change_requested', 'working', 'variants_ready', 'selection_confirmed'].includes(
    inspector.agentStatus ?? ''
  );
  const canvasMode = mode === 'select' ? 'interact' : mode;
  const workspaceCanvas =
    mode === 'variants'
      ? null
      : (canvas ??
        (simulator ? (
          <LiveSimulatorWorkspaceCanvas
            {...simulator}
            annotationNotesHost={annotationNotesHost}
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
            isEndingLive={activeSession?.isEnding}
            mode={mode}
            onEndLive={activeSession?.onEnd}
            onOpenReferences={showReferences ? () => setReferencesOpen(true) : undefined}
          />
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
