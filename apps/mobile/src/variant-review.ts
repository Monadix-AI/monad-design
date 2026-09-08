import type { SimulatorVariantId } from '@monaddesign/simulator';

export async function applyVariantReviewAction({
  action,
  variant,
  launchOriginal,
  launchVariant,
  onPreview,
  confirmSelection
}: {
  action: 'preview' | 'accept' | 'discard';
  variant: SimulatorVariantId;
  launchOriginal: () => Promise<unknown>;
  launchVariant: (variant: SimulatorVariantId) => Promise<unknown>;
  onPreview: (variant: SimulatorVariantId) => void;
  confirmSelection?: (variant: SimulatorVariantId) => Promise<void>;
}) {
  const target = action === 'discard' ? 'original' : variant;
  if (target === 'original') await launchOriginal();
  else await launchVariant(target);
  onPreview(target);
  if (action !== 'preview') await confirmSelection?.(target);
}

export function variantComparisonLayout(viewport: { width: number; height: number }, count: number) {
  const columns = viewport.width >= 900 ? 3 : viewport.width >= 500 ? 2 : 1;
  const rows = Math.ceil(Math.max(1, count) / columns);
  const tileWidth = Math.max(120, (viewport.width - 36 - (columns - 1) * 14) / columns);
  const tileHeight = Math.max(180, (viewport.height - 76 - (rows - 1) * 14) / rows);
  return {
    tileWidth,
    tileHeight,
    width: columns * tileWidth + (columns - 1) * 14 + 36,
    height: rows * tileHeight + (rows - 1) * 14 + 76
  };
}
