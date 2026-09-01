import type { SimulatorOrientation } from '@monaddesign/simulator';
import type { CSSProperties } from 'react';

import { RadioGroup } from 'radix-ui';
import { useLayoutEffect, useRef, useState } from 'react';

export interface VariantComparisonCapture {
  id: string;
  image: string;
  orientation: SimulatorOrientation;
}

interface VariantComparisonDeviceChrome {
  image: string;
  frame: { width: number; height: number };
  body: { x: number; y: number; width: number; height: number };
  screen: { x: number; y: number; width: number; height: number };
}

interface VariantComparisonDeviceFrame {
  frameHeight: number;
  frameWidth: number;
  insets: { top: number; right: number; bottom: number; left: number };
  kind: string;
  outerRadius: number;
  screenRadius: number;
  hardware?: { x: number; y: number; width: number; height: number } | null;
}

export function VariantComparison({
  capturingVariant,
  captures,
  deviceChrome,
  deviceFrame,
  deviceHeight,
  deviceWidth,
  framebufferMask,
  labels,
  offset = { x: 0, y: 0 },
  onSelect,
  orientation = 'portrait',
  scale = 1,
  selectedVariant,
  variants
}: {
  capturingVariant?: string | null;
  captures: VariantComparisonCapture[];
  deviceChrome?: VariantComparisonDeviceChrome;
  deviceFrame: VariantComparisonDeviceFrame;
  deviceHeight: number;
  deviceWidth: number;
  framebufferMask?: string;
  labels: Record<string, string>;
  offset?: { x: number; y: number };
  onSelect: (variant: string) => void;
  orientation?: SimulatorOrientation;
  scale?: number;
  selectedVariant?: string | null;
  variants: string[];
}) {
  const variantStrip = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(0.5);

  useLayoutEffect(() => {
    const strip = variantStrip.current;
    if (!strip) return;
    const fitVariants = () => {
      const canvas = strip.parentElement;
      const canvasWidth = canvas?.clientWidth ?? window.innerWidth;
      const canvasHeight = canvas?.clientHeight ?? window.innerHeight;
      const availableWidth = Math.max(240, canvasWidth - 380 - 96);
      const availableHeight = Math.max(240, canvasHeight - 160);
      const gap = Math.min(44, Math.max(18, availableWidth * 0.03));
      const horizontalSpace = availableWidth - gap * Math.max(0, variants.length - 1);
      const widthScale = horizontalSpace / Math.max(1, deviceFrame.frameWidth * variants.length);
      const heightScale = (availableHeight - 34) / Math.max(1, deviceFrame.frameHeight);
      setPreviewScale(Math.min(0.78, Math.max(0.25, Math.min(widthScale, heightScale))));
    };
    fitVariants();
    const observer = new ResizeObserver(fitVariants);
    observer.observe(strip.parentElement ?? strip);
    return () => observer.disconnect();
  }, [deviceFrame.frameHeight, deviceFrame.frameWidth, variants.length]);

  return (
    <RadioGroup.Root
      aria-label="Variants on the simulator canvas"
      className="canvas-variant-strip"
      onValueChange={onSelect}
      ref={variantStrip}
      style={
        {
          '--variant-canvas-offset-x': `${offset.x}px`,
          '--variant-canvas-offset-y': `${offset.y}px`,
          '--variant-canvas-scale': scale
        } as CSSProperties
      }
      value={selectedVariant ?? ''}
    >
      {variants.map((variant) => {
        const capture = captures.find((candidate) => candidate.id === variant);
        const isCapturing = capturingVariant === variant;
        const captureOrientation = capture?.orientation ?? orientation;
        const captureIsLandscape = captureOrientation === 'landscape_left' || captureOrientation === 'landscape_right';
        const stageWidth = captureIsLandscape ? deviceHeight : deviceWidth;
        const stageHeight = captureIsLandscape ? deviceWidth : deviceHeight;
        const chromeScale = deviceChrome
          ? stageWidth / (captureIsLandscape ? deviceChrome.screen.height : deviceChrome.screen.width)
          : 1;
        const portraitCenter = deviceChrome
          ? {
              x: deviceChrome.body.x + deviceChrome.body.width / 2,
              y: deviceChrome.body.y + deviceChrome.body.height / 2
            }
          : null;
        const chromeBodyCenter =
          captureOrientation === 'landscape_left' && deviceChrome && portraitCenter
            ? { x: deviceChrome.frame.height - portraitCenter.y, y: portraitCenter.x }
            : captureOrientation === 'landscape_right' && deviceChrome && portraitCenter
              ? { x: portraitCenter.y, y: deviceChrome.frame.width - portraitCenter.x }
              : captureOrientation === 'portrait_upside_down' && deviceChrome && portraitCenter
                ? { x: deviceChrome.frame.width - portraitCenter.x, y: deviceChrome.frame.height - portraitCenter.y }
                : portraitCenter;
        const chromeTransform =
          captureOrientation === 'landscape_left'
            ? 'translate(-50%, -50%) rotate(90deg)'
            : captureOrientation === 'landscape_right'
              ? 'translate(-50%, -50%) rotate(-90deg)'
              : captureOrientation === 'portrait_upside_down'
                ? 'translate(-50%, -50%) rotate(180deg)'
                : 'translate(-50%, -50%)';
        const frameStyle = {
          '--variant-device-height': `${deviceFrame.frameHeight * previewScale}px`,
          '--variant-device-scale': previewScale,
          '--variant-device-width': `${deviceFrame.frameWidth * previewScale}px`
        } as CSSProperties;

        return (
          <RadioGroup.Item
            aria-label={labels[variant] ?? variant}
            className="canvas-variant-device"
            data-canvas-ui
            data-capturing={isCapturing ? 'true' : undefined}
            data-variant={variant}
            disabled={!capture}
            key={variant}
            style={frameStyle}
            value={variant}
          >
            <span className="canvas-variant-label">
              <strong>{labels[variant] ?? variant}</strong>
              <small>{variant === 'original' ? 'BASE' : variant.replace(/^v/u, '').padStart(2, '0')}</small>
            </span>
            <span
              aria-hidden="true"
              className="canvas-variant-device-scale"
            >
              <span
                className={`phone-frame canvas-phone device-${deviceFrame.kind} ${deviceChrome ? 'native-device-chrome' : ''}`}
                style={{
                  paddingTop: deviceFrame.insets.top,
                  paddingRight: deviceFrame.insets.right,
                  paddingBottom: deviceFrame.insets.bottom,
                  paddingLeft: deviceFrame.insets.left,
                  borderRadius: deviceChrome ? 0 : deviceFrame.outerRadius
                }}
              >
                {deviceChrome && (
                  <img
                    alt=""
                    className="native-device-chrome-image"
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
                <span
                  className={`screen-stage ${captureIsLandscape ? 'landscape' : 'portrait'}`}
                  style={{
                    width: stageWidth,
                    height: stageHeight,
                    borderRadius: framebufferMask ? 0 : deviceFrame.screenRadius,
                    background: deviceChrome && !framebufferMask ? '#000' : undefined
                  }}
                >
                  {capture && (
                    <img
                      alt=""
                      className="variant-screenshot"
                      draggable={false}
                      src={capture.image}
                      style={{
                        WebkitMaskImage: framebufferMask ? `url(${framebufferMask})` : undefined,
                        WebkitMaskSize: '100% 100%',
                        WebkitMaskRepeat: 'no-repeat',
                        maskImage: framebufferMask ? `url(${framebufferMask})` : undefined,
                        maskSize: '100% 100%',
                        maskRepeat: 'no-repeat'
                      }}
                    />
                  )}
                  {isCapturing && (
                    <span
                      aria-label={`Capturing ${labels[variant] ?? variant}`}
                      className="variant-capture-loading"
                      role="status"
                    >
                      <span
                        aria-hidden="true"
                        className="variant-capture-spinner spin"
                      />
                      <strong>Capturing…</strong>
                    </span>
                  )}
                </span>
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
              </span>
            </span>
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}
