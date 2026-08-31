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
  type Annotation,
  AnnotationShape,
  type AnnotationTool,
  annotationId,
  annotationInk,
  annotationIsVisible,
  buildCalloutLayout,
  CanvasZoomControls,
  calloutAnchor,
  calloutConnectorPath,
  type DrawnAnnotation,
  isDrawnAnnotation,
  type Point,
  SimulatorCanvas as SharedSimulatorCanvas,
  SimulatorDeviceControls
} from '@monaddesign/ui';
import { type PointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ActionIcon } from '@/components/action-icon';
import { Button } from '@/components/ui/button';
import { useDesktopApp } from '@/desktop-app-provider';

const annotationTools = [
  { id: 'rectangle', icon: SquareIcon, label: 'Rectangle' },
  { id: 'ellipse', icon: EllipseIcon, label: 'Ellipse' },
  { id: 'text', icon: TextIcon, label: 'Text' },
  { id: 'arrow', icon: ArrowUpRight01Icon, label: 'Arrow' }
] as const;

const loadImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the Simulator screenshot.'));
    image.src = source;
  });

const calloutTypeLabel: Record<DrawnAnnotation['type'], string> = {
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  arrow: 'Arrow'
};

const wrapCanvasText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(/\s+/u);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
};

const orientedScreenshot = (
  source: HTMLImageElement,
  orientation: 'portrait' | 'landscape_left' | 'portrait_upside_down' | 'landscape_right'
) => {
  const landscape = orientation === 'landscape_left' || orientation === 'landscape_right';
  const quarterTurn = landscape && source.naturalHeight > source.naturalWidth;
  const canvas = document.createElement('canvas');
  canvas.width = quarterTurn ? source.naturalHeight : source.naturalWidth;
  canvas.height = quarterTurn ? source.naturalWidth : source.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is unavailable.');
  if (quarterTurn && orientation === 'landscape_left') {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  } else if (quarterTurn) {
    context.translate(0, canvas.height);
    context.rotate(-Math.PI / 2);
  } else if (orientation === 'portrait_upside_down') {
    context.translate(canvas.width, canvas.height);
    context.rotate(Math.PI);
  }
  context.drawImage(source, 0, 0);
  return canvas;
};

export function SimulatorCanvas() {
  const app = useDesktopApp();
  const deviceChrome = app.connected?.deviceChrome;
  const axSnapshot = app.axSnapshot;
  const canvasMode = app.isAnnotationMode ? 'annotate' : app.isVariantPreviewOpen ? 'variants' : 'interact';
  const modeScale = canvasMode === 'annotate' ? 0.84 : canvasMode === 'variants' ? 0.56 : 1;
  const modeLeft = canvasMode === 'annotate' ? '42%' : canvasMode === 'variants' ? '18%' : '50%';
  const annotationSize = useMemo(
    () => ({ width: app.deviceWidth, height: app.deviceHeight }),
    [app.deviceHeight, app.deviceWidth]
  );
  const [activeTool, setActiveTool] = useState<AnnotationTool>('rectangle');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<DrawnAnnotation | null>(null);
  const [textPoint, setTextPoint] = useState<Point | null>(null);
  const [textValue, setTextValue] = useState('');
  const [annotationError, setAnnotationError] = useState('');
  const [isFinishingAnnotation, setIsFinishingAnnotation] = useState(false);
  const [connectorPaths, setConnectorPaths] = useState<Array<{ d: string; id: string }>>([]);
  const annotationOverlay = useRef<SVGSVGElement | null>(null);
  const annotationTextInput = useRef<HTMLInputElement | null>(null);
  const annotationNotesList = useRef<HTMLOListElement | null>(null);
  const noteInputs = useRef(new Map<string, HTMLTextAreaElement>());
  const pendingNoteFocus = useRef<string | null>(null);
  const draftRef = useRef<DrawnAnnotation | null>(null);
  const drawingPointerId = useRef<number | null>(null);
  const callouts = useMemo(() => annotations.filter(isDrawnAnnotation), [annotations]);

  useEffect(() => {
    if (app.isAnnotationMode) return;
    setActiveTool('rectangle');
    setAnnotations([]);
    setDraft(null);
    setTextPoint(null);
    setTextValue('');
    setAnnotationError('');
    setIsFinishingAnnotation(false);
    setConnectorPaths([]);
    noteInputs.current.clear();
    pendingNoteFocus.current = null;
    draftRef.current = null;
    drawingPointerId.current = null;
  }, [app.isAnnotationMode]);
  useEffect(() => {
    if (!textPoint) return;
    const frame = window.requestAnimationFrame(() => annotationTextInput.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [textPoint]);
  useEffect(() => {
    const pendingId = pendingNoteFocus.current;
    if (!pendingId || !callouts.some((callout) => callout.id === pendingId)) return;
    const frame = window.requestAnimationFrame(() => {
      noteInputs.current.get(pendingId)?.focus();
      pendingNoteFocus.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [callouts]);
  useLayoutEffect(() => {
    if (!app.isAnnotationMode || !callouts.length) {
      setConnectorPaths([]);
      return;
    }
    const canvas = annotationOverlay.current?.closest('.free-canvas');
    if (!(canvas instanceof HTMLElement) || !annotationOverlay.current) return;
    const updateConnectors = () => {
      if (!annotationOverlay.current) return;
      const canvasBounds = canvas.getBoundingClientRect();
      const overlayBounds = annotationOverlay.current.getBoundingClientRect();
      setConnectorPaths(
        callouts.flatMap((callout) => {
          const note = noteInputs.current.get(callout.id)?.closest('li');
          if (!(note instanceof HTMLElement)) return [];
          const noteBounds = note.getBoundingClientRect();
          const anchor = calloutAnchor(callout);
          const start = {
            x: overlayBounds.left - canvasBounds.left + (anchor.x / annotationSize.width) * overlayBounds.width,
            y: overlayBounds.top - canvasBounds.top + (anchor.y / annotationSize.height) * overlayBounds.height
          };
          const end = {
            x: noteBounds.left - canvasBounds.left - 8,
            y: noteBounds.top - canvasBounds.top + noteBounds.height / 2
          };
          const reach = Math.max(54, (end.x - start.x) * 0.42);
          return [
            {
              id: callout.id,
              d: `M ${start.x} ${start.y} C ${start.x + reach} ${start.y}, ${end.x - reach} ${end.y}, ${end.x} ${end.y}`
            }
          ];
        })
      );
    };
    const frame = window.requestAnimationFrame(updateConnectors);
    const transitionFrame = window.setTimeout(updateConnectors, 260);
    const observer = new ResizeObserver(updateConnectors);
    const notesList = annotationNotesList.current;
    observer.observe(canvas);
    observer.observe(annotationOverlay.current);
    if (notesList) {
      observer.observe(notesList);
      notesList.addEventListener('scroll', updateConnectors);
    }
    for (const input of noteInputs.current.values()) {
      const item = input.closest('li');
      if (item) observer.observe(item);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(transitionFrame);
      notesList?.removeEventListener('scroll', updateConnectors);
      observer.disconnect();
    };
  }, [annotationSize, app.isAnnotationMode, callouts]);

  const annotationPoint = (event: PointerEvent<SVGRectElement>) => {
    const bounds = annotationOverlay.current?.getBoundingClientRect();
    if (!bounds) return null;
    const point = {
      x: ((event.clientX - bounds.left) / bounds.width) * annotationSize.width,
      y: ((event.clientY - bounds.top) / bounds.height) * annotationSize.height
    };
    return point.x >= 0 && point.x <= annotationSize.width && point.y >= 0 && point.y <= annotationSize.height
      ? point
      : null;
  };
  const startAnnotation = (event: PointerEvent<SVGRectElement>) => {
    if (!event.isPrimary || drawingPointerId.current !== null) return;
    const point = annotationPoint(event);
    if (!point) return;
    setAnnotationError('');
    if (activeTool === 'text') {
      setTextPoint(point);
      setTextValue('');
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextDraft: DrawnAnnotation = {
      id: annotationId(),
      type: activeTool,
      start: point,
      end: point,
      note: ''
    };
    drawingPointerId.current = event.pointerId;
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  };
  const moveAnnotation = (event: PointerEvent<SVGRectElement>) => {
    if (event.pointerId !== drawingPointerId.current || !draftRef.current) return;
    const point = annotationPoint(event);
    if (!point) return;
    draftRef.current = { ...draftRef.current, end: point };
    setDraft(draftRef.current);
  };
  const finishAnnotationGesture = (event: PointerEvent<SVGRectElement>) => {
    if (event.pointerId !== drawingPointerId.current || !draftRef.current) return;
    const finished = { ...draftRef.current, end: annotationPoint(event) ?? draftRef.current.end };
    if (annotationIsVisible(finished)) {
      pendingNoteFocus.current = finished.id;
      setAnnotations((current) => [...current, finished]);
    }
    drawingPointerId.current = null;
    draftRef.current = null;
    setDraft(null);
  };
  const commitText = () => {
    if (textPoint && textValue.trim()) {
      setAnnotations((current) => [
        ...current,
        { id: annotationId(), type: 'text', start: textPoint, text: textValue.trim() }
      ]);
    }
    setTextPoint(null);
    setTextValue('');
  };
  const updateNote = (id: string, note: string) => {
    setAnnotationError('');
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === id && isDrawnAnnotation(annotation) ? { ...annotation, note } : annotation
      )
    );
  };
  const finishAnnotation = async () => {
    if (isFinishingAnnotation) return;
    const missingNote = callouts.find((callout) => !callout.note.trim());
    if (missingNote) {
      setAnnotationError('Add a note to every numbered callout before finishing.');
      noteInputs.current.get(missingNote.id)?.focus();
      return;
    }
    setIsFinishingAnnotation(true);
    setAnnotationError('');
    try {
      commitText();
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const [source, overlay] = await Promise.all([
        app.captureSimulatorImage().then(loadImage),
        Promise.resolve(annotationOverlay.current?.cloneNode(true) as SVGSVGElement | undefined)
      ]);
      if (!overlay) throw new Error('The annotation layer is unavailable.');
      overlay.querySelector('[data-annotation-hit-target]')?.remove();
      overlay.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const screenshot = orientedScreenshot(source, app.orientation);
      overlay.setAttribute('width', String(screenshot.width));
      overlay.setAttribute('height', String(screenshot.height));
      const scaleX = screenshot.width / annotationSize.width;
      const scaleY = screenshot.height / annotationSize.height;
      const renderedCallouts = callouts.map((callout) => ({
        ...callout,
        start: { x: callout.start.x * scaleX, y: callout.start.y * scaleY },
        end: { x: callout.end.x * scaleX, y: callout.end.y * scaleY }
      }));
      const layout = buildCalloutLayout({ width: screenshot.width, height: screenshot.height }, renderedCallouts);
      const canvas = document.createElement('canvas');
      canvas.width = layout.width;
      canvas.height = layout.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas rendering is unavailable.');
      context.fillStyle = '#0d0d0d';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(screenshot, 0, 0);
      const overlayUrl = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(overlay)], { type: 'image/svg+xml' })
      );
      try {
        context.drawImage(await loadImage(overlayUrl), 0, 0, screenshot.width, screenshot.height);
      } finally {
        URL.revokeObjectURL(overlayUrl);
      }
      if (renderedCallouts.length) {
        const headingSize = Math.max(38, screenshot.width * 0.045);
        const metaSize = Math.max(22, screenshot.width * 0.022);
        const bodySize = Math.max(28, screenshot.width * 0.028);
        context.fillStyle = '#15171a';
        context.fillRect(layout.sidecarLeft, 0, layout.sidecarWidth, canvas.height);
        context.fillStyle = '#f2f3f5';
        context.font = `700 ${headingSize}px Inter, system-ui, sans-serif`;
        context.fillText('Implementation notes', layout.sidecarLeft + layout.padding, layout.padding + headingSize);
        context.fillStyle = '#9da2ac';
        context.font = `600 ${metaSize}px Inter, system-ui, sans-serif`;
        context.fillText(
          `${renderedCallouts.length} numbered ${renderedCallouts.length === 1 ? 'callout' : 'callouts'}`,
          layout.sidecarLeft + layout.padding,
          layout.padding + headingSize + metaSize * 1.8
        );
        renderedCallouts.forEach((callout, index) => {
          const box = layout.boxes[index];
          if (!box) return;
          const connector = calloutConnectorPath(callout, box);
          context.strokeStyle = annotationInk;
          context.lineWidth = Math.max(4, screenshot.width * 0.004);
          context.stroke(new Path2D(connector.d));
          context.fillStyle = '#202328';
          context.strokeStyle = '#343840';
          context.lineWidth = 2;
          context.beginPath();
          context.roundRect(box.x, box.y, box.width, box.height, Math.max(12, screenshot.width * 0.014));
          context.fill();
          context.stroke();
          const badgeRadius = Math.max(25, screenshot.width * 0.023);
          const badgeX = box.x + layout.padding;
          const badgeY = box.y + layout.padding;
          context.fillStyle = annotationInk;
          context.beginPath();
          context.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = '#0d0d0d';
          context.font = `800 ${badgeRadius}px Inter, system-ui, sans-serif`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(String(index + 1), badgeX, badgeY + 1);
          context.textAlign = 'left';
          context.textBaseline = 'alphabetic';
          const textX = badgeX + badgeRadius + layout.padding * 0.65;
          context.fillStyle = '#9da2ac';
          context.font = `700 ${metaSize}px Inter, system-ui, sans-serif`;
          context.fillText(calloutTypeLabel[callout.type].toUpperCase(), textX, box.y + layout.padding + metaSize);
          context.fillStyle = '#f2f3f5';
          context.font = `500 ${bodySize}px Inter, system-ui, sans-serif`;
          const lines = wrapCanvasText(context, callout.note.trim(), box.x + box.width - textX - layout.padding);
          lines.slice(0, 8).forEach((line, lineIndex) => {
            context.fillText(line, textX, box.y + layout.padding + metaSize * 2.4 + lineIndex * bodySize * 1.4);
          });
        });
      }
      await app.sendAnnotatedAgentRequest(canvas.toDataURL('image/png'));
      app.closeAnnotation();
    } catch (error) {
      setAnnotationError(error instanceof Error ? error.message : 'Could not send the annotation to the agent.');
    } finally {
      setIsFinishingAnnotation(false);
    }
  };

  const annotationLayer = app.isAnnotationMode ? (
    <div
      className={`canvas-annotation-layer tool-${activeTool}`}
      onPointerCancel={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <svg
        aria-label="Annotation drawing area"
        className="canvas-annotation-overlay"
        preserveAspectRatio="none"
        ref={annotationOverlay}
        style={{ pointerEvents: 'auto' }}
        viewBox={`0 0 ${annotationSize.width} ${annotationSize.height}`}
      >
        <title>Draw annotations on the live Simulator view</title>
        {annotations.map((annotation) => (
          <AnnotationShape
            annotation={annotation}
            imageSize={annotationSize}
            key={annotation.id}
          />
        ))}
        {draft && (
          <AnnotationShape
            annotation={draft}
            imageSize={annotationSize}
          />
        )}
        {callouts.map((callout, index) => {
          const anchor = calloutAnchor(callout);
          const radius = Math.max(13, annotationSize.width * 0.019);
          return (
            <g key={`badge-${callout.id}`}>
              <circle
                cx={anchor.x}
                cy={anchor.y}
                fill={annotationInk}
                r={radius}
              />
              <text
                dominantBaseline="central"
                fill="#0d0d0d"
                fontSize={radius}
                fontWeight="800"
                textAnchor="middle"
                x={anchor.x}
                y={anchor.y}
              >
                {index + 1}
              </text>
            </g>
          );
        })}
        <rect
          data-annotation-hit-target
          fill="transparent"
          height={annotationSize.height}
          onPointerCancel={finishAnnotationGesture}
          onPointerDown={startAnnotation}
          onPointerMove={moveAnnotation}
          onPointerUp={finishAnnotationGesture}
          pointerEvents="all"
          width={annotationSize.width}
          x="0"
          y="0"
        />
      </svg>
      {textPoint && (
        <form
          className="canvas-annotation-text-entry"
          onSubmit={(event) => {
            event.preventDefault();
            commitText();
          }}
          style={{
            left: `${(textPoint.x / annotationSize.width) * 100}%`,
            top: `${(textPoint.y / annotationSize.height) * 100}%`
          }}
        >
          <input
            aria-label="Annotation text"
            onBlur={commitText}
            onChange={(event) => setTextValue(event.target.value)}
            placeholder="Type annotation"
            ref={annotationTextInput}
            value={textValue}
          />
        </form>
      )}
    </div>
  ) : null;
  const overlay = (
    <>
      {annotationLayer}
      {!app.isAnnotationMode && app.isAXTreeOpen && axSnapshot && (
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
      {!app.isAnnotationMode && app.isAXTreeOpen && (!axSnapshot || app.axError) && (
        <span
          className="selection-status"
          role="status"
        >
          {app.axError ? 'Selection unavailable. Reconnect and try again.' : 'Preparing selection…'}
        </span>
      )}
    </>
  );
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
  const annotationToolbar = app.isAnnotationMode && (
    <div
      className="canvas-annotation-toolbar"
      data-canvas-ui
    >
      <div
        aria-label="Annotation tools"
        className="canvas-annotation-tool-group"
        role="toolbar"
      >
        <strong>Annotate</strong>
        {annotationTools.map((tool) => (
          <Button
            aria-label={tool.label}
            aria-pressed={activeTool === tool.id}
            className={activeTool === tool.id ? 'active' : undefined}
            key={tool.id}
            onClick={() => {
              setActiveTool(tool.id);
              setTextPoint(null);
            }}
            title={tool.label}
            type="button"
          >
            <ActionIcon icon={tool.icon} />
            <span>{tool.label}</span>
          </Button>
        ))}
      </div>
      <div className="canvas-annotation-action-group">
        <Button
          aria-label="Undo last annotation"
          disabled={!annotations.length}
          onClick={() => setAnnotations((current) => current.slice(0, -1))}
          title="Undo"
          type="button"
        >
          <ActionIcon icon={Undo02Icon} />
          <span>Undo</span>
        </Button>
        <Button
          aria-label="Clear annotations"
          disabled={!annotations.length}
          onClick={() => setAnnotations([])}
          title="Clear"
          type="button"
        >
          <ActionIcon icon={Delete02Icon} />
          <span>Clear</span>
        </Button>
        <span className="canvas-annotation-divider" />
        <Button
          onClick={app.closeAnnotation}
          type="button"
        >
          <ActionIcon icon={Cancel01Icon} />
          <span>Cancel</span>
        </Button>
        <Button
          className="annotation-done"
          disabled={isFinishingAnnotation}
          onClick={() => void finishAnnotation()}
          type="button"
        >
          <ActionIcon
            icon={ArrowUpRight01Icon}
            spinning={isFinishingAnnotation}
          />
          <span>{isFinishingAnnotation ? 'Finishing…' : 'Finish'}</span>
        </Button>
      </div>
      {annotationError && (
        <span
          className="canvas-annotation-error"
          role="alert"
        >
          {annotationError}
        </span>
      )}
    </div>
  );

  return (
    <>
      <div
        className={`device-cluster canvas-mode-${canvasMode}`}
        data-canvas-ui
        style={{
          left: `calc(${modeLeft} + ${app.canvasOffset.x}px)`,
          top: `calc(50% + ${app.canvasOffset.y}px)`,
          transform: `translate(-50%, -50%) scale(${app.canvasScale * modeScale})`
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
          overlay={overlay}
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
      {app.isAnnotationMode && connectorPaths.length > 0 && (
        <svg
          aria-hidden="true"
          className="canvas-annotation-connectors"
        >
          {connectorPaths.map((connector) => (
            <path
              d={connector.d}
              key={connector.id}
            />
          ))}
        </svg>
      )}
      {app.isAnnotationMode && callouts.length > 0 && (
        <aside
          aria-label="Implementation notes"
          className="canvas-annotation-notes"
          data-canvas-ui
        >
          <header>
            <div>
              <strong>Implementation notes</strong>
              <span>Numbered targets and notes are sent to the agent.</span>
            </div>
            <output>{callouts.length}</output>
          </header>
          <ol ref={annotationNotesList}>
            {callouts.map((callout, index) => (
              <li key={callout.id}>
                <span className="canvas-annotation-note-number">{index + 1}</span>
                <label>
                  <span>{calloutTypeLabel[callout.type]}</span>
                  <textarea
                    aria-invalid={!callout.note.trim()}
                    aria-label={`Note ${index + 1}`}
                    onChange={(event) => updateNote(callout.id, event.target.value)}
                    placeholder="Describe what should change…"
                    ref={(node) => {
                      if (node) noteInputs.current.set(callout.id, node);
                      else noteInputs.current.delete(callout.id);
                    }}
                    rows={3}
                    value={callout.note}
                  />
                </label>
              </li>
            ))}
          </ol>
        </aside>
      )}
      {annotationToolbar}
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
  );
}
