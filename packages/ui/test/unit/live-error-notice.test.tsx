import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { explainLiveError, LiveErrorNotice } from '../../src/business/live-session/error-notice';

const simulatorMismatch =
  'Could not select a unique Debug Simulator scheme for test.tvtest (0 matches). Configure live.build.containerPath and live.build.scheme.\n' +
  'xcodebuild failed: Command failed: xcodebuild -project /Users/zeke/Projects/tvtest/tvtest.xcodeproj -sdk iphonesimulator\n' +
  'Supported platforms for the buildables in the current scheme is empty.';

describe('live error notice', () => {
  test('explains zero matching iOS Simulator apps without claiming there are multiple schemes', () => {
    const explanation = explainLiveError(simulatorMismatch);
    expect(explanation.title).toBe('No iOS Simulator app found');
    expect(explanation.nextStep).toContain('iOS app target');
    expect(explanation.nextStep).toContain('Apple TV');
  });

  test('keeps the raw build output collapsed and available for troubleshooting', () => {
    const markup = renderToStaticMarkup(<LiveErrorNotice message={simulatorMismatch} />);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Show technical details');
    expect(markup).toContain('<details');
    expect(markup).toContain('Supported platforms for the buildables');
    expect(markup).not.toContain('<details open');
  });

  test('summarizes unknown multiline errors without discarding detail', () => {
    const message = 'Connection timed out.\nInternal stack trace';
    const markup = renderToStaticMarkup(<LiveErrorNotice message={message} />);
    expect(markup).toContain('Connection timed out.');
    expect(markup).toContain('Internal stack trace');
  });

  test('explains a missing Apple TV build', () => {
    const explanation = explainLiveError(
      'Could not select a unique Debug tvOS Simulator scheme for test.tvtest (0 matches).'
    );
    expect(explanation.title).toBe('No Apple TV Simulator app found');
  });
});
