import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      source={require('../assets/brand/wordmark.png')}
      style={[styles.wordmark, compact && styles.compactWordmark]}
      resizeMode="contain"
      accessibilityLabel="Calorie Donate"
      accessible
    />
  );
}

export function BrandHeader() {
  return (
    <View style={styles.header}>
      <BrandLogo compact />
    </View>
  );
}

export function BrandSplash() {
  return (
    <View style={styles.splash} accessibilityLiveRegion="polite">
      <BrandLogo />
      <Text style={styles.loading}>読み込み中…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { width: '100%', maxWidth: 320, height: 92, alignSelf: 'center' },
  compactWordmark: { width: 196, height: 56, alignSelf: 'flex-start' },
  header: {
    backgroundColor: colors.brandYellow,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  splash: {
    flex: 1,
    backgroundColor: colors.brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loading: { position: 'absolute', bottom: 48, color: '#111111', fontSize: 13 },
});
