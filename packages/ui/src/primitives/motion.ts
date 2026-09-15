// Motion constants adapted from beUI's shared motion vocabulary.
// Source: https://beui.dev/r/button/raw (MIT)

export const motionEaseOut = [0.16, 1, 0.3, 1] as const;

export const springPress = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.6
} as const;

export const springSwap = {
  type: 'spring',
  stiffness: 460,
  damping: 30,
  mass: 0.55
} as const;
