import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import { LiveWorkspaceFrame } from '@monaddesign/ui';
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
    canvasDrag,
    connected,
    connection,
    disconnect,
    error,
    finishCanvasDrag,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasWheel,
    isAnnotationMode,
    isStreamReady,
    isVariantPreviewOpen,
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
        className: canvasDrag.current ? 'dragging' : undefined,
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
        <div
          className="canvas-page-heading"
          data-canvas-ui
        >
          <button
            className="page-back"
            onClick={disconnect}
            type="button"
          >
            <ActionIcon icon={ArrowLeft01Icon} />
            Simulators
          </button>
          <h1>{connected?.name ?? 'iOS Simulator'}</h1>
          <div
            className="live-device-status"
            role="status"
          >
            <span className={`connection-light ${isStreamReady ? 'online' : ''}`} />
            <span>{isStreamReady ? 'Live' : 'Starting stream…'}</span>
            {activePreviewVariant && <em>{variantLabels[activePreviewVariant]} · preview only</em>}
          </div>
        </div>
      }
      inspector={
        <>
          {isVariantPreviewOpen && <VariantPreview />}
          <WorkspaceInspector />
        </>
      }
      mode={isAnnotationMode ? 'annotate' : isVariantPreviewOpen ? 'variants' : 'interact'}
    />
  );
}
