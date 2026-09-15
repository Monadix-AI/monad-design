import { cva, type VariantProps } from 'class-variance-authority';
import { type HTMLMotionProps, motion, useReducedMotion } from 'motion/react';
import { Slot } from 'radix-ui';

import { springPress } from './motion';
import { cn } from './utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20',
        outline: 'border-0 bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
);

export type ButtonProps = HTMLMotionProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    pressScale?: number;
  };

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  pressScale = 0.96,
  ...props
}: ButtonProps) {
  const reduceMotion = useReducedMotion();
  const classes = cn(buttonVariants({ variant, size, className }));

  if (asChild) {
    return (
      <Slot.Root
        className={classes}
        data-size={size}
        data-slot="button"
        data-variant={variant}
        {...(props as React.ComponentProps<'button'>)}
      />
    );
  }

  return (
    <motion.button
      className={classes}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      transition={springPress}
      whileHover={reduceMotion || props.disabled ? undefined : { scale: 1.015 }}
      whileTap={reduceMotion || props.disabled ? undefined : { scale: pressScale }}
      {...props}
    />
  );
}

export { Button, buttonVariants };
