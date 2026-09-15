// beUI Input error shake adapted to the workbench's existing field geometry (MIT).
// Source: https://beui.dev/r/input/raw
import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

import { cn } from './utils';

function Input({ className, ref, type, ...props }: React.ComponentProps<'input'>) {
  const field = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';

  useEffect(() => {
    if (!invalid || reduceMotion || !field.current) return;
    animate(field.current, { x: [0, -4, 4, -3, 3, 0] }, { duration: 0.38 });
  }, [invalid, reduceMotion]);

  return (
    <input
      className={cn(
        'h-9 w-full min-w-0 rounded-md border-0 bg-(--field-fill) px-3 py-1 text-base outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className
      )}
      data-slot="input"
      ref={(node) => {
        field.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref && typeof ref === 'object') (ref as { current: HTMLInputElement | null }).current = node;
      }}
      type={type}
      {...props}
    />
  );
}

export { Input };
