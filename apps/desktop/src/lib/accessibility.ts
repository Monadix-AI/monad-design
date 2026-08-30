import type { AXElement, AXSnapshot } from '../electron';

const keycodes = {
  ArrowDown: 81,
  ArrowLeft: 80,
  ArrowRight: 79,
  ArrowUp: 82,
  Backquote: 53,
  Backslash: 49,
  Backspace: 42,
  BracketLeft: 47,
  BracketRight: 48,
  Comma: 54,
  Enter: 40,
  Equal: 46,
  Escape: 41,
  MetaLeft: 227,
  MetaRight: 231,
  Minus: 45,
  Period: 55,
  Quote: 52,
  Semicolon: 51,
  ShiftLeft: 225,
  ShiftRight: 229,
  Slash: 56,
  Space: 44,
  Tab: 43
} as const;

export const keyUsage = (code: string) => {
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3) - 61;
  if (/^Digit[1-9]$/.test(code)) return Number(code.at(-1)) + 29;
  if (code === 'Digit0') return 39;
  return keycodes[code as keyof typeof keycodes];
};

export const axElementName = (element: AXElement) =>
  element.label || element.value || element.role || element.type || 'Element';

export const axElementAtPoint = (snapshot: AXSnapshot, point: { x: number; y: number }) => {
  const x = point.x * snapshot.screen.width;
  const y = point.y * snapshot.screen.height;
  const candidates = snapshot.elements.filter(({ frame }) => {
    return (
      frame.width > 0 &&
      frame.height > 0 &&
      x >= frame.x &&
      x <= frame.x + frame.width &&
      y >= frame.y &&
      y <= frame.y + frame.height
    );
  });
  const bySmallestFrame = (left: AXElement, right: AXElement) => {
    const areaDifference = left.frame.width * left.frame.height - right.frame.width * right.frame.height;
    return areaDifference || right.path.split('.').length - left.path.split('.').length;
  };
  const containerAtEdge = candidates
    .filter(({ frame, isContainer }) => {
      if (!isContainer) return false;
      const edgeDistance = Math.min(x - frame.x, frame.x + frame.width - x, y - frame.y, frame.y + frame.height - y);
      return edgeDistance <= 10;
    })
    .sort(bySmallestFrame)[0];
  return containerAtEdge ?? candidates.sort(bySmallestFrame)[0];
};
