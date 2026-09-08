import { ActivityIndicator } from 'react-native';

/** UIActivityIndicatorView owns timing, appearance and accessibility behavior on iOS. */
export function WorkspaceAgentActivity({ color = '#339cff' }: { color?: string }) {
  return (
    <ActivityIndicator
      accessibilityLabel="Agent working"
      color={color}
      size="small"
    />
  );
}
