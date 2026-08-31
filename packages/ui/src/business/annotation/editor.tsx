import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../primitives/button';
import {
  type Annotation,
  AnnotationShape,
  type AnnotationTool,
  annotationId,
  annotationInk,
  annotationIsVisible,
  buildCalloutLayout,
  calloutAnchor,
  calloutConnectorPath,
  type DrawnAnnotation,
  type ImageSize,
  isDrawnAnnotation,
  type Point
} from './model';

const tools: AnnotationTool[] = ['rectangle', 'ellipse', 'text', 'arrow'];

const wrapCanvasText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/u)) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || context.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export function AnnotationEditor({
  activeTool: controlledTool,
  embedded = false,
  image,
  isRecapturing = false,
  onClose,
  onFinish,
  onRecapture,
  onActiveToolChange
}: {
  activeTool?: AnnotationTool;
  embedded?: boolean;
  image: string;
  isRecapturing?: boolean;
  onClose?: () => void;
  onFinish?: (image: string) => Promise<void> | void;
  onRecapture?: () => void;
  onActiveToolChange?: (tool: AnnotationTool) => void;
}) {
  const [internalActiveTool, setInternalActiveTool] = useState<AnnotationTool>('rectangle');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<DrawnAnnotation | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [textPoint, setTextPoint] = useState<Point | null>(null);
  const [textValue, setTextValue] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState('');
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
  const finish = async () => {
    if (!onFinish || !imageSize || !overlay.current || isFinishing) return;
    const missingNote = callouts.find(({ note }) => !note.trim());
    if (missingNote) {
      setFinishError('Add a note to every numbered callout before finishing.');
      return;
    }
    setIsFinishing(true);
    setFinishError('');
    try {
      const source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const value = new Image();
        value.onload = () => resolve(value);
        value.onerror = () => reject(new Error('Could not load the annotation screenshot.'));
        value.src = image;
      });
      const scaleX = source.naturalWidth / imageSize.width;
      const scaleY = source.naturalHeight / imageSize.height;
      const renderedCallouts = callouts.map((callout) => ({
        ...callout,
        start: { x: callout.start.x * scaleX, y: callout.start.y * scaleY },
        end: { x: callout.end.x * scaleX, y: callout.end.y * scaleY }
      }));
      const layout = buildCalloutLayout({ width: source.naturalWidth, height: source.naturalHeight }, renderedCallouts);
      const canvas = document.createElement('canvas');
      canvas.width = layout.width;
      canvas.height = layout.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas rendering is unavailable.');
      context.fillStyle = '#0d0d0d';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0);
      const clone = overlay.current?.cloneNode(true) as SVGSVGElement | undefined;
      if (!clone) throw new Error('The annotation layer is unavailable.');
      clone.querySelector('[data-annotation-hit-target]')?.remove();
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(source.naturalWidth));
      clone.setAttribute('height', String(source.naturalHeight));
      const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' })
      );
      try {
        const annotation = await new Promise<HTMLImageElement>((resolve, reject) => {
          const value = new Image();
          value.onload = () => resolve(value);
          value.onerror = () => reject(new Error('Could not render the annotation layer.'));
          value.src = url;
        });
        context.drawImage(annotation, 0, 0, source.naturalWidth, source.naturalHeight);
      } finally {
        URL.revokeObjectURL(url);
      }
      if (renderedCallouts.length) {
        context.fillStyle = '#15171a';
        context.fillRect(layout.sidecarLeft, 0, layout.sidecarWidth, canvas.height);
        const headingSize = Math.max(38, source.naturalWidth * 0.045);
        const bodySize = Math.max(28, source.naturalWidth * 0.028);
        context.fillStyle = '#f2f3f5';
        context.font = `700 ${headingSize}px Inter, system-ui, sans-serif`;
        context.fillText('Implementation notes', layout.sidecarLeft + layout.padding, layout.padding + headingSize);
        renderedCallouts.forEach((callout, index) => {
          const box = layout.boxes[index];
          if (!box) return;
          context.strokeStyle = annotationInk;
          context.lineWidth = Math.max(4, source.naturalWidth * 0.004);
          context.stroke(new Path2D(calloutConnectorPath(callout, box).d));
          context.fillStyle = '#202328';
          context.beginPath();
          context.roundRect(box.x, box.y, box.width, box.height, 14);
          context.fill();
          const badgeRadius = Math.max(25, source.naturalWidth * 0.023);
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
          context.fillStyle = '#f2f3f5';
          context.font = `500 ${bodySize}px Inter, system-ui, sans-serif`;
          wrapCanvasText(context, callout.note.trim(), box.x + box.width - textX - layout.padding)
            .slice(0, 8)
            .forEach((line, lineIndex) => {
              context.fillText(line, textX, box.y + layout.padding + bodySize + lineIndex * bodySize * 1.4);
            });
        });
      }
      await onFinish(canvas.toDataURL('image/png'));
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : 'Could not finish the annotation.');
    } finally {
      setIsFinishing(false);
    }
  };
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
  const actions = (onClose || onRecapture || onFinish) && (
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
      {onFinish && (
        <Button
          disabled={isFinishing}
          onClick={() => void finish()}
          size="sm"
          type="button"
        >
          {isFinishing ? 'Finishing…' : 'Finish'}
        </Button>
      )}
      {finishError ? <span role="alert">{finishError}</span> : null}
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
                data-annotation-hit-target
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
