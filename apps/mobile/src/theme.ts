export const colors = {
  background: '#0d0e11',
  panel: '#111216',
  panelRaised: '#191b20',
  border: '#303238',
  text: '#eef0f4',
  muted: '#8d929c',
  accent: '#a8ff78',
  danger: '#ff7388'
};

export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : 'Something went wrong.';
