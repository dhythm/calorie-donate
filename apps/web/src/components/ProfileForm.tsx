'use client';
import { useState } from 'react';
import {
  DEFAULT_TARGET_KCAL,
  DEFAULT_TIME_ZONE,
  DEFAULT_YEN_PER_100_KCAL,
  RATE_MAX,
  RATE_MIN,
  TARGET_KCAL_MAX,
  TARGET_KCAL_MIN,
  formatYen,
  type Profile,
} from '@calorie-donate/api';
import { api, errorMessage } from '@/lib/api';

function browserTimeZone(): string {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE
    );
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function ProfileForm({
  profile,
  submitLabel,
  onSaved,
}: {
  profile: Profile | null;
  submitLabel: string;
  onSaved: (profile: Profile) => void;
}) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [target, setTarget] = useState(
    String(profile?.dailyTargetKcal ?? DEFAULT_TARGET_KCAL),
  );
  const [rate, setRate] = useState(
    String(profile?.donationYenPer100Kcal ?? DEFAULT_YEN_PER_100_KCAL),
  );
  const [timeZone] = useState(() => profile?.timeZone ?? browserTimeZone());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetValue = Number(target);
  const rateValue = Number(rate);
  const targetValid =
    Number.isInteger(targetValue) &&
    targetValue >= TARGET_KCAL_MIN &&
    targetValue <= TARGET_KCAL_MAX;
  const rateValid =
    Number.isInteger(rateValue) &&
    rateValue >= RATE_MIN &&
    rateValue <= RATE_MAX;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!targetValid || !rateValid) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await api.saveProfile({
        displayName,
        dailyTargetKcal: targetValue,
        donationYenPer100Kcal: rateValue,
        timeZone,
      });
      setMessage('保存しました');
      onSaved(saved);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span className="field-label">ニックネーム（任意）</span>
        <input
          value={displayName}
          maxLength={40}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="例: ゆうた"
        />
      </label>
      <label className="field">
        <span className="field-label">1日の目標カロリー</span>
        <span className="input-unit">
          <input
            type="number"
            inputMode="numeric"
            min={TARGET_KCAL_MIN}
            max={TARGET_KCAL_MAX}
            step={50}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-invalid={!targetValid}
            required
          />
          <span>kcal</span>
        </span>
        <span className={targetValid ? 'hint' : 'hint error-text'}>
          {TARGET_KCAL_MIN.toLocaleString()}〜{TARGET_KCAL_MAX.toLocaleString()}{' '}
          kcal で設定します。
        </span>
      </label>
      <label className="field">
        <span className="field-label">寄付レート（100 kcal 超過ごと）</span>
        <span className="input-unit">
          <input
            type="number"
            inputMode="numeric"
            min={RATE_MIN}
            max={RATE_MAX}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            aria-invalid={!rateValid}
            required
          />
          <span>円</span>
        </span>
        <span className={rateValid ? 'hint' : 'hint error-text'}>
          {rateValid
            ? `例: 目標を 300 kcal 超えると ${formatYen(Math.floor(3 * rateValue))} を寄付します。`
            : `${RATE_MIN}〜${RATE_MAX.toLocaleString()} 円の整数で入力してください。`}
        </span>
      </label>
      <p className="hint">
        タイムゾーン: {timeZone}（日付の切り替えに使います）
      </p>
      <button
        type="submit"
        className="button primary"
        disabled={pending || !targetValid || !rateValid}
      >
        {pending ? '保存中…' : submitLabel}
      </button>
      {message && (
        <p role="status" className="notice success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </form>
  );
}
