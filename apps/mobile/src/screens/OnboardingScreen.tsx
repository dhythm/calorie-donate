import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ApiClient, Profile } from '@calorie-donate/api';
import { Card } from '../components';
import { ProfileForm } from '../ProfileForm';
import { colors } from '../theme';

const steps = [
  {
    title: '目標を決める',
    body: '1日の目標カロリーを設定します。',
  },
  {
    title: '食事を記録',
    body: '写真を撮るだけで AI がカロリーを推定。手入力もできます。',
  },
  {
    title: '超えた分は寄付に',
    body: '目標を超えたカロリーは、支援が必要な子どもたちへの寄付になります。',
  },
];

export function OnboardingScreen({
  api,
  onDone,
}: {
  api: ApiClient;
  onDone: (profile: Profile) => void;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>CALORIE DONATE</Text>
        <Text style={styles.title} accessibilityRole="header">
          食べすぎを、{'\n'}誰かの笑顔に。
        </Text>
        <View style={styles.steps}>
          {steps.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          記録の追加・修正ができるのは今日と昨日の分だけです。それより前の日は「確定」され、超過分が寄付額として記録されます。
        </Text>
        <Card>
          <ProfileForm
            api={api}
            profile={null}
            submitLabel="はじめる"
            onSaved={onDone}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 24, gap: 20, paddingBottom: 48 },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 40,
  },
  steps: { gap: 14 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: colors.primary, fontWeight: '800' },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  stepText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: colors.accentSoft,
    padding: 12,
    borderRadius: 12,
  },
});
