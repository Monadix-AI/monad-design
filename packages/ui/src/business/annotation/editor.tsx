import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../primitives/button';
import {
  type Annotation,
  AnnotationShape,
  type AnnotationTool,
  annotationId,
  annotationInk,
  annotationIsVisible,
  calloutAnchor,
  type DrawnAnnotation,
  type ImageSize,
  isDrawnAnnotation,
  type Point
} from './model';

const tools: AnnotationTool[] = ['rectangle', 'ellipse', 'text', 'arrow'];

export function AnnotationEditor({
  activeTool: controlledTool,
  embedded = false,
  image,
  isRecapturing = false,
  onClose,
  onRecapture,
  onActiveToolChange
}: {
  activeTool?: AnnotationTool;
  embedded?: boolean;
  image: string;
  isRecapturing?: boolean;
  onClose?: () => void;
  onRecapture?: () => void;
  onActiveToolChange?: (tool: AnnotationTool) => void;
}) {
  const [internalActiveTool, setInternalActiveTool] = useState<AnnotationTool>('rectangle');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<DrawnAnnotation | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [textPoint, setTextPoint] = useState<Point | null>(null);
  const [textValue, setTextValue] = useState('');
  const overlay = useRef<SVGSVGElement | null>(null);
  const drawingPointerId = useRef<number | null>(null);
  const draftRef = useRef<DrawnAnnotation | null>(null);
  const callouts = useMemo(() => annotations.filter(isDrawnAnnotation), [annotations]);
  const activeTool = controlledTool ?? internalActiveTool;
  const selectTool = (tool: AnnotationTool) => {
    setInternalActiveTool(tool);
    onActiveToolChange?.(tool);
    setTextPoint(null);
  };

  useEffect(() => {
    setAnnotations([]);
    setDraft(null);
    setTextPoint(null);
    setTextValue('');
    const source = new Image();
    source.onload = () => setImageSize({ width: source.naturalWidth, height: source.naturalHeight });
    source.src = image;
  }, [image]);

  const pointFromEvent = (event: PointerEvent<SVGElement>) => {
    const bounds = overlay.current?.getBoundingClientRect();
    if (!bounds || !imageSize) return null;
    const point = {
      x: ((event.clientX - bounds.left) / bounds.width) * imageSize.width,
      y: ((event.clientY - bounds.top) / bounds.height) * imageSize.height
    };
    return point.x >= 0 && point.x <= imageSize.width && point.y >= 0 && point.y <= imageSize.height ? point : null;
  };
  const finishDrawing = (event: PointerEvent<SVGElement>) => {
    if (drawingPointerId.current !== event.pointerId || !draftRef.current) return;
    const finished = { ...draftRef.current, end: pointFromEvent(event) ?? draftRef.current.end };
    if (annotationIsVisible(finished)) setAnnotations((current) => [...current, finished]);
    drawingPointerId.current = null;
    draftRef.current = null;
    setDraft(null);
  };
  const draw = (event: PointerEvent<SVGElement>) => {
    if (drawingPointerId.current !== event.pointerId || !draftRef.current) return;
    const point = pointFromEvent(event);
    if (!point) return;
    draftRef.current = { ...draftRef.current, end: point };
    setDraft(draftRef.current);
  };
  const start = (event: PointerEvent<SVGElement>) => {
    if (event.pointerType === 'touch' || !event.isPrimary || drawingPointerId.current !== null) return;
    const point = pointFromEvent(event);
    if (!point) return;
    if (activeTool === 'text') {
      setTextPoint(point);
      setTextValue('');
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextDraft: DrawnAnnotation = { id: annotationId(), type: activeTool, start: point, end: point, note: '' };
    drawingPointerId.current = event.pointerId;
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  };
  const commitText = () => {
    if (textPoint && textValue.trim())
      setAnnotations((current) => [
        ...current,
        { id: annotationId(), type: 'text', start: textPoint, text: textValue.trim() }
      ]);
    setTextPoint(null);
    setTextValue('');
  };
  const updateNote = (id: string, note: string) =>
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === id && isDrawnAnnotation(annotation) ? { ...annotation, note } : annotation
      )
    );
  const toolbar = !embedded && (
    <div
      aria-label="Annotation tools"
      className="annotation-toolbar absolute top-4 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-lg border bg-card/95 p-1 shadow-xl"
      role="toolbar"
    >
      {tools.map((tool) => (
        <Button
          aria-pressed={activeTool === tool}
          key={tool}
          onClick={() => {
            selectTool(tool);
          }}
          size="sm"
          type="button"
          variant={activeTool === tool ? 'default' : 'secondary'}
        >
          {tool}
        </Button>
      ))}
      <Button
        disabled={!annotations.length}
        onClick={() => setAnnotations((current) => current.slice(0, -1))}
        size="sm"
        type="button"
        variant="ghost"
      >
        Undo
      </Button>
      <Button
        disabled={!annotations.length}
        onClick={() => setAnnotations([])}
        size="sm"
        type="button"
        variant="ghost"
      >
        Clear
      </Button>
    </div>
  );
  const actions = (onClose || onRecapture) && (
    <footer className="annotation-actions absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-lg border bg-card/95 p-1 shadow-xl">
      {onClose && (
        <Button
          onClick={onClose}
          size="sm"
          type="button"
          variant="secondary"
        >
          Cancel
        </Button>
      )}
      {onRecapture && (
        <Button
          disabled={isRecapturing}
          onClick={onRecapture}
          size="sm"
          type="button"
          variant="secondary"
        >
          Recapture
        </Button>
      )}
    </footer>
  );
  return (
    <section
      aria-label="Screenshot annotation"
      className={`annotation-editor ${embedded ? 'annotation-editor-embedded' : ''} relative grid h-full min-h-0 w-full min-w-0 overflow-hidden bg-background text-foreground`}
      onPointerCancel={(event) => embedded && event.stopPropagation()}
      onPointerDown={(event) => embedded && event.stopPropagation()}
      onPointerMove={(event) => embedded && event.stopPropagation()}
      onPointerUp={(event) => embedded && event.stopPropagation()}
    >
      {!embedded && (
        <header className="annotation-header absolute top-4 left-4 z-10 rounded-lg border bg-card/95 p-3 shadow-xl">
          <strong className="block text-sm">Annotate screenshot</strong>
          <span className="text-muted-foreground text-xs">Frozen frame · annotations stay local</span>
        </header>
      )}
      {toolbar}
      <div className="annotation-stage grid h-full min-h-0 min-w-0 place-items-center overflow-auto p-24">
        <div
          className="relative max-h-full max-w-full overflow-hidden rounded-xl bg-black shadow-2xl"
          style={
            imageSize
              ? ({
                  aspectRatio: `${imageSize.width}/${imageSize.height}`,
                  width: embedded ? '100%' : 'min(100%, calc((100vh - 13rem) * var(--annotation-aspect)))',
                  height: embedded ? '100%' : undefined,
                  '--annotation-aspect': imageSize.width / imageSize.height
                } as React.CSSProperties)
              : undefined
          }
        >
          {imageSize && (
            <img
              alt="Frozen Simulator screenshot for annotation"
              className="absolute inset-0 size-full object-fill"
              src={image}
            />
          )}{' '}
          {imageSize && (
            <svg
              className="absolute inset-0 size-full"
              preserveAspectRatio="none"
              ref={overlay}
              viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
            >
              <title>Numbered annotation drawing area</title>
              {annotations.map((annotation) => (
                <AnnotationShape
                  annotation={annotation}
                  imageSize={imageSize}
                  key={annotation.id}
                />
              ))}
              {draft && (
                <AnnotationShape
                  annotation={draft}
                  imageSize={imageSize}
                />
              )}
              {callouts.map((callout, index) => {
                const anchor = calloutAnchor(callout);
                const radius = Math.max(20, imageSize.width * 0.019);
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
                fill="transparent"
                height={imageSize.height}
                onPointerCancel={finishDrawing}
                onPointerDown={start}
                onPointerMove={draw}
                onPointerUp={finishDrawing}
                style={{ cursor: activeTool === 'text' ? 'text' : 'crosshair' }}
                width={imageSize.width}
                x="0"
                y="0"
              />
            </svg>
          )}
          {textPoint && imageSize && (
            <form
              className="absolute z-10 w-1/2 -translate-y-1/2"
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
                className="w-full rounded-md border border-primary bg-card px-3 py-2 text-sm"
                onBlur={commitText}
                onChange={(event) => setTextValue(event.target.value)}
                placeholder="Type a note"
                value={textValue}
              />
            </form>
          )}
        </div>
      </div>
      {callouts.length > 0 && (
        <aside className="absolute top-20 right-4 bottom-16 z-10 w-72 overflow-auto rounded-lg border bg-card/95 p-3 shadow-xl">
          <strong className="text-sm">Implementation notes</strong>
          <ol className="mt-3 grid gap-2">
            {callouts.map((callout, index) => (
              <li
                className="grid grid-cols-[1.75rem_1fr] gap-2 rounded-md border p-2"
                key={callout.id}
              >
                <span className="grid size-7 place-items-center rounded-full bg-primary font-bold text-primary-foreground text-xs">
                  {index + 1}
                </span>
                <label className="grid gap-1 text-muted-foreground text-xs uppercase">
                  {callout.type}
                  <textarea
                    aria-label={`Note ${index + 1}`}
                    className="min-h-16 resize-none rounded border bg-transparent p-2 text-foreground text-sm normal-case"
                    onChange={(event) => updateNote(callout.id, event.target.value)}
                    placeholder="Describe what should change…"
                    value={callout.note}
                  />
                </label>
              </li>
            ))}
          </ol>
        </aside>
      )}
      {actions}
    </section>
  );
}
