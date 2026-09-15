// Adapted from beUI Animated Badge (MIT): https://beui.dev/r/animated-badge/raw

import type { ReactNode } from 'react';

import { AnimatePresence, type HTMLMotionProps, motion, useReducedMotion, type Variants } from 'motion/react';

import { motionEaseOut, springSwap } from './motion';
import { cn } from './utils';

export type AnimatedBadgeStatus = 'neutral' | 'info' | 'success' | 'danger' | 'loading';

export interface AnimatedBadgeProps extends Omit<HTMLMotionProps<'span'>, 'children'> {
  children?: ReactNode;
  contentKey?: string | number;
  icon?: ReactNode;
  pulse?: boolean;
  status?: AnimatedBadgeStatus;
}

const badgeTone: Record<AnimatedBadgeStatus, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-primary',
  success: 'text-[var(--success-emphasis)]',
  danger: 'text-destructive',
  loading: 'text-primary'
};

const roll: Variants = {
  initial: { opacity: 0, y: '75%', filter: 'blur(5px)' },
  animate: {
    opacity: 1,
    y: '0%',
    filter: 'blur(0px)',
    transition: { ...springSwap, opacity: { duration: 0.24, ease: motionEaseOut } }
  },
  exit: { opacity: 0, y: '-75%', filter: 'blur(5px)', transition: { duration: 0.18, ease: motionEaseOut } }
};

export function AnimatedBadge({
  children,
  contentKey,
  icon,
  pulse,
  status = 'neutral',
  className,
  ...props
}: AnimatedBadgeProps) {
  const reduceMotion = useReducedMotion();
  const resolvedKey = contentKey ?? (typeof children === 'string' || typeof children === 'number' ? children : status);
  const shouldPulse = pulse ?? status === 'loading';

  return (
    <motion.span
      className={cn(
        'relative inline-flex shrink-0 items-center overflow-hidden whitespace-nowrap tabular-nums',
        badgeTone[status],
        className
      )}
      layout
      transition={springSwap}
      {...props}
    >
      {shouldPulse && !reduceMotion ? (
        <motion.span
          animate={{ opacity: [0.04, 0.12, 0.04], scale: [0.94, 1.06, 0.94] }}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-current"
          transition={{ duration: 1.6, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
        />
      ) : null}
      {icon ? (
        <span className="relative z-10 inline-flex items-center justify-center overflow-hidden">
          <AnimatePresence
            initial={false}
            mode="popLayout"
          >
            <motion.span
              animate={reduceMotion ? { opacity: 1 } : 'animate'}
              aria-hidden="true"
              exit={reduceMotion ? undefined : 'exit'}
              initial={reduceMotion ? false : 'initial'}
              key={`${status}-icon`}
              variants={roll}
            >
              {icon}
            </motion.span>
          </AnimatePresence>
        </span>
      ) : null}
      {children == null ? null : (
        <span className="relative z-10 inline-flex overflow-hidden">
          <AnimatePresence
            initial={false}
            mode="popLayout"
          >
            <motion.span
              animate={reduceMotion ? { opacity: 1 } : 'animate'}
              exit={reduceMotion ? undefined : 'exit'}
              initial={reduceMotion ? false : 'initial'}
              key={resolvedKey}
              variants={roll}
            >
              {children}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
    </motion.span>
  );
}
