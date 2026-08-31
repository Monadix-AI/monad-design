import ArrowUpRight01Icon from '@hugeicons/core-free-icons/ArrowUpRight01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import EllipseIcon from '@hugeicons/core-free-icons/EllipseIcon';
import FitToScreenIcon from '@hugeicons/core-free-icons/FitToScreenIcon';
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon';
import Moon02Icon from '@hugeicons/core-free-icons/Moon02Icon';
import RotateCcwIcon from '@hugeicons/core-free-icons/RotateCcwIcon';
import RotateCwIcon from '@hugeicons/core-free-icons/RotateCwIcon';
import SquareIcon from '@hugeicons/core-free-icons/SquareIcon';
import Sun03Icon from '@hugeicons/core-free-icons/Sun03Icon';
import TextIcon from '@hugeicons/core-free-icons/TextIcon';
import Undo02Icon from '@hugeicons/core-free-icons/Undo02Icon';
import ZoomInIcon from '@hugeicons/core-free-icons/ZoomInIcon';
import ZoomOutIcon from '@hugeicons/core-free-icons/ZoomOutIcon';
import {
  CanvasZoomControls,
  LiveAnnotationSurface,
  liveWorkspaceCanvasPlacement,
  SimulatorCanvas as SharedSimulatorCanvas,
  SimulatorDeviceControls
} from '@monaddesign/ui';
import { useMemo } from 'react';

import { ActionIcon } from '@/components/action-icon';
import { useDesktopApp } from '@/desktop-app-provider';

export function SimulatorCanvas() {
  const app = useDesktopApp();
  const deviceChrome = app.connected?.deviceChrome;
  const axSnapshot = app.axSnapshot;
  const canvasMode = app.isAnnotationMode ? 'annotate' : app.isVariantPreviewOpen ? 'variants' : 'interact';
  const canvasPlacement = liveWorkspaceCanvasPlacement(canvasMode);
  const annotationSize = useMemo(
    () => ({ width: app.deviceWidth, height: app.deviceHeight }),
    [app.deviceHeight, app.deviceWidth]
  );
  const selectionOverlay = !app.isAnnotationMode ? (
    <>
      {app.isAXTreeOpen && axSnapshot && (
        <span
          aria-hidden="true"
          className="ax-overlay"
        >
          {axSnapshot.elements.map((element) => (
            <span
              className={`ax-element-box ${element.isContainer ? 'container' : ''} ${element.path === app.hoveredAXPath ? 'hovered' : ''} ${element.path === app.selectedAXPath ? 'selected' : ''}`}
              key={`${element.path}-${element.id}`}
              style={{
                left: `${(element.frame.x / axSnapshot.screen.width) * 100}%`,
                top: `${(element.frame.y / axSnapshot.screen.height) * 100}%`,
                width: `${(element.frame.width / axSnapshot.screen.width) * 100}%`,
                height: `${(element.frame.height / axSnapshot.screen.height) * 100}%`
              }}
            />
          ))}
        </span>
      )}
      {app.isAXTreeOpen && (!axSnapshot || app.axError) && (
        <span
          className="selection-status"
          role="status"
        >
          {app.axError ? 'Selection unavailable. Reconnect and try again.' : 'Preparing selection…'}
        </span>
      )}
    </>
  ) : null;
  const controls = (
    <SimulatorDeviceControls
      appearance={app.appearance ?? 'light'}
      appearanceIcon={<ActionIcon icon={app.appearance === 'dark' ? Moon02Icon : Sun03Icon} />}
      homeIcon={<ActionIcon icon={Home01Icon} />}
      isAppearanceChanging={app.isAppearanceChanging}
      onChangeAppearance={() => void app.changeAppearance(app.appearance === 'dark' ? 'light' : 'dark')}
      onHome={() => app.sendFrame(0x04, { button: 'home' })}
      onRotateLeft={() => app.rotate('left')}
      onRotateRight={() => app.rotate('right')}
      rotateLeftIcon={<ActionIcon icon={RotateCcwIcon} />}
      rotateRightIcon={<ActionIcon icon={RotateCwIcon} />}
      scale={app.canvasScale}
    />
  );

  return (
    <LiveAnnotationSurface
      active={app.isAnnotationMode}
      captureImage={app.captureSimulatorImage}
      icons={{
        cancel: <ActionIcon icon={Cancel01Icon} />,
        clear: <ActionIcon icon={Delete02Icon} />,
        finish: <ActionIcon icon={ArrowUpRight01Icon} />,
        finishing: (
          <ActionIcon
            icon={ArrowUpRight01Icon}
            spinning
          />
        ),
        tools: {
          arrow: <ActionIcon icon={ArrowUpRight01Icon} />,
          ellipse: <ActionIcon icon={EllipseIcon} />,
          rectangle: <ActionIcon icon={SquareIcon} />,
          text: <ActionIcon icon={TextIcon} />
        },
        undo: <ActionIcon icon={Undo02Icon} />
      }}
      imageSize={annotationSize}
      onCancel={app.closeAnnotation}
      onFinish={async (annotationScreenshot) => {
        await app.sendAnnotatedAgentRequest(annotationScreenshot);
        app.closeAnnotation();
      }}
      orientation={app.orientation}
    >
      {(annotationOverlay) => (
        <>
          <div
            className={`device-cluster canvas-mode-${canvasMode}`}
            data-canvas-ui
            style={{
              left: `calc(${canvasPlacement.left} + ${app.canvasOffset.x}px)`,
              top: `calc(50% + ${app.canvasOffset.y}px)`,
              transform: `translate(-50%, -50%) scale(${app.canvasScale * canvasPlacement.scale})`
            }}
          >
            <SharedSimulatorCanvas
              ariaLabel={`${app.connected?.name ?? 'iOS Simulator'} ${app.isAnnotationMode ? 'annotation surface' : 'interactive screen'}`}
              controls={controls}
              deviceChrome={deviceChrome}
              deviceFrame={app.deviceFrame}
              deviceHeight={app.deviceHeight}
              deviceWidth={app.deviceWidth}
              framebufferMask={app.connected?.framebufferMask}
              onKeyDown={app.isAnnotationMode ? undefined : (event) => app.handleKey(event, 'down')}
              onKeyUp={app.isAnnotationMode ? undefined : (event) => app.handleKey(event, 'up')}
              onPaste={app.isAnnotationMode ? undefined : app.handlePaste}
              onPointerCancel={app.isAnnotationMode ? undefined : app.finishPointer}
              onPointerDown={app.isAnnotationMode ? undefined : app.handlePointerDown}
              onPointerLeave={app.isAnnotationMode ? undefined : app.leavePointer}
              onPointerMove={app.isAnnotationMode ? undefined : app.handlePointerMove}
              onPointerUp={app.isAnnotationMode ? undefined : app.finishPointer}
              onStreamError={() => app.setError('The simulator video stream stopped.')}
              onStreamLoad={() => app.setIsStreamReady(true)}
              orientation={app.orientation}
              overlay={app.isAnnotationMode ? annotationOverlay : selectionOverlay}
              pointer={
                !app.isAnnotationMode && app.pointerPosition
                  ? { ...app.pointerPosition, pressed: app.pointerActive.current }
                  : null
              }
              screenClassName={`phone-frame interactive canvas-phone device-${app.deviceFrame.kind} ${deviceChrome ? 'native-device-chrome' : ''}`}
              screenImageRef={app.screenImage}
              streamUrl={app.connection?.streamUrl ?? ''}
            />
          </div>
          <CanvasZoomControls
            fitIcon={<ActionIcon icon={FitToScreenIcon} />}
            maximumScale={app.maximumCanvasScale}
            minimumScale={app.minimumCanvasScale}
            mode={canvasMode}
            onFit={() => {
              app.canvasViewChanged.current = false;
              app.fitCanvas();
            }}
            onZoomIn={() => app.changeCanvasScale(app.canvasScale + app.canvasScaleStep)}
            onZoomOut={() => app.changeCanvasScale(app.canvasScale - app.canvasScaleStep)}
            scale={app.canvasScale}
            zoomInIcon={<ActionIcon icon={ZoomInIcon} />}
            zoomOutIcon={<ActionIcon icon={ZoomOutIcon} />}
          />
        </>
      )}
    </LiveAnnotationSurface>
  );
}
