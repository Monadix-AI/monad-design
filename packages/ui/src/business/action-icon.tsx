import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';

export function ActionIcon({ icon, spinning = false }: { icon: IconSvgElement; spinning?: boolean }) {
  return (
    <HugeiconsIcon
      aria-hidden="true"
      className={spinning ? 'action-icon spin' : 'action-icon'}
      icon={icon}
      size={13}
      strokeWidth={1.8}
      style={{ width: 13, height: 13 }}
    />
  );
}
