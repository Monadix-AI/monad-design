import { describe, expect, test } from 'bun:test';

import { embeddedUiPath, requestedUiPath } from '../../src/ui-assets';

describe('Core UI asset paths', () => {
  test('preserves the assets directory for browser requests', () => {
    expect(requestedUiPath('/assets/index-B6KFDYNt.css')).toBe('assets/index-B6KFDYNt.css');
  });

  test('maps the root request to the embedded index', () => {
    expect(requestedUiPath('/')).toBe('index.html');
  });

  test('uses the same relative path for embedded assets', () => {
    expect(embeddedUiPath('dist/assets/index-B6KFDYNt.css')).toBe('assets/index-B6KFDYNt.css');
    expect(embeddedUiPath('/snapshot/apps/core/ui/dist/assets/index-B6KFDYNt.css')).toBe('assets/index-B6KFDYNt.css');
  });
});
