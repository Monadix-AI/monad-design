import type { ErrorInfo } from 'react';

// Vite registers this element in /@vite/client during development. The route
// boundary still renders TanStack's error component if Vite is unavailable.
export function showViteRuntimeOverlay(error: unknown, info: ErrorInfo) {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Vite's built-in development flag
  if (!import.meta.env.DEV || typeof document === 'undefined') return;

  const Overlay = customElements.get('vite-error-overlay');
  if (!Overlay) return;

  const thrown = error instanceof Error ? error : new Error(String(error));
  const stack = [thrown.stack, info.componentStack && `React component stack:\n${info.componentStack}`]
    .filter(Boolean)
    .join('\n\n');

  document.querySelectorAll('vite-error-overlay').forEach((overlay) => {
    const dismiss = (overlay as HTMLElement & { close?: () => void }).close;
    if (dismiss) dismiss.call(overlay);
    else overlay.remove();
  });
  document.body.appendChild(new Overlay({ message: thrown.message, stack }));
}
