import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { createThemedStyles, useColors } from '../theme';
import { GlassControl } from './GlassControl';

const privacyPolicyURL = 'https://design.monadix.ai/privacy';

export function SettingsButton() {
  const [visible, setVisible] = useState(false);
  const colors = useColors();
  const styles = useStyles();
  const openPrivacyPolicy = async () => {
    try {
      await Linking.openURL(privacyPolicyURL);
    } catch {
      Alert.alert('Unable to open privacy policy', `Please open ${privacyPolicyURL} in your browser.`);
    }
  };

  return (
    <>
      <GlassControl
        accessibilityLabel="Settings"
        accessibilityRole="button"
        contentStyle={styles.buttonContent}
        onPress={() => setVisible(true)}
        style={styles.button}
      >
        <Ionicons
          color={colors.text}
          name="settings-outline"
          size={21}
        />
      </GlassControl>
      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        supportedOrientations={['landscape-left', 'landscape-right']}
        transparent
        visible={visible}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel="Close settings"
            onPress={() => setVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={styles.panel}
          >
            <View style={styles.heading}>
              <Text
                accessibilityRole="header"
                style={styles.title}
              >
                Settings
              </Text>
              <Pressable
                accessibilityLabel="Close settings"
                accessibilityRole="button"
                onPress={() => setVisible(false)}
                style={styles.close}
              >
                <Ionicons
                  color={colors.text}
                  name="close"
                  size={24}
                />
              </Pressable>
            </View>
            <Pressable
              accessibilityHint="Opens in your default browser"
              accessibilityLabel="Privacy Policy"
              accessibilityRole="link"
              onPress={() => void openPrivacyPolicy()}
              style={styles.row}
            >
              <Ionicons
                color={colors.text}
                name="shield-checkmark-outline"
                size={23}
              />
              <View style={styles.label}>
                <Text style={styles.rowTitle}>Privacy Policy</Text>
                <Text style={styles.hint}>Opens in your browser</Text>
              </View>
              <Ionicons
                color={colors.muted}
                name="open-outline"
                size={20}
              />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    button: { borderRadius: 24 },
    buttonContent: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
      padding: 24
    },
    panel: { width: '100%', maxWidth: 480, borderRadius: 24, padding: 24, backgroundColor: colors.panel },
    heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    title: { fontSize: 25, fontWeight: '600', color: colors.text },
    close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.control
    },
    label: { flex: 1, gap: 4 },
    rowTitle: { color: colors.text, fontSize: 17, fontWeight: '500' },
    hint: { color: colors.muted, fontSize: 14 }
  })
);
