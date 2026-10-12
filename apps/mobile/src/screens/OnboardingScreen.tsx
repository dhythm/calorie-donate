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
import { BrandLogo } from '../Brand';
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
        <View style={styles.brand}>
          <BrandLogo compact />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          食べすぎを、{'\n'}誰かの笑顔に。
        </Text>
        <View style={styles.steps}>
          {steps.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
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
        <Card style={styles.setup}>
          <Text style={styles.eyebrow}>YOUR DAILY GOAL</Text>
          <Text style={styles.setupTitle} accessibilityRole="header">
            はじめの設定
          </Text>
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
  setup: {
    borderWidth: 0,
    borderTopWidth: 4,
    borderTopColor: colors.text,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingTop: 24,
    gap: 16,
  },
  eyebrow: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  setupTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginBottom: 8,
  },
  container: { padding: 24, gap: 24, paddingBottom: 40 },
  brand: {
    backgroundColor: colors.brandYellow,
    marginHorizontal: -24,
    marginTop: -24,
    marginBottom: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 46,
    letterSpacing: -1,
  },
  steps: { gap: 0 },
  step: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepNumber: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  stepText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: colors.surfaceMuted,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandYellow,
  },
});
