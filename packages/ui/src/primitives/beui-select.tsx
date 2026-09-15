// beUI Select interaction and unfolding adapted for a portaled canvas control (MIT).
// Source: https://beui.dev/r/select/raw

import type { AnimatedSelectOption } from './animated-select';

import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { springSwap } from './motion';

export function BeuiSelect({
  ariaDescribedBy,
  className,
  contentClassName,
  disabled,
  id,
  onValueChange,
  optionClassName,
  options,
  triggerClassName,
  value
}: {
  ariaDescribedBy?: string;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  id: string;
  onValueChange: (value: string) => void;
  optionClassName?: string;
  options: AnimatedSelectOption[];
  triggerClassName?: string;
  value: string;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ left: 0, top: 0, width: 0, above: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.find((option) => option.value === value);
  const listId = `${id}-options`;

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? options.length * 34 + 8;
    const above = window.innerHeight - rect.bottom < panelHeight + 12 && rect.top > panelHeight + 12;
    setPlacement({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      top: above ? rect.top - panelHeight - 8 : rect.bottom + 8,
      width: rect.width,
      above
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const focusOption = (index: number) => {
    const available = options
      .map((option, position) => (!option.disabled ? position : -1))
      .filter((position) => position >= 0);
    if (!available.length) return;
    const target = available[((index % available.length) + available.length) % available.length];
    if (target !== undefined) optionRefs.current[target]?.focus();
  };

  const choose = (next: string) => {
    onValueChange(next);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <motion.button
        aria-controls={listId}
        aria-describedby={ariaDescribedBy}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={triggerClassName}
        disabled={disabled}
        id={id}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
          } else if (event.key === 'Tab' && open) {
            setOpen(false);
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusOption(event.key === 'ArrowUp' ? options.length - 1 : 0));
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span>{selected?.label ?? value}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          className="beui-select-chevron"
          transition={reduceMotion ? { duration: 0 } : springSwap}
        >
          <ChevronDown
            aria-hidden="true"
            className="animated-select-chevron"
          />
        </motion.span>
      </motion.button>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                animate={{ opacity: 1, scaleY: 1, y: 0 }}
                className={contentClassName}
                data-canvas-ui
                exit={{ opacity: 0, scaleY: 0.96, y: placement.above ? 4 : -4 }}
                id={listId}
                initial={reduceMotion ? false : { opacity: 0, scaleY: 0.94, y: placement.above ? 5 : -5 }}
                key="options"
                onKeyDown={(event) => {
                  if (event.key === 'Escape' || event.key === 'Tab') {
                    setOpen(false);
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      triggerRef.current?.focus({ preventScroll: true });
                    }
                  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const current = optionRefs.current.indexOf(document.activeElement as HTMLButtonElement);
                    focusOption(current + (event.key === 'ArrowDown' ? 1 : -1));
                  }
                }}
                ref={panelRef}
                role="listbox"
                style={{
                  left: placement.left,
                  position: 'fixed',
                  top: placement.top,
                  transformOrigin: placement.above ? 'bottom center' : 'top center',
                  width: placement.width
                }}
                transition={reduceMotion ? { duration: 0 } : springSwap}
              >
                <motion.div
                  animate="show"
                  className={className}
                  initial="hidden"
                  transition={reduceMotion ? { duration: 0 } : { staggerChildren: 0.035, delayChildren: 0.05 }}
                  variants={{ hidden: {}, show: {} }}
                >
                  {options.map((option, index) => (
                    <motion.div
                      key={option.value}
                      variants={
                        reduceMotion
                          ? { hidden: {}, show: {} }
                          : { hidden: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0 } }
                      }
                    >
                      <button
                        aria-selected={option.value === value}
                        className={optionClassName}
                        data-state={option.value === value ? 'checked' : 'unchecked'}
                        disabled={option.disabled}
                        onClick={() => choose(option.value)}
                        ref={(node) => {
                          optionRefs.current[index] = node;
                        }}
                        role="option"
                        type="button"
                      >
                        <span>{option.label}</span>
                        {option.value === value && (
                          <Check
                            aria-hidden="true"
                            size={14}
                          />
                        )}
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
