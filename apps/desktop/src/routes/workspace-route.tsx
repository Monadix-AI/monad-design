import FitToScreenIcon from '@hugeicons/core-free-icons/FitToScreenIcon';
import ZoomInIcon from '@hugeicons/core-free-icons/ZoomInIcon';
import ZoomOutIcon from '@hugeicons/core-free-icons/ZoomOutIcon';
import { CanvasZoomControls, LiveWorkspaceFrame, LiveWorkspaceHeading } from '@monaddesign/ui';
import { Navigate } from '@tanstack/react-router';

import { ActionIcon } from '@/components/action-icon';
import { AppHeader } from '@/components/app-header';
import { SimulatorCanvas } from '@/components/workspace/simulator-canvas';
import { VariantPreview } from '@/components/workspace/variant-preview';
import { WorkspaceInspector } from '@/components/workspace/workspace-inspector';
import { useDesktopApp } from '@/desktop-app-provider';

export function WorkspaceRoute() {
  const {
    activePreviewVariant,
    canvas,
    canvasScale,
    canvasScaleStep,
    canvasViewChanged,
    changeCanvasScale,
    connected,
    connection,
    disconnect,
    fitCanvas,
    error,
    finishCanvasDrag,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasWheel,
    isAnnotationMode,
    isCanvasDragging,
    isStreamReady,
    isVariantPreviewOpen,
    maximumCanvasScale,
    minimumCanvasScale,
    variantLabels
  } = useDesktopApp();

  if (!connection)
    return (
      <Navigate
        replace
        to="/"
      />
    );

  return (
    <LiveWorkspaceFrame
      canvas={<SimulatorCanvas />}
      canvasProps={{
        className: isCanvasDragging ? 'dragging' : undefined,
        onLostPointerCapture: finishCanvasDrag,
        onPointerCancel: finishCanvasDrag,
        onPointerDown: handleCanvasPointerDown,
        onPointerMove: handleCanvasPointerMove,
        onPointerUp: finishCanvasDrag,
        onWheel: handleCanvasWheel,
        ref: canvas
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
          {isVariantPreviewOpen && <VariantPreview />}
          <WorkspaceInspector />
          <CanvasZoomControls
            fitIcon={<ActionIcon icon={FitToScreenIcon} />}
            maximumScale={maximumCanvasScale}
            minimumScale={minimumCanvasScale}
            mode={isAnnotationMode ? 'annotate' : isVariantPreviewOpen ? 'variants' : 'interact'}
            onFit={() => {
              canvasViewChanged.current = false;
              fitCanvas();
            }}
            onZoomIn={() => changeCanvasScale(canvasScale + canvasScaleStep)}
            onZoomOut={() => changeCanvasScale(canvasScale - canvasScaleStep)}
            scale={canvasScale}
            zoomInIcon={<ActionIcon icon={ZoomInIcon} />}
            zoomOutIcon={<ActionIcon icon={ZoomOutIcon} />}
          />
        </>
      }
      mode={isAnnotationMode ? 'annotate' : isVariantPreviewOpen ? 'variants' : 'interact'}
    />
  );
}
