// Adapted from beUI Stateful Button (MIT): https://beui.dev/r/button/raw

import type { ReactNode } from 'react';

import { Check, LoaderCircle, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { Button, type ButtonProps } from './button';
import { springSwap } from './motion';

export type StatefulButtonState = 'idle' | 'loading' | 'success' | 'error';

export interface StatefulButtonProps extends Omit<ButtonProps, 'children'> {
  children: ReactNode;
  errorText?: ReactNode;
  loadingText?: ReactNode;
  state?: StatefulButtonState;
  successText?: ReactNode;
}

export function StatefulButton({
  children,
  disabled,
  errorText = 'Try again',
  loadingText = 'Loading…',
  state = 'idle',
  successText = 'Done',
  ...props
}: StatefulButtonProps) {
  const reduceMotion = useReducedMotion();
  const content =
    state === 'loading' ? loadingText : state === 'success' ? successText : state === 'error' ? errorText : children;

  return (
    <Button
      aria-busy={state === 'loading'}
      disabled={disabled || state === 'loading'}
      {...props}
    >
      <AnimatePresence
        initial={false}
        mode="popLayout"
      >
        <motion.span
          animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
          className="inline-flex items-center justify-center gap-2"
          exit={reduceMotion ? { opacity: 0 } : { filter: 'blur(5px)', opacity: 0, y: -8 }}
          initial={reduceMotion ? { opacity: 0 } : { filter: 'blur(5px)', opacity: 0, y: 8 }}
          key={state}
          transition={reduceMotion ? { duration: 0.12 } : springSwap}
        >
          {state === 'loading' ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {state === 'success' ? <Check className="size-4" /> : null}
          {state === 'error' ? <X className="size-4" /> : null}
          <span>{content}</span>
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
