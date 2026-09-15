// beUI Button press motion adapted for existing compact workbench controls (MIT).
// Source: https://beui.dev/r/button/raw
import { type HTMLMotionProps, motion, useReducedMotion } from 'motion/react';

import { springPress } from './motion';

export function InstrumentButton({ disabled, transition, whileHover, whileTap, ...props }: HTMLMotionProps<'button'>) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      disabled={disabled}
      transition={transition ?? springPress}
      whileHover={reduceMotion || disabled ? undefined : (whileHover ?? { scale: 1.015 })}
      whileTap={reduceMotion || disabled ? undefined : (whileTap ?? { scale: 0.96 })}
      {...props}
    />
  );
}
