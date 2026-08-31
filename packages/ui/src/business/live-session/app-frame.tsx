import type { HTMLAttributes, ReactNode, Ref } from 'react';

import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';

import { ActionIcon } from '../action-icon';

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

export function LiveWorkspaceHeading({
  backLabel = 'Simulators',
  isLive,
  name,
  onBack,
  previewLabel
}: {
  backLabel?: string;
  isLive: boolean;
  name: string;
  onBack: () => void;
  previewLabel?: string;
}) {
  return (
    <div
      className="canvas-page-heading"
      data-canvas-ui
    >
      <button
        className="page-back"
        onClick={onBack}
        type="button"
      >
        <ActionIcon icon={ArrowLeft01Icon} />
        {backLabel}
      </button>
      <h1>{name}</h1>
      <div
        className="live-device-status"
        role="status"
      >
        <span className={`connection-light ${isLive ? 'online' : ''}`} />
        <span>{isLive ? 'Live' : 'Starting stream…'}</span>
        {previewLabel ? <em>{previewLabel} · preview only</em> : null}
      </div>
    </div>
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
