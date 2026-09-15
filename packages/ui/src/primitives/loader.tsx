// beUI Loader dots adapted for compact Desktop/Core status rows (MIT).
// Source: https://beui.dev/r/loader/raw
import { motion, useReducedMotion } from 'motion/react';

export function Loader({ label = 'Loading', size = 5 }: { label?: string; size?: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <span
      aria-label={label}
      className="beui-loader"
      role="status"
    >
      {[0, 1, 2].map((index) => (
        <motion.span
          animate={reduceMotion ? { opacity: [1, 0.45, 1] } : { opacity: [0.4, 1, 0.4], y: [0, -3, 0] }}
          aria-hidden="true"
          key={index}
          style={{ width: size, height: size }}
          transition={{ duration: 1, delay: index * 0.13, repeat: Infinity }}
        />
      ))}
    </span>
  );
}
