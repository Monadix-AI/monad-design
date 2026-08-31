import type { DeviceFrameMetrics } from '@monaddesign/device-frame';
import type { SimulatorOrientation } from '@monaddesign/simulator';
import type { ClipboardEvent, KeyboardEvent, PointerEvent, ReactNode, Ref } from 'react';

import { cn } from '../primitives/utils';

export interface SimulatorCanvasProps {
  ariaLabel: string;
  className?: string;
  controls?: ReactNode;
  deviceChrome?: {
    image: string;
    frame: { width: number; height: number };
    body: { x: number; y: number; width: number; height: number };
    screen: { x: number; y: number; width: number; height: number };
  };
  deviceFrame: DeviceFrameMetrics;
  deviceHeight: number;
  deviceWidth: number;
  framebufferMask?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onKeyUp?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLButtonElement>) => void;
  onStreamError?: () => void;
  onStreamLoad?: () => void;
  orientation: SimulatorOrientation;
  overlay?: ReactNode;
  pointer?: { x: number; y: number; pressed: boolean } | null;
  screenImageRef?: Ref<HTMLImageElement>;
  screenClassName?: string;
  streamUrl: string;
}

const screenLayer = ({
  deviceHeight: height,
  deviceWidth: width,
  orientation
}: Pick<SimulatorCanvasProps, 'deviceHeight' | 'deviceWidth' | 'orientation'>) => {
  const landscape = orientation === 'landscape_left' || orientation === 'landscape_right';
  return {
    width: landscape ? height : width,
    height: landscape ? width : height,
    transform:
      orientation === 'landscape_left'
        ? 'translate(-50%, -50%) rotate(90deg)'
        : orientation === 'landscape_right'
          ? 'translate(-50%, -50%) rotate(-90deg)'
          : orientation === 'portrait_upside_down'
            ? 'translate(-50%, -50%) rotate(180deg)'
            : 'translate(-50%, -50%)'
  };
};

export function SimulatorCanvas({
  ariaLabel,
  className,
  controls,
  deviceChrome,
  deviceFrame,
  deviceHeight,
  deviceWidth,
  framebufferMask,
  onKeyDown,
  onKeyUp,
  onPaste,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  onStreamError,
  onStreamLoad,
  orientation,
  overlay,
  pointer,
  screenImageRef,
  screenClassName,
  streamUrl
}: SimulatorCanvasProps) {
  const isLandscape = orientation === 'landscape_left' || orientation === 'landscape_right';
  const chromeScale = deviceChrome ? (isLandscape ? deviceHeight : deviceWidth) / deviceChrome.screen.width : 1;
  const layer = screenLayer({ deviceHeight, deviceWidth, orientation });
  const portraitCenter = deviceChrome
    ? { x: deviceChrome.body.x + deviceChrome.body.width / 2, y: deviceChrome.body.y + deviceChrome.body.height / 2 }
    : null;
  const chromeBodyCenter =
    orientation === 'landscape_left' && deviceChrome && portraitCenter
      ? { x: deviceChrome.frame.height - portraitCenter.y, y: portraitCenter.x }
      : orientation === 'landscape_right' && deviceChrome && portraitCenter
        ? { x: portraitCenter.y, y: deviceChrome.frame.width - portraitCenter.x }
        : orientation === 'portrait_upside_down' && deviceChrome && portraitCenter
          ? { x: deviceChrome.frame.width - portraitCenter.x, y: deviceChrome.frame.height - portraitCenter.y }
          : portraitCenter;
  const chromeTransform =
    orientation === 'landscape_left'
      ? 'translate(-50%, -50%) rotate(90deg)'
      : orientation === 'landscape_right'
        ? 'translate(-50%, -50%) rotate(-90deg)'
        : orientation === 'portrait_upside_down'
          ? 'translate(-50%, -50%) rotate(180deg)'
          : 'translate(-50%, -50%)';

  return (
    <div
      className={cn('relative grid place-items-center', className)}
      data-slot="simulator-canvas"
    >
      <button
        aria-label={ariaLabel}
        className={cn(
          'relative grid touch-none p-0',
          deviceChrome ? 'overflow-visible rounded-none' : 'overflow-hidden bg-black shadow-2xl',
          pointer && 'simulator-pointer-visible',
          screenClassName
        )}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPaste={onPaste}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerLeave={onPointerLeave}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          paddingTop: deviceFrame.insets.top,
          paddingRight: deviceFrame.insets.right,
          paddingBottom: deviceFrame.insets.bottom,
          paddingLeft: deviceFrame.insets.left,
          borderRadius: deviceChrome ? 0 : deviceFrame.outerRadius
        }}
        type="button"
      >
        {deviceChrome && (
          <img
            alt=""
            aria-hidden="true"
            className="native-device-chrome-image pointer-events-none absolute z-0"
            draggable={false}
            src={deviceChrome.image}
            style={{
              left: (chromeBodyCenter?.x ?? 0) * chromeScale,
              top: (chromeBodyCenter?.y ?? 0) * chromeScale,
              width: deviceChrome.body.width * chromeScale,
              height: deviceChrome.body.height * chromeScale,
              transform: chromeTransform
            }}
          />
        )}
        <div
          className={cn('screen-stage relative z-10 overflow-hidden', isLandscape ? 'landscape' : 'portrait')}
          style={{
            width: deviceWidth,
            height: deviceHeight,
            borderRadius: framebufferMask ? 0 : deviceFrame.screenRadius,
            background: deviceChrome && !framebufferMask ? '#000' : undefined
          }}
        >
          <span
            className="screen-rotation-layer absolute top-1/2 left-1/2 overflow-hidden"
            style={{
              width: layer.width,
              height: layer.height,
              borderRadius: framebufferMask ? 0 : deviceFrame.screenRadius,
              background: deviceChrome ? '#000' : undefined,
              transform: layer.transform,
              WebkitMaskImage: framebufferMask ? `url(${framebufferMask})` : undefined,
              WebkitMaskSize: '100% 100%',
              WebkitMaskRepeat: 'no-repeat',
              maskImage: framebufferMask ? `url(${framebufferMask})` : undefined,
              maskSize: '100% 100%',
              maskRepeat: 'no-repeat'
            }}
          >
            <img
              alt="Live Simulator screen"
              className="block h-full w-full object-fill"
              draggable={false}
              onError={onStreamError}
              onLoad={onStreamLoad}
              ref={screenImageRef}
              src={streamUrl}
            />
          </span>
          {overlay}
          {pointer && (
            <span
              aria-hidden="true"
              className={cn(
                'simulator-pointer absolute z-20 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/70',
                pointer.pressed && 'pressed size-4'
              )}
              style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }}
            />
          )}
        </div>
        {!framebufferMask && deviceFrame.hardware && (
          <span
            aria-hidden="true"
            className="absolute z-20 bg-black"
            style={{
              left: deviceFrame.hardware.x,
              top: deviceFrame.hardware.y,
              width: deviceFrame.hardware.width,
              height: deviceFrame.hardware.height
            }}
          />
        )}
      </button>
      {controls}
    </div>
  );
}
