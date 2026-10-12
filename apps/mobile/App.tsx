import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ApiClientError, createApiClient } from '@calorie-donate/api';
import { MainApp } from './src/MainApp';
import { colors } from './src/theme';

type ClientState =
  | { ok: true; api: ReturnType<typeof createApiClient>; baseUrl: string }
  | { ok: false; reason: string; baseUrl: string | undefined };

function createClient(baseUrl: string | undefined): ClientState {
  if (!baseUrl) {
    return {
      ok: false,
      reason: 'EXPO_PUBLIC_API_URL を設定してください',
      baseUrl,
    };
  }
  try {
    return { ok: true, api: createApiClient({ baseUrl }), baseUrl };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof ApiClientError
          ? `API URL が不正です（${error.message}）`
          : 'API URL が不正です',
      baseUrl,
    };
  }
}

export default function App() {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const client = useMemo(() => createClient(baseUrl), [baseUrl]);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {client.ok ? (
        <MainApp api={client.api} baseUrl={client.baseUrl} />
      ) : (
        <ConfigurationError reason={client.reason} baseUrl={client.baseUrl} />
      )}
    </SafeAreaProvider>
  );
}

function ConfigurationError({
  reason,
  baseUrl,
}: {
  reason: string;
  baseUrl: string | undefined;
}) {
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>CONFIGURATION ERROR</Text>
        <Text style={styles.title} accessibilityRole="header">
          Calorie Donate
        </Text>
        <Text style={styles.error} accessibilityRole="alert">
          {reason}
        </Text>
        <Text style={styles.text}>
          現在の値: {baseUrl ? baseUrl : '（未設定）'}
        </Text>
        <Text style={styles.text}>
          apps/mobile の環境変数 EXPO_PUBLIC_API_URL に API
          サーバーのオリジン（例: http://192.168.0.10:3000）を設定し、Expo
          を再起動してください。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 32,
    gap: 20,
  },
  eyebrow: { color: colors.accent, fontSize: 12, letterSpacing: 2 },
  title: { color: colors.text, fontSize: 36, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 17, fontWeight: '700' },
  text: { color: colors.text, fontSize: 16, lineHeight: 26 },
});
