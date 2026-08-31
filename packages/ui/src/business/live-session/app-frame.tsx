import type { HTMLAttributes, ReactNode, Ref } from 'react';

export function AppHeaderFrame({ actions, center }: { actions?: ReactNode; center?: ReactNode }) {
  return (
    <header className="app-header">
      <div className="app-header-center">{center}</div>
      {actions ? (
        <nav
          aria-label="Application controls"
          className="app-header-actions"
        >
          {actions}
        </nav>
      ) : null}
    </header>
  );
}

export function LiveWorkspaceFrame({
  canvas,
  canvasProps,
  error,
  header,
  heading,
  inspector,
  mode = 'interact'
}: {
  canvas: ReactNode;
  canvasProps?: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };
  error?: ReactNode;
  header?: ReactNode;
  heading?: ReactNode;
  inspector?: ReactNode;
  mode?: 'annotate' | 'interact' | 'variants';
}) {
  const { className, ...props } = canvasProps ?? {};
  return (
    <div className="app-shell connected-shell">
      {header}
      <div
        className={`free-canvas ${mode}-mode ${className ?? ''}`.trim()}
        {...props}
      >
        {mode === 'interact' ? heading : null}
        {canvas}
        {inspector}
        {error ? (
          <div
            className="canvas-error"
            data-canvas-ui
            role="alert"
          >
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
