import type { SimulatorOrientation } from '@monaddesign/simulator';
import type {
  AnnotationPoint,
  AnnotationTool,
  DrawnAnnotation,
  ShapeAnnotation
} from '@monaddesign/simulator/annotation';
import type { PointerEvent, ReactNode } from 'react';

import ArrowUpRight01Icon from '@hugeicons/core-free-icons/ArrowUpRight01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import EllipseIcon from '@hugeicons/core-free-icons/EllipseIcon';
import SquareIcon from '@hugeicons/core-free-icons/SquareIcon';
import TextIcon from '@hugeicons/core-free-icons/TextIcon';
import Undo02Icon from '@hugeicons/core-free-icons/Undo02Icon';
import {
  annotationBounds,
  annotationContainsPoint,
  annotationId,
  annotationInk,
  annotationIsVisible,
  calloutBadgeGeometry,
  isDrawnAnnotation,
  translateAnnotation
} from '@monaddesign/simulator/annotation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../primitives/button';
import { ActionIcon } from '../action-icon';
import { AnnotationShape } from './model';

type Point = AnnotationPoint;

const annotationTools = [
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'text', label: 'Text' },
  { id: 'arrow', label: 'Arrow' }
] as const;

const calloutTypeLabel: Record<DrawnAnnotation['type'], string> = {
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  arrow: 'Arrow'
};

type ConnectorPath = { d: string; id: string };

const sameConnectorPaths = (current: ConnectorPath[], next: ConnectorPath[]) =>
  current.length === next.length &&
  current.every((path, index) => path.id === next[index]?.id && path.d === next[index]?.d);

const loadImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the Simulator screenshot.'));
    image.src = source;
  });

const orientedScreenshot = (source: HTMLImageElement, orientation: SimulatorOrientation) => {
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

const composeAnnotation = async ({
  captureImage,
  orientation,
  overlay
}: {
  captureImage: () => Promise<string>;
  orientation: SimulatorOrientation;
  overlay: SVGSVGElement;
}) => {
  const source = await loadImage(await captureImage());
  const clonedOverlay = overlay.cloneNode(true) as SVGSVGElement;
  for (const interaction of clonedOverlay.querySelectorAll('[data-annotation-interaction]')) interaction.remove();
  clonedOverlay.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const screenshot = orientedScreenshot(source, orientation);
  clonedOverlay.setAttribute('width', String(screenshot.width));
  clonedOverlay.setAttribute('height', String(screenshot.height));
  const canvas = document.createElement('canvas');
  canvas.width = screenshot.width;
  canvas.height = screenshot.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is unavailable.');
  context.fillStyle = '#0d0d0d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(screenshot, 0, 0);
  const overlayUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clonedOverlay)], { type: 'image/svg+xml' })
  );
  try {
    context.drawImage(await loadImage(overlayUrl), 0, 0, screenshot.width, screenshot.height);
  } finally {
    URL.revokeObjectURL(overlayUrl);
  }
  return canvas.toDataURL('image/png');
};

export interface LiveAnnotationIcons {
  cancel?: ReactNode;
  clear?: ReactNode;
  finish?: ReactNode;
  finishing?: ReactNode;
  remove?: ReactNode;
  tools?: Partial<Record<AnnotationTool, ReactNode>>;
  undo?: ReactNode;
}

export function LiveAnnotationSurface({
  active,
  captureImage,
  children,
  icons,
  imageSize,
  onCancel,
  onFinish,
  orientation
}: {
  active: boolean;
  captureImage: () => Promise<string>;
  children: (overlay: ReactNode) => ReactNode;
  icons?: LiveAnnotationIcons;
  imageSize: { height: number; width: number };
  onCancel: () => void;
  onFinish: (annotationScreenshot: string) => Promise<void>;
  orientation: SimulatorOrientation;
}) {
  const resolvedIcons: LiveAnnotationIcons = {
    cancel: <ActionIcon icon={Cancel01Icon} />,
    clear: <ActionIcon icon={Delete02Icon} />,
    finish: <ActionIcon icon={ArrowUpRight01Icon} />,
    finishing: (
      <ActionIcon
        icon={ArrowUpRight01Icon}
        spinning
      />
    ),
    remove: <ActionIcon icon={Delete02Icon} />,
    undo: <ActionIcon icon={Undo02Icon} />,
    ...icons,
    tools: {
      arrow: <ActionIcon icon={ArrowUpRight01Icon} />,
      ellipse: <ActionIcon icon={EllipseIcon} />,
      rectangle: <ActionIcon icon={SquareIcon} />,
      text: <ActionIcon icon={TextIcon} />,
      ...icons?.tools
    }
  };
  const [activeTool, setActiveTool] = useState<AnnotationTool>('rectangle');
  const [annotations, setAnnotations] = useState<ShapeAnnotation[]>([]);
  const [draft, setDraft] = useState<DrawnAnnotation | null>(null);
  const [textPoint, setTextPoint] = useState<Point | null>(null);
  const [textValue, setTextValue] = useState('');
  const [annotationError, setAnnotationError] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectorPaths, setConnectorPaths] = useState<ConnectorPath[]>([]);
  const annotationOverlay = useRef<SVGSVGElement | null>(null);
  const annotationTextInput = useRef<HTMLInputElement | null>(null);
  const annotationNotesList = useRef<HTMLOListElement | null>(null);
  const noteInputs = useRef(new Map<string, HTMLTextAreaElement>());
  const draftRef = useRef<DrawnAnnotation | null>(null);
  const drawingPointerId = useRef<number | null>(null);
  const dragRef = useRef<{
    annotation: ShapeAnnotation;
    origin: Point;
    pointerId: number;
  } | null>(null);
  const callouts = useMemo(() => annotations.filter(isDrawnAnnotation), [annotations]);
  const calloutsRef = useRef(callouts);
  const imageSizeRef = useRef(imageSize);
  calloutsRef.current = callouts;
  imageSizeRef.current = imageSize;

  useEffect(() => {
    if (active) return;
    setActiveTool('rectangle');
    setAnnotations([]);
    setDraft(null);
    setTextPoint(null);
    setTextValue('');
    setAnnotationError('');
    setIsFinishing(false);
    setSelectedId(null);
    setConnectorPaths([]);
    noteInputs.current.clear();
    draftRef.current = null;
    drawingPointerId.current = null;
    dragRef.current = null;
  }, [active]);
  useEffect(() => {
    if (!active || !selectedId) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      setAnnotations((current) => current.filter(({ id }) => id !== selectedId));
      setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, selectedId]);
  useEffect(() => {
    if (!textPoint) return;
    const frame = window.requestAnimationFrame(() => annotationTextInput.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [textPoint]);
  useLayoutEffect(() => {
    if (!active || !callouts.length) {
      setConnectorPaths([]);
      return;
    }
    const canvas = annotationOverlay.current?.closest('.free-canvas');
    if (!(canvas instanceof HTMLElement) || !annotationOverlay.current) return;
    let frame = 0;
    const updateConnectors = () => {
      if (!annotationOverlay.current) return;
      const canvasBounds = canvas.getBoundingClientRect();
      const overlayBounds = annotationOverlay.current.getBoundingClientRect();
      const currentImageSize = imageSizeRef.current;
      const nextPaths = calloutsRef.current.flatMap((callout) => {
        const note = noteInputs.current.get(callout.id)?.closest('li');
        if (!(note instanceof HTMLElement)) return [];
        const noteBounds = note.getBoundingClientRect();
        const radius = Math.max(13, currentImageSize.width * 0.019);
        const badge = calloutBadgeGeometry(callout, currentImageSize, radius);
        const start = {
          x:
            overlayBounds.left - canvasBounds.left + (badge.connector.x / currentImageSize.width) * overlayBounds.width,
          y: overlayBounds.top - canvasBounds.top + (badge.connector.y / currentImageSize.height) * overlayBounds.height
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
      });
      setConnectorPaths((current) => (sameConnectorPaths(current, nextPaths) ? current : nextPaths));
    };
    const trackConnectors = () => {
      updateConnectors();
      frame = window.requestAnimationFrame(trackConnectors);
    };
    trackConnectors();
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [active, callouts.length]);

  const annotationPoint = (event: PointerEvent<SVGRectElement>) => {
    const bounds = annotationOverlay.current?.getBoundingClientRect();
    if (!bounds) return null;
    const point = {
      x: ((event.clientX - bounds.left) / bounds.width) * imageSize.width,
      y: ((event.clientY - bounds.top) / bounds.height) * imageSize.height
    };
    return point.x >= 0 && point.x <= imageSize.width && point.y >= 0 && point.y <= imageSize.height ? point : null;
  };
  const startAnnotation = (event: PointerEvent<SVGRectElement>) => {
    if (!event.isPrimary || drawingPointerId.current !== null) return;
    const point = annotationPoint(event);
    if (!point) return;
    setAnnotationError('');
    const selected = [...annotations].reverse().find((annotation) => annotationContainsPoint(annotation, point));
    if (selected) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedId(selected.id);
      dragRef.current = { annotation: selected, origin: point, pointerId: event.pointerId };
      drawingPointerId.current = event.pointerId;
      return;
    }
    setSelectedId(null);
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
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const point = annotationPoint(event);
      if (!point) return;
      const moved = translateAnnotation(
        drag.annotation,
        { x: point.x - drag.origin.x, y: point.y - drag.origin.y },
        imageSize
      );
      setAnnotations((current) => current.map((annotation) => (annotation.id === moved.id ? moved : annotation)));
      return;
    }
    if (event.pointerId !== drawingPointerId.current || !draftRef.current) return;
    const point = annotationPoint(event);
    if (!point) return;
    draftRef.current = { ...draftRef.current, end: point };
    setDraft(draftRef.current);
  };
  const finishAnnotationGesture = (event: PointerEvent<SVGRectElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      drawingPointerId.current = null;
      return;
    }
    if (event.pointerId !== drawingPointerId.current || !draftRef.current) return;
    const finished = { ...draftRef.current, end: annotationPoint(event) ?? draftRef.current.end };
    if (annotationIsVisible(finished)) {
      setAnnotations((current) => [...current, finished]);
      setSelectedId(finished.id);
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
  const deleteSelected = () => {
    if (!selectedId) return;
    setAnnotations((current) => current.filter(({ id }) => id !== selectedId));
    setSelectedId(null);
  };
  const finishAnnotation = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    setAnnotationError('');
    try {
      commitText();
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      if (!annotationOverlay.current) throw new Error('The annotation layer is unavailable.');
      await onFinish(
        await composeAnnotation({
          captureImage,
          orientation,
          overlay: annotationOverlay.current
        })
      );
    } catch (error) {
      setAnnotationError(error instanceof Error ? error.message : 'Could not send the annotation to the agent.');
    } finally {
      setIsFinishing(false);
    }
  };

  const annotationLayer = active ? (
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
        viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
      >
        <title>Draw annotations on the live Simulator view</title>
        {annotations.map((annotation) => (
          <AnnotationShape
            annotation={annotation}
            imageSize={imageSize}
            key={annotation.id}
          />
        ))}
        {selectedId &&
          (() => {
            const selected = annotations.find(({ id }) => id === selectedId);
            if (!selected) return null;
            const bounds = annotationBounds(selected);
            const padding = Math.max(7, imageSize.width * 0.009);
            return (
              <rect
                data-annotation-interaction
                fill="none"
                height={bounds.height + padding * 2}
                pointerEvents="none"
                rx={padding}
                stroke="#ffffff"
                strokeDasharray={`${padding} ${padding * 0.7}`}
                strokeWidth={Math.max(2, imageSize.width * 0.0025)}
                width={bounds.width + padding * 2}
                x={bounds.x - padding}
                y={bounds.y - padding}
              />
            );
          })()}
        {draft && (
          <AnnotationShape
            annotation={draft}
            imageSize={imageSize}
          />
        )}
        {callouts.map((callout, index) => {
          const radius = Math.max(13, imageSize.width * 0.019);
          const badge = calloutBadgeGeometry(callout, imageSize, radius);
          return (
            <g key={`badge-${callout.id}`}>
              <circle
                cx={badge.center.x}
                cy={badge.center.y}
                fill={annotationInk}
                r={radius}
              />
              <text
                dominantBaseline="central"
                fill="#0d0d0d"
                fontSize={radius}
                fontWeight="800"
                textAnchor="middle"
                x={badge.center.x}
                y={badge.center.y}
              >
                {index + 1}
              </text>
            </g>
          );
        })}
        <rect
          data-annotation-hit-target
          data-annotation-interaction
          fill="transparent"
          height={imageSize.height}
          onPointerCancel={finishAnnotationGesture}
          onPointerDown={startAnnotation}
          onPointerMove={moveAnnotation}
          onPointerUp={finishAnnotationGesture}
          pointerEvents="all"
          width={imageSize.width}
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
            left: `${(textPoint.x / imageSize.width) * 100}%`,
            top: `${(textPoint.y / imageSize.height) * 100}%`
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

  return (
    <>
      {children(annotationLayer)}
      {active && connectorPaths.length > 0 && (
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
      {active && callouts.length > 0 && (
        <aside
          aria-label="Implementation notes"
          className="canvas-annotation-notes"
          data-canvas-ui
        >
          <header>
            <div>
              <strong>Implementation notes</strong>
              <span>Notes are optional and stay outside the sent image.</span>
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
      {active && (
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
                {resolvedIcons.tools?.[tool.id]}
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
              {resolvedIcons.undo}
              <span>Undo</span>
            </Button>
            <Button
              aria-label="Delete selected annotation"
              disabled={!selectedId}
              onClick={deleteSelected}
              title="Delete"
              type="button"
            >
              {resolvedIcons.remove}
              <span>Delete</span>
            </Button>
            <Button
              aria-label="Clear annotations"
              disabled={!annotations.length}
              onClick={() => {
                setAnnotations([]);
                setSelectedId(null);
              }}
              title="Clear"
              type="button"
            >
              {resolvedIcons.clear}
              <span>Clear</span>
            </Button>
            <span className="canvas-annotation-divider" />
            <Button
              onClick={onCancel}
              type="button"
            >
              {resolvedIcons.cancel}
              <span>Cancel</span>
            </Button>
            <Button
              className="annotation-done"
              disabled={isFinishing}
              onClick={() => void finishAnnotation()}
              type="button"
            >
              {isFinishing ? (resolvedIcons.finishing ?? resolvedIcons.finish) : resolvedIcons.finish}
              <span>{isFinishing ? 'Finishing…' : 'Finish'}</span>
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
      )}
    </>
  );
}
