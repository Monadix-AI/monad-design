import { describe, expect, test } from 'bun:test';

import {
  buildCalloutLayout,
  calloutAnchor,
  calloutConnectorPath,
  type DrawnAnnotation
} from '../../src/components/annotation/annotation-model';

const rectangle: DrawnAnnotation = {
  id: 'rectangle-1',
  type: 'rectangle',
  start: { x: 80, y: 120 },
  end: { x: 280, y: 360 },
  note: 'Increase the spacing between these messages.'
};

describe('numbered annotation layout', () => {
  test('keeps an image-only composition before the first callout', () => {
    const layout = buildCalloutLayout({ width: 1206, height: 2622 }, []);

    expect(layout.width).toBe(1206);
    expect(layout.height).toBe(2622);
    expect(layout.boxes).toEqual([]);
  });

  test('adds an ordered note sidecar without reducing source resolution', () => {
    const layout = buildCalloutLayout({ width: 1206, height: 2622 }, [
      rectangle,
      { ...rectangle, id: 'rectangle-2', note: 'Second note' }
    ]);

    expect(layout.sidecarLeft).toBe(1206);
    expect(layout.width).toBeGreaterThan(1206);
    expect(layout.height).toBeGreaterThanOrEqual(2622);
    expect(layout.boxes).toHaveLength(2);
    expect(layout.boxes[1]?.y).toBeGreaterThan(layout.boxes[0]?.y ?? 0);
  });

  test('connects the target edge to its numbered note', () => {
    const layout = buildCalloutLayout({ width: 1206, height: 2622 }, [rectangle]);
    const box = layout.boxes[0];
    expect(box).toBeDefined();
    if (!box) return;

    expect(calloutAnchor(rectangle)).toEqual({ x: 280, y: 240 });
    const connector = calloutConnectorPath(rectangle, box);
    expect(connector.start).toEqual({ x: 280, y: 240 });
    expect(connector.end.x).toBeGreaterThan(1206);
    expect(connector.d).toContain('C');
  });
});
