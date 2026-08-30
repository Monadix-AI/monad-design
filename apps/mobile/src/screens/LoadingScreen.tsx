import { ActivityIndicator, Text, View } from 'react-native';

import { styles } from '../styles';
import { colors } from '../theme';

export function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.loadingText}>Opening workspace…</Text>
    </View>
  );
}
