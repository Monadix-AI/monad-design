// beUI Select spring unfolding adapted around Radix's keyboard and focus model (MIT).
// Source: https://beui.dev/r/select/raw
import { ChevronDown } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Select } from 'radix-ui';

import { motionEaseOut, springSwap } from './motion';

export interface AnimatedSelectOption {
  disabled?: boolean;
  label: string;
  value: string;
}

export function AnimatedSelect({
  ariaDescribedBy,
  ariaLabel,
  className,
  contentClassName,
  disabled,
  id,
  onValueChange,
  options,
  optionClassName,
  triggerClassName,
  value
}: {
  ariaDescribedBy?: string;
  ariaLabel?: string;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  id?: string;
  onValueChange: (value: string) => void;
  options: AnimatedSelectOption[];
  optionClassName?: string;
  triggerClassName?: string;
  value: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <Select.Root
      disabled={disabled}
      onValueChange={onValueChange}
      value={value}
    >
      <Select.Trigger asChild>
        <motion.button
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          className={triggerClassName}
          id={id}
          transition={springSwap}
          type="button"
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        >
          <Select.Value />
          <Select.Icon asChild>
            <ChevronDown
              aria-hidden="true"
              className="animated-select-chevron"
            />
          </Select.Icon>
        </motion.button>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          align="start"
          className={contentClassName}
          position="popper"
          sideOffset={4}
        >
          <motion.div
            animate={{ filter: 'blur(0px)', opacity: 1, scaleY: 1, y: 0 }}
            className={className}
            initial={reduceMotion ? false : { filter: 'blur(4px)', opacity: 0, scaleY: 0.94, y: -5 }}
            style={{ transformOrigin: 'top center' }}
            transition={
              reduceMotion ? { duration: 0 } : { ...springSwap, opacity: { duration: 0.18, ease: motionEaseOut } }
            }
          >
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item
                  className={optionClassName}
                  disabled={option.disabled}
                  key={option.value}
                  value={option.value}
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </motion.div>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
