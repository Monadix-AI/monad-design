import { ActivityIndicator, Text, View } from 'react-native';

import { useStyles } from '../styles';
import { useColors } from '../theme';

export function LoadingScreen() {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accentText} />
      <Text style={styles.loadingText}>Opening workspace…</Text>
    </View>
  );
}
