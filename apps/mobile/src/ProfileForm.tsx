import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  DEFAULT_TARGET_KCAL,
  DEFAULT_TIME_ZONE,
  DEFAULT_YEN_PER_100_KCAL,
  RATE_MAX,
  RATE_MIN,
  TARGET_KCAL_MAX,
  TARGET_KCAL_MIN,
  formatYen,
  timeZoneSchema,
  type ApiClient,
  type Profile,
} from '@calorie-donate/api';
import { Button, Field, Notice, parseWholeNumber } from './components';
import { describeError } from './errors';
import { colors } from './theme';

function detectTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && timeZoneSchema.safeParse(zone).success) return zone;
  } catch {
    // Fall through to the default below.
  }
  return DEFAULT_TIME_ZONE;
}

export function ProfileForm({
  api,
  profile,
  submitLabel,
  onSaved,
}: {
  api: ApiClient;
  profile: Profile | null;
  submitLabel: string;
  onSaved: (profile: Profile) => void;
}) {
  const [target, setTarget] = useState(
    String(profile?.dailyTargetKcal ?? DEFAULT_TARGET_KCAL),
  );
  const [rate, setRate] = useState(
    String(profile?.donationYenPer100Kcal ?? DEFAULT_YEN_PER_100_KCAL),
  );
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const targetValue = parseWholeNumber(target);
  const rateValue = parseWholeNumber(rate);
  const targetError =
    targetValue === null ||
    targetValue < TARGET_KCAL_MIN ||
    targetValue > TARGET_KCAL_MAX
      ? `${TARGET_KCAL_MIN}〜${TARGET_KCAL_MAX} の整数で入力してください`
      : null;
  const rateError =
    rateValue === null || rateValue < RATE_MIN || rateValue > RATE_MAX
      ? `${RATE_MIN}〜${RATE_MAX} の整数で入力してください`
      : null;
  const nameError =
    displayName.trim().length > 40 ? '40文字以内で入力してください' : null;
  const valid = !targetError && !rateError && !nameError;

  async function submit() {
    if (!valid || targetValue === null || rateValue === null) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await api.saveProfile({
        displayName: displayName.trim(),
        dailyTargetKcal: targetValue,
        donationYenPer100Kcal: rateValue,
        timeZone: profile?.timeZone ?? detectTimeZone(),
      });
      setSaved(true);
      onSaved(result);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <Field
        label="1日の目標カロリー"
        value={target}
        onChangeText={(text) => {
          setTarget(text);
          setSaved(false);
        }}
        keyboardType="number-pad"
        suffix="kcal"
        error={target.length > 0 ? targetError : null}
        hint="この値を超えた分が寄付の対象になります"
      />
      <Field
        label="寄付レート（100 kcal 超過あたり）"
        value={rate}
        onChangeText={(text) => {
          setRate(text);
          setSaved(false);
        }}
        keyboardType="number-pad"
        suffix="円"
        error={rate.length > 0 ? rateError : null}
        hint={
          rateValue !== null && !rateError
            ? `例: 300 kcal 超過で ${formatYen(Math.floor((300 * rateValue) / 100))} の寄付`
            : undefined
        }
      />
      <Field
        label="表示名（任意）"
        value={displayName}
        onChangeText={(text) => {
          setDisplayName(text);
          setSaved(false);
        }}
        placeholder="例: たろう"
        maxLength={40}
        error={nameError}
      />
      <Text style={styles.timeZone}>
        タイムゾーン: {profile?.timeZone ?? detectTimeZone()}
      </Text>
      {error ? <Notice message={error} onRetry={submit} /> : null}
      {saved && profile ? <Notice message="保存しました" tone="info" /> : null}
      <Button
        title={submitLabel}
        onPress={submit}
        loading={saving}
        disabled={!valid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  timeZone: { color: colors.muted, fontSize: 12 },
});
