import FitToScreenIcon from '@hugeicons/core-free-icons/FitToScreenIcon';
import ZoomInIcon from '@hugeicons/core-free-icons/ZoomInIcon';
import ZoomOutIcon from '@hugeicons/core-free-icons/ZoomOutIcon';
import { canvasScaleStep, maximumCanvasScale, minimumCanvasScale } from '@monaddesign/simulator';
import { CanvasZoomControls } from '@monaddesign/ui/business/canvas-controls';
import { LiveWorkspaceFrame, LiveWorkspaceHeading } from '@monaddesign/ui/business/live-session/app-frame';
import { Navigate } from '@tanstack/react-router';

import {
  CanvasViewportProvider,
  useCanvasViewportActions,
  useCanvasViewportDragging,
  useCanvasViewportScale
} from '@/canvas-viewport-provider';
import { ActionIcon } from '@/components/action-icon';
import { AppHeader } from '@/components/app-header';
import { DesignDocumentCard } from '@/components/workspace/design-document-card';
import { SimulatorCanvas } from '@/components/workspace/simulator-canvas';
import { VariantPreview } from '@/components/workspace/variant-preview';
import { WorkspaceInspector } from '@/components/workspace/workspace-inspector';
import { useDesktopApp } from '@/desktop-app-provider';
import { workspaceCanvasMode } from '@/desktop-model';

export function WorkspaceRoute() {
  const { connection } = useDesktopApp();
  if (!connection)
    return (
      <Navigate
        replace
        to="/"
      />
    );

  return (
    <CanvasViewportProvider>
      <WorkspaceContent />
    </CanvasViewportProvider>
  );
}

function WorkspaceContent() {
  const {
    activePreviewVariant,
    connected,
    disconnect,
    error,
    isAnnotationMode,
    isStreamReady,
    isVariantPreviewOpen,
    variantLabels
  } = useDesktopApp();
  const viewport = useCanvasViewportActions();
  const isCanvasDragging = useCanvasViewportDragging();
  const canvasMode = workspaceCanvasMode(isAnnotationMode, isVariantPreviewOpen);

  return (
    <LiveWorkspaceFrame
      canvas={<SimulatorCanvas />}
      canvasProps={{
        className: isCanvasDragging ? 'dragging' : undefined,
        onLostPointerCapture: viewport.finishPointer,
        onPointerCancel: viewport.finishPointer,
        onPointerDown: viewport.handlePointerDown,
        onPointerMove: viewport.handlePointerMove,
        onPointerUp: viewport.finishPointer,
        onWheel: viewport.handleWheel,
        ref: viewport.canvas
      }}
      error={error}
      header={<AppHeader />}
      heading={
        <LiveWorkspaceHeading
          isLive={isStreamReady}
          name={connected?.name ?? 'iOS Simulator'}
          onBack={disconnect}
          previewLabel={activePreviewVariant ? variantLabels[activePreviewVariant] : undefined}
        />
      }
      inspector={
        <>
          <DesignDocumentCard />
          {isVariantPreviewOpen && <VariantPreview />}
          <WorkspaceInspector />
          <WorkspaceCanvasControls />
        </>
      }
      mode={canvasMode}
    />
  );
}

function WorkspaceCanvasControls() {
  const { isAnnotationMode, isVariantPreviewOpen } = useDesktopApp();
  const viewport = useCanvasViewportActions();
  const canvasScale = useCanvasViewportScale();
  const canvasMode = workspaceCanvasMode(isAnnotationMode, isVariantPreviewOpen);

  return (
    <CanvasZoomControls
      fitIcon={<ActionIcon icon={FitToScreenIcon} />}
      maximumScale={maximumCanvasScale}
      minimumScale={minimumCanvasScale}
      mode={canvasMode}
      onFit={() => {
        viewport.markViewUnchanged();
        viewport.fit();
      }}
      onZoomIn={() => viewport.changeScale(canvasScale + canvasScaleStep)}
      onZoomOut={() => viewport.changeScale(canvasScale - canvasScaleStep)}
      scale={canvasScale}
      zoomInIcon={<ActionIcon icon={ZoomInIcon} />}
      zoomOutIcon={<ActionIcon icon={ZoomOutIcon} />}
    />
  );
}
