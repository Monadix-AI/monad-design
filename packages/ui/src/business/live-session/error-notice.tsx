interface ErrorExplanation {
  title: string;
  summary: string;
  nextStep?: string;
}

export const explainLiveError = (message: string): ErrorExplanation => {
  if (/Could not select a unique Debug Simulator scheme.*\(0 matches\)/s.test(message)) {
    return {
      title: 'No iOS Simulator app found',
      summary: 'The selected target does not have a matching Debug app for iPhone Simulator.',
      nextStep:
        'In Xcode, check that this is an iOS app target, its scheme builds that app, and its bundle ID matches the selected target. Apple TV apps require a tvOS workflow.'
    };
  }
  if (/Could not select a unique Debug Simulator scheme/.test(message)) {
    return {
      title: 'More than one Simulator build matches',
      summary: 'Monad Design cannot tell which Debug app to build.',
      nextStep: 'Set live.build.containerPath and live.build.scheme for the app you want to run.'
    };
  }
  if (/The built app must be an iOS Simulator app/.test(message)) {
    return {
      title: 'Built app is not for iPhone Simulator',
      summary: 'The build output has the wrong platform or bundle ID.',
      nextStep: 'Choose an iOS Simulator app artifact with the selected target’s bundle ID.'
    };
  }
  if (/is not installed on the selected Simulator/.test(message)) {
    return {
      title: 'App is not installed',
      summary: 'The selected Simulator does not have this target app yet.',
      nextStep: 'Build and install its Debug Simulator app, then connect again.'
    };
  }
  if (/xcodebuild failed:/.test(message)) {
    return {
      title: 'Xcode build failed',
      summary: 'The app could not be built for the selected Simulator.',
      nextStep: 'Check the build details below for the first Xcode error, then retry.'
    };
  }
  const firstLine = message.trim().split('\n')[0]?.trim() ?? '';
  return {
    title: 'Could not continue',
    summary: firstLine.length > 180 ? `${firstLine.slice(0, 177)}…` : firstLine || 'An unexpected error occurred.'
  };
};

export function LiveErrorNotice({ message }: { message: string }) {
  const explanation = explainLiveError(message);
  const hasDetails = message.trim() !== explanation.summary;
  return (
    <section
      className="live-error-notice"
      role="alert"
    >
      <div className="live-error-copy">
        <strong>{explanation.title}</strong>
        <p>{explanation.summary}</p>
        {explanation.nextStep ? <p className="live-error-next-step">{explanation.nextStep}</p> : null}
      </div>
      {hasDetails ? (
        <details className="live-error-details">
          <summary>Show technical details</summary>
          <pre>{message}</pre>
        </details>
      ) : null}
    </section>
  );
}
