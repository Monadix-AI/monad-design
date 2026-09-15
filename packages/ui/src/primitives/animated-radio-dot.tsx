// beUI Radio spring selection adapted to existing Radix radio semantics (MIT).
// Source: https://beui.dev/r/radio/raw
import { motion, useReducedMotion } from 'motion/react';
import { RadioGroup } from 'radix-ui';

import { springSwap } from './motion';

export function AnimatedRadioDot({ className }: { className: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <span
      aria-hidden="true"
      className={className}
    >
      <RadioGroup.Indicator asChild>
        <motion.span
          animate={{ scale: 1 }}
          className="animated-radio-dot"
          initial={reduceMotion ? false : { scale: 0 }}
          transition={reduceMotion ? { duration: 0 } : springSwap}
        />
      </RadioGroup.Indicator>
    </span>
  );
}
