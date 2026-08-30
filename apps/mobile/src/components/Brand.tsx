import { Text, View } from 'react-native';

import { styles } from '../styles';

export function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}>
        <Text style={styles.brandLetter}>M</Text>
      </View>
      <View>
        <Text style={styles.brandName}>Monad Design</Text>
        <Text style={styles.brandSub}>iPad workspace</Text>
      </View>
    </View>
  );
}
