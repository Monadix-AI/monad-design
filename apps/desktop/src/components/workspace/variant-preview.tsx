import type { CSSProperties } from 'react';
import type { SimulatorVariantId } from '@/electron';

import { RadioGroup } from 'radix-ui';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useDesktopApp } from '@/desktop-app-provider';

export function VariantPreview() {
  const {
    connected,
    deviceFrame,
    deviceHeight,
    deviceWidth,
    orientation,
    selectedVariant,
    setSelectedVariant,
    variantCaptures,
    variantIds,
    variantLabels
  } = useDesktopApp();
  const variantStrip = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(0.5);
  const previewVariants = variantIds.filter((variant) => variant !== 'original');
  const deviceChrome = connected?.deviceChrome;
  const framebufferMask = connected?.framebufferMask;

  useLayoutEffect(() => {
    const strip = variantStrip.current;
    if (!strip) return;
    const fitVariants = () => {
      const gap = Math.min(44, Math.max(18, strip.clientWidth * 0.03));
      const horizontalSpace = strip.clientWidth - 72 - gap * Math.max(0, previewVariants.length - 1);
      const widthScale = horizontalSpace / Math.max(1, deviceFrame.frameWidth * previewVariants.length);
      const heightScale = (strip.clientHeight - 72) / Math.max(1, deviceFrame.frameHeight);
      setPreviewScale(Math.min(0.78, Math.max(0.25, Math.min(widthScale, heightScale))));
    };
    fitVariants();
    const observer = new ResizeObserver(fitVariants);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [deviceFrame.frameHeight, deviceFrame.frameWidth, previewVariants.length]);

  useEffect(() => {
    if (!selectedVariant) return;
    variantStrip.current
      ?.querySelector<HTMLElement>(`[data-variant="${selectedVariant}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [selectedVariant]);

  return (
    <RadioGroup.Root
      aria-label="Variants on the simulator canvas"
      className="canvas-variant-strip"
      data-canvas-ui
      onValueChange={(value) => setSelectedVariant(value as SimulatorVariantId)}
      onWheel={(event) => event.stopPropagation()}
      ref={variantStrip}
      value={selectedVariant ?? ''}
    >
      {previewVariants.map((variant) => {
        const capture = variantCaptures.find((candidate) => candidate.id === variant);
        const captureOrientation = capture?.orientation ?? orientation;
        const captureIsLandscape = captureOrientation === 'landscape_left' || captureOrientation === 'landscape_right';
        const captureChromeScale = deviceChrome
          ? (captureIsLandscape ? deviceHeight : deviceWidth) / deviceChrome.screen.width
          : 1;
        const captureChromeTransform =
          captureOrientation === 'landscape_left'
            ? 'translate(-50%, -50%) rotate(90deg)'
            : captureOrientation === 'landscape_right'
              ? 'translate(-50%, -50%) rotate(-90deg)'
              : captureOrientation === 'portrait_upside_down'
                ? 'translate(-50%, -50%) rotate(180deg)'
                : 'translate(-50%, -50%)';
        const captureChromeBodyCenter = deviceChrome
          ? (() => {
              const portraitCenter = {
                x: deviceChrome.body.x + deviceChrome.body.width / 2,
                y: deviceChrome.body.y + deviceChrome.body.height / 2
              };
              if (captureOrientation === 'landscape_left') {
                return { x: deviceChrome.frame.height - portraitCenter.y, y: portraitCenter.x };
              }
              if (captureOrientation === 'landscape_right') {
                return { x: portraitCenter.y, y: deviceChrome.frame.width - portraitCenter.x };
              }
              if (captureOrientation === 'portrait_upside_down') {
                return {
                  x: deviceChrome.frame.width - portraitCenter.x,
                  y: deviceChrome.frame.height - portraitCenter.y
                };
              }
              return portraitCenter;
            })()
          : null;
        const frameStyle = {
          '--variant-device-height': `${deviceFrame.frameHeight * previewScale}px`,
          '--variant-device-scale': previewScale,
          '--variant-device-width': `${deviceFrame.frameWidth * previewScale}px`
        } as CSSProperties;

        return (
          <RadioGroup.Item
            aria-label={variantLabels[variant]}
            className="canvas-variant-device"
            data-variant={variant}
            disabled={!capture}
            key={variant}
            style={frameStyle}
            value={variant}
          >
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
                      left: (captureChromeBodyCenter?.x ?? 0) * captureChromeScale,
                      top: (captureChromeBodyCenter?.y ?? 0) * captureChromeScale,
                      width: deviceChrome.body.width * captureChromeScale,
                      height: deviceChrome.body.height * captureChromeScale,
                      transform: captureChromeTransform
                    }}
                  />
                )}
                <span
                  className={`screen-stage ${captureIsLandscape ? 'landscape' : 'portrait'}`}
                  style={{
                    width: deviceWidth,
                    height: deviceHeight,
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
                </span>
                {!framebufferMask && deviceFrame.hardware && (
                  <span
                    className={`device-hardware device-hardware-${deviceFrame.hardware.kind}`}
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
