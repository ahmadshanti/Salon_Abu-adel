import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

/** Full-screen centered spinner shown while a screen loads its data. */
export function LoadingScreen() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.gold} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
});
