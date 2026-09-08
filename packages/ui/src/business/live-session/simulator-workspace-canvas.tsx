import type { ReactNode, RefObject } from 'react';
import type { LiveWorkspaceMode } from './workspace-inspector';

import { cn } from '../../primitives/utils';
import { LiveAnnotationSurface } from '../annotation/live-surface';
import { liveWorkspaceCanvasPlacement, SimulatorDeviceControls } from '../canvas-controls';
import { SimulatorCanvas, type SimulatorCanvasProps } from '../simulator-canvas';

export interface LiveWorkspaceSelectionElement {
  frame: { height: number; width: number; x: number; y: number };
  id: string;
  isContainer: boolean;
  path: string;
}

export interface LiveSimulatorWorkspaceCanvasProps
  extends Omit<SimulatorCanvasProps, 'ariaLabel' | 'controls' | 'overlay' | 'screenClassName'> {
  annotation: {
    captureImage: () => Promise<string>;
    onCancel: () => void;
    onFinish: (image: string, annotationNotes: string) => Promise<void>;
  };
  annotationResetKey?: number;
  onActivateAnnotation?: () => void;
  toolsDisabled?: boolean;
  annotationToolsHost?: HTMLElement | null;
  annotationSubmitRef?: RefObject<(() => Promise<void>) | null>;
  onAnnotationCountChange?: (count: number) => void;
  preserveAnnotations?: boolean;
  canSendAnnotation?: boolean;
  annotationNotesHost?: HTMLElement | null;
  appearance: 'dark' | 'light';
  canvasOffset: { x: number; y: number };
  canvasScale: number;
  deviceName: string;
  isAppearanceChanging?: boolean;
  mode: LiveWorkspaceMode;
  onChangeAppearance: () => void;
  onHome: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  selection?: {
    elements?: LiveWorkspaceSelectionElement[];
    error?: ReactNode;
    hoveredPath?: string | null;
    screen?: { height: number; width: number };
    selectedPath?: string | null;
  };
}

export const orientedSimulatorImageSize = (
  orientation: SimulatorCanvasProps['orientation'],
  size: Pick<SimulatorCanvasProps, 'deviceHeight' | 'deviceWidth'>
) => {
  const landscape = orientation === 'landscape_left' || orientation === 'landscape_right';
  return landscape
    ? { height: size.deviceWidth, width: size.deviceHeight }
    : { height: size.deviceHeight, width: size.deviceWidth };
};

export function LiveSimulatorWorkspaceCanvas({
  annotation,
  annotationResetKey,
  onActivateAnnotation,
  toolsDisabled,
  annotationNotesHost,
  annotationToolsHost,
  annotationSubmitRef,
  onAnnotationCountChange,
  preserveAnnotations,
  canSendAnnotation,
  appearance,
  canvasOffset,
  canvasScale,
  deviceName,
  isAppearanceChanging = false,
  mode,
  onChangeAppearance,
  onHome,
  onRotateLeft,
  onRotateRight,
  selection,
  ...simulator
}: LiveSimulatorWorkspaceCanvasProps) {
  const isAnnotationMode = mode === 'annotate';
  const canvasMode = mode === 'variants' ? 'variants' : 'interact';
  const canvasPlacement = liveWorkspaceCanvasPlacement(canvasMode);
  const annotationImageSize = orientedSimulatorImageSize(simulator.orientation, simulator);
  const selectionElements = selection?.elements;
  const selectionScreen = selection?.screen ?? {
    height: simulator.deviceHeight,
    width: simulator.deviceWidth
  };
  const selectionOverlay =
    mode === 'select' || selection?.selectedPath ? (
      <>
        {selectionElements ? (
          <span
            aria-hidden="true"
            className="ax-overlay"
          >
            {selectionElements
              .filter((element) => mode === 'select' || element.path === selection?.selectedPath)
              .map((element) => (
                <span
                  className={cn(
                    'ax-element-box',
                    element.isContainer && 'container',
                    element.path === selection?.hoveredPath && 'hovered',
                    element.path === selection?.selectedPath && 'selected'
                  )}
                  key={`${element.path}-${element.id}`}
                  style={{
                    left: `${(element.frame.x / selectionScreen.width) * 100}%`,
                    top: `${(element.frame.y / selectionScreen.height) * 100}%`,
                    width: `${(element.frame.width / selectionScreen.width) * 100}%`,
                    height: `${(element.frame.height / selectionScreen.height) * 100}%`
                  }}
                />
              ))}
          </span>
        ) : null}
        {(!selectionElements || selection?.error) && (
          <span
            className="selection-status"
            role="status"
          >
            {selection?.error ?? 'Preparing selection…'}
          </span>
        )}
      </>
    ) : null;

  return (
    <LiveAnnotationSurface
      active={isAnnotationMode && !toolsDisabled}
      canSend={canSendAnnotation}
      captureImage={annotation.captureImage}
      imageSize={annotationImageSize}
      notesHost={annotationNotesHost}
      onActivate={onActivateAnnotation}
      onCancel={annotation.onCancel}
      onCountChange={onAnnotationCountChange}
      onFinish={annotation.onFinish}
      orientation={simulator.orientation}
      preserveDraft={preserveAnnotations}
      resetKey={annotationResetKey}
      submitRef={annotationSubmitRef}
      toolsDisabled={toolsDisabled}
      toolsHost={annotationToolsHost}
    >
      {(annotationOverlay) => (
        <div
          className={`device-cluster canvas-mode-${canvasMode}`}
          data-canvas-ui
          style={{
            left: canvasPlacement.left,
            top: '50%',
            transform: `translate(calc(-50% + var(--canvas-offset-x, ${canvasOffset.x}px)), calc(-50% + var(--canvas-offset-y, ${canvasOffset.y}px))) scale(var(--canvas-render-scale, ${canvasScale * canvasPlacement.scale}))`
          }}
        >
          <SimulatorCanvas
            {...simulator}
            ariaLabel={`${deviceName} ${isAnnotationMode ? 'annotation surface' : 'interactive screen'}`}
            controls={
              <SimulatorDeviceControls
                appearance={appearance}
                disabled={mode !== 'interact' || toolsDisabled}
                isAppearanceChanging={isAppearanceChanging}
                onChangeAppearance={onChangeAppearance}
                onHome={onHome}
                onRotateLeft={onRotateLeft}
                onRotateRight={onRotateRight}
                scale={canvasScale}
              />
            }
            overlay={
              <>
                {selectionOverlay}
                {annotationOverlay}
              </>
            }
            screenClassName={`phone-frame interactive canvas-phone device-${simulator.deviceFrame.kind} ${simulator.deviceChrome ? 'native-device-chrome' : ''}`}
          />
        </div>
      )}
    </LiveAnnotationSurface>
  );
}
