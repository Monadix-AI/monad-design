export const embeddedUiPath = (name: string) => {
  const normalizedName = name.replaceAll('\\', '/');
  const marker = '/ui/dist/';
  const markerIndex = normalizedName.lastIndexOf(marker);
  if (markerIndex >= 0) return normalizedName.slice(markerIndex + marker.length);
  if (normalizedName.startsWith('ui/dist/')) return normalizedName.slice('ui/dist/'.length);
  if (normalizedName.startsWith('dist/')) return normalizedName.slice('dist/'.length);

  const basename = normalizedName.slice(normalizedName.lastIndexOf('/') + 1);
  return basename === 'index.html' ? basename : null;
};

export const requestedUiPath = (pathname: string) => (pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
