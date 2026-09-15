import type { SimulatorOrientation } from '@monaddesign/simulator';
import type { LiveWorkspaceMode } from './workspace-inspector';

import { useLayoutEffect, useRef } from 'react';

import {
  type LiveSimulatorDeviceChrome,
  liveSimulatorDeviceFrame,
  televisionRemoteReservedWidth
} from '../canvas-controls';
import { useCanvasViewport } from '../canvas-viewport';

export function useLiveWorkspaceViewport({
  deviceChrome,
  deviceHeight,
  deviceName,
  deviceWidth,
  isTelevision,
  mode,
  orientation,
  resetKey
}: {
  deviceChrome?: LiveSimulatorDeviceChrome;
  deviceHeight: number;
  deviceName: string;
  deviceWidth: number;
  isTelevision?: boolean;
  mode: LiveWorkspaceMode;
  orientation: SimulatorOrientation;
  resetKey?: string | null;
}) {
  const deviceFrame = liveSimulatorDeviceFrame({
    deviceChrome,
    deviceHeight,
    deviceName,
    deviceWidth,
    isTelevision,
    orientation
  });
  const viewport = useCanvasViewport({
    deviceFrame,
    mode: mode === 'select' ? 'interact' : mode,
    sidecarWidth: isTelevision ? televisionRemoteReservedWidth : 0,
    resetKey
  });
  const viewportRef = useRef(viewport);
  const annotationWasOpen = useRef(mode === 'annotate');
  viewportRef.current = viewport;

  useLayoutEffect(() => {
    const annotationIsOpen = mode === 'annotate';
    if (annotationIsOpen === annotationWasOpen.current) return;
    annotationWasOpen.current = annotationIsOpen;
    if (annotationIsOpen) viewportRef.current.beginTemporaryView();
    else viewportRef.current.restoreTemporaryView();
  }, [mode]);

  return { ...viewport, deviceFrame };
}
