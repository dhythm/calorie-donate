import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ApiClientError, createApiClient } from '@calorie-donate/api';

export default function App() {
  const [status, setStatus] = useState('未確認');
  const [pending, setPending] = useState(false);
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  async function check() {
    setPending(true);
    setStatus('接続中…');
    try {
      if (!baseUrl) {
        throw new ApiClientError(
          'configuration',
          'EXPO_PUBLIC_API_URL を設定してください',
        );
      }
      const api = createApiClient({ baseUrl });
      const result = await api.health();
      setStatus(`接続成功: ${result.service} (${result.status})`);
    } catch (error) {
      setStatus(
        error instanceof ApiClientError
          ? `接続失敗: ${error.kind} — ${error.message}`
          : '接続失敗: もう一度お試しください',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.eyebrow}>DEVELOPMENT FOUNDATION</Text>
      <Text style={styles.title}>Calorie Donate</Text>
      <Text style={styles.text}>Web と同じ Next.js API に接続します。</Text>
      <Text style={styles.text}>{baseUrl || 'API URL が未設定です'}</Text>
      <Button
        title="API 接続を確認"
        onPress={check}
        disabled={pending}
        color="#176b54"
      />
      <Text style={styles.text} accessibilityLiveRegion="polite">
        {status}
      </Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 32,
    paddingTop: 64,
    backgroundColor: '#f4f7f6',
    gap: 20,
  },
  eyebrow: { color: '#143b32', fontSize: 12, letterSpacing: 2 },
  title: { color: '#143b32', fontSize: 36, fontWeight: '700' },
  text: { color: '#143b32', fontSize: 16, lineHeight: 26 },
});
