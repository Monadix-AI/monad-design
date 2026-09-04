import { canvasScaleStep, maximumCanvasScale, minimumCanvasScale } from '@monaddesign/simulator';
import { LiveWorkspaceHeading } from '@monaddesign/ui/business/live-session/app-frame';
import { LiveWorkspace } from '@monaddesign/ui/business/live-session/workspace';
import { useLiveWorkspaceViewport } from '@monaddesign/ui/business/live-session/workspace-viewport';
import { Navigate } from '@tanstack/react-router';

import { AppHeader } from '@/components/app-header';
import { DesignDocumentCard } from '@/components/workspace/design-document-card';
import { useDesktopApp } from '@/desktop-app-provider';

export function WorkspaceRoute() {
  const { connection } = useDesktopApp();
  if (!connection)
    return (
      <Navigate
        replace
        to="/"
      />
    );

  return <WorkspaceContent />;
}

function WorkspaceContent() {
  const {
    activeAgentSession,
    activePreviewVariant,
    connection,
    connected,
    disconnect,
    endLive,
    error,
    isEndingLive,
    isStreamReady,
    isVariantPreviewOpen,
    variantComparison,
    variantLabels,
    workspaceInspector,
    workspaceMode,
    workspaceSimulator
  } = useDesktopApp();
  const viewport = useLiveWorkspaceViewport({
    deviceChrome: workspaceSimulator.deviceChrome,
    deviceHeight: workspaceSimulator.deviceHeight,
    deviceName: workspaceSimulator.deviceName,
    deviceWidth: workspaceSimulator.deviceWidth,
    mode: workspaceMode,
    orientation: workspaceSimulator.orientation,
    resetKey: connection?.udid
  });
  const { deviceFrame } = viewport;

  return (
    <LiveWorkspace
      activeSession={activeAgentSession ? { isEnding: isEndingLive, onEnd: () => void endLive() } : undefined}
      canvasProps={{
        className: viewport.isDragging ? 'dragging' : undefined,
        onLostPointerCapture: viewport.finishPointer,
        onPointerCancel: viewport.finishPointer,
        onPointerDown: viewport.handlePointerDown,
        onPointerMove: viewport.handlePointerMove,
        onPointerUp: viewport.finishPointer,
        onWheel: viewport.handleWheel,
        ref: viewport.canvas
      }}
      designDocument={<DesignDocumentCard />}
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
      inspector={workspaceInspector}
      mode={workspaceMode}
      simulator={{ ...workspaceSimulator, canvasOffset: viewport.offset, canvasScale: viewport.scale, deviceFrame }}
      variantComparison={
        isVariantPreviewOpen
          ? { ...variantComparison, deviceFrame, offset: viewport.offset, scale: viewport.scale }
          : undefined
      }
      zoomControls={{
        maximumScale: maximumCanvasScale,
        minimumScale: minimumCanvasScale,
        onFit: () => {
          viewport.viewChanged.current = false;
          viewport.fit();
        },
        onZoomIn: () => viewport.changeScale(viewport.scale + canvasScaleStep),
        onZoomOut: () => viewport.changeScale(viewport.scale - canvasScaleStep),
        scale: viewport.scale
      }}
    />
  );
}
