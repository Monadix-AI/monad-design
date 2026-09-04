import type { HTMLAttributes, ReactNode, Ref } from 'react';

import { CanvasZoomControls, type CanvasZoomControlsProps } from '../canvas-controls';
import { VariantComparison, type VariantComparisonProps } from '../variant-comparison';
import { LiveWorkspaceFrame } from './app-frame';
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
  variantComparison,
  zoomControls
}: LiveWorkspaceProps) {
  const canvasMode = mode === 'select' ? 'interact' : mode;
  return (
    <LiveWorkspaceFrame
      canvas={canvas ?? (simulator ? <LiveSimulatorWorkspaceCanvas {...simulator} /> : null)}
      canvasProps={canvasProps}
      error={error}
      header={header}
      heading={heading}
      inspector={
        <>
          {designDocument}
          {preview ?? (variantComparison ? <VariantComparison {...variantComparison} /> : null)}
          <LiveWorkspaceInspector
            {...inspector}
            isEndingLive={activeSession?.isEnding}
            mode={mode}
            onEndLive={activeSession?.onEnd}
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
