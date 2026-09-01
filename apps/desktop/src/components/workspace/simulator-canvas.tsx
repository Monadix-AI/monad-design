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
import { canvasScaleStep, maximumCanvasScale, minimumCanvasScale, normalizedCanvasPoint } from '@monaddesign/simulator';
import { LiveAnnotationSurface } from '@monaddesign/ui/business/annotation/live-surface';
import {
  CanvasZoomControls,
  liveWorkspaceCanvasPlacement,
  SimulatorDeviceControls
} from '@monaddesign/ui/business/canvas-controls';
import { SimulatorCanvas as SharedSimulatorCanvas } from '@monaddesign/ui/business/simulator-canvas';
import { type PointerEvent, useMemo, useState } from 'react';

import { useCanvasViewportActions, useCanvasViewportOffset, useCanvasViewportScale } from '@/canvas-viewport-provider';
import { ActionIcon } from '@/components/action-icon';
import { useDesktopApp } from '@/desktop-app-provider';
import { workspaceCanvasMode } from '@/desktop-model';

export function SimulatorCanvas() {
  const app = useDesktopApp();
  const viewport = useCanvasViewportActions();
  const canvasOffset = useCanvasViewportOffset();
  const canvasScale = useCanvasViewportScale();
  const [pointer, setPointer] = useState<{ x: number; y: number; pressed: boolean } | null>(null);
  const deviceChrome = app.connected?.deviceChrome;
  const axSnapshot = app.axSnapshot;
  const canvasMode = workspaceCanvasMode(app.isAnnotationMode, app.isVariantPreviewOpen);
  const canvasPlacement = liveWorkspaceCanvasPlacement(canvasMode);
  const annotationSize = useMemo(
    () => ({ width: app.deviceWidth, height: app.deviceHeight }),
    [app.deviceHeight, app.deviceWidth]
  );
  const pointerFromEvent = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = app.screenImage.current?.getBoundingClientRect();
    return bounds ? normalizedCanvasPoint({ x: event.clientX, y: event.clientY }, bounds) : null;
  };
  const updatePointer = (event: PointerEvent<HTMLButtonElement>, pressed?: boolean) => {
    const point = pointerFromEvent(event);
    setPointer((current) => (point ? { ...point, pressed: pressed ?? current?.pressed ?? false } : null));
  };
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
      scale={canvasScale}
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
              left: canvasPlacement.left,
              top: '50%',
              transform: `translate(calc(-50% + var(--canvas-offset-x, ${canvasOffset.x}px)), calc(-50% + var(--canvas-offset-y, ${canvasOffset.y}px))) scale(var(--canvas-render-scale, ${canvasScale * canvasPlacement.scale}))`
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
              onPointerCancel={
                app.isAnnotationMode
                  ? undefined
                  : (event) => {
                      app.finishPointer(event);
                      updatePointer(event, false);
                    }
              }
              onPointerDown={
                app.isAnnotationMode
                  ? undefined
                  : (event) => {
                      app.handlePointerDown(event);
                      updatePointer(event, !app.isAXTreeOpen && Boolean(app.connected));
                    }
              }
              onPointerLeave={
                app.isAnnotationMode
                  ? undefined
                  : () => {
                      app.leavePointer();
                      setPointer((current) => (current?.pressed ? current : null));
                    }
              }
              onPointerMove={
                app.isAnnotationMode
                  ? undefined
                  : (event) => {
                      app.handlePointerMove(event);
                      updatePointer(event);
                    }
              }
              onPointerUp={
                app.isAnnotationMode
                  ? undefined
                  : (event) => {
                      app.finishPointer(event);
                      updatePointer(event, false);
                    }
              }
              onStreamError={() => app.setError('The simulator video stream stopped.')}
              onStreamLoad={() => app.setIsStreamReady(true)}
              orientation={app.orientation}
              overlay={app.isAnnotationMode ? annotationOverlay : selectionOverlay}
              pointer={!app.isAnnotationMode ? pointer : null}
              screenClassName={`phone-frame interactive canvas-phone device-${app.deviceFrame.kind} ${deviceChrome ? 'native-device-chrome' : ''}`}
              screenImageRef={app.screenImage}
              streamUrl={app.connection?.streamUrl ?? ''}
            />
          </div>
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
        </>
      )}
    </LiveAnnotationSurface>
  );
}
