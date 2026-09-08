import { useLayoutEffect, useState } from 'react';

const edgeObjectPool = [
  'bag',
  'brush',
  'bulb',
  'calculator',
  'calender',
  'can',
  'camera',
  'chess',
  'clock',
  'color-palette',
  'computer',
  'glass',
  'headphone',
  'key',
  'laptop',
  'mic',
  'mobile',
  'notebook',
  'paint-kit',
  'pencil',
  'picture',
  'scissor',
  'sparkling-water',
  'takeaway-cup',
  'tea-cup',
  'travel',
  'umbrella',
  'wallet'
] as const;
type EdgeObject = (typeof edgeObjectPool)[number];

const edgeSlots = [
  'top-left',
  'top-center',
  'top-right',
  'left-upper',
  'left-lower',
  'right-upper',
  'right-center',
  'right-lower',
  'bottom-left',
  'bottom-center',
  'bottom-right'
] as const;

const shuffle = <T,>(items: readonly T[]) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex] as T, shuffled[index] as T];
  }
  return shuffled;
};

const selectEdgeObjects = (): EdgeObject[] => {
  const beverages: EdgeObject[] = ['can', 'glass', 'sparkling-water', 'takeaway-cup', 'tea-cup'];
  const beverage = beverages[Math.floor(Math.random() * beverages.length)] as EdgeObject;
  const guaranteed: EdgeObject[] = ['laptop', 'mobile', beverage];
  const candidates = edgeObjectPool.filter((object) => !guaranteed.includes(object));
  return shuffle([...guaranteed, ...shuffle(candidates).slice(0, edgeSlots.length - guaranteed.length)]);
};

export function EdgeAtmosphere({ active = true }: { active?: boolean }) {
  const [edgeObjects] = useState(selectEdgeObjects);
  const [hasActivated, setHasActivated] = useState(active);

  useLayoutEffect(() => {
    if (active) setHasActivated(true);
  }, [active]);

  return (
    <div
      aria-hidden="true"
      className="edge-atmosphere"
      data-activated={hasActivated}
      data-visible={active}
    >
      {edgeSlots.map((slot, index) => {
        const object = edgeObjects[index] as EdgeObject;
        return (
          <span
            className={`edge-object edge-slot-${slot} edge-asset-${object}`}
            key={slot}
          />
        );
      })}
    </div>
  );
}
