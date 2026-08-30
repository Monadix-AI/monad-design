import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
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
    <main className="app-shell connected-shell">
      <AppHeader />

      <div
        className={`free-canvas ${canvasDrag.current ? 'dragging' : ''} ${isAnnotationMode ? 'annotation-mode' : isVariantPreviewOpen ? 'variant-mode' : 'interact-mode'}`}
        onPointerCancel={finishCanvasDrag}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={finishCanvasDrag}
        onWheel={handleCanvasWheel}
        ref={canvas}
      >
        {!isAnnotationMode && !isVariantPreviewOpen && (
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
        )}

        <SimulatorCanvas />

        {isVariantPreviewOpen && <VariantPreview />}

        <WorkspaceInspector />

        {error && (
          <div
            className="canvas-error"
            data-canvas-ui
            role="alert"
          >
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
