import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import {
  ApiClientError,
  type ApiClient,
  type Profile,
} from '@calorie-donate/api';
import { Button, Card, SectionTitle } from '../components';
import { ProfileForm } from '../ProfileForm';
import { colors } from '../theme';

export function SettingsScreen({
  api,
  baseUrl,
  profile,
  onProfileSaved,
}: {
  api: ApiClient;
  baseUrl: string;
  profile: Profile;
  onProfileSaved: (profile: Profile) => void;
}) {
  const [status, setStatus] = useState('未確認');
  const [checking, setChecking] = useState(false);

  async function checkConnection() {
    setChecking(true);
    setStatus('接続中…');
    try {
      const result = await api.health();
      setStatus(`接続成功: ${result.service} (${result.status})`);
    } catch (error) {
      setStatus(
        error instanceof ApiClientError
          ? `接続失敗: ${error.kind} — ${error.message}`
          : '接続失敗: もう一度お試しください',
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title} accessibilityRole="header">
          設定
        </Text>
        <Card>
          <SectionTitle>目標と寄付レート</SectionTitle>
          <Text style={styles.help}>
            変更しても、確定済みの日の寄付額は変わりません。
          </Text>
          <ProfileForm
            api={api}
            profile={profile}
            submitLabel="保存する"
            onSaved={onProfileSaved}
          />
        </Card>
        <Card>
          <SectionTitle>サーバー接続</SectionTitle>
          <Text style={styles.label}>API URL</Text>
          <Text style={styles.mono} selectable>
            {baseUrl}
          </Text>
          <Button
            title="API 接続を確認"
            variant="secondary"
            onPress={() => void checkConnection()}
            loading={checking}
          />
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {status}
          </Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, gap: 16, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  help: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  mono: {
    color: colors.text,
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  status: { color: colors.text, fontSize: 14, lineHeight: 21 },
});
