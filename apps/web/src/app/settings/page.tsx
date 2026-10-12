'use client';
import { useState } from 'react';
import { ApiClientError } from '@calorie-donate/api';
import { LoadError, Loading } from '@/components/PageState';
import { ProfileForm } from '@/components/ProfileForm';
import { useOverview } from '@/components/useOverview';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const { overview, error, reload } = useOverview();
  if (error) return <LoadError message={error} onRetry={() => void reload()} />;
  if (!overview) return <Loading />;
  return (
    <div className="stack">
      <h1>設定</h1>
      <section className="card">
        <h2>目標と寄付レート</h2>
        <p className="hint">
          変更は今日・昨日の暫定値と、これから確定する日に反映されます。確定済みの寄付は変わりません。
        </p>
        <ProfileForm
          profile={overview.profile}
          submitLabel="保存する"
          onSaved={() => void reload()}
        />
      </section>
      <ConnectionCheck />
    </div>
  );
}

function ConnectionCheck() {
  const [status, setStatus] = useState('未確認');
  const [pending, setPending] = useState(false);
  async function check() {
    setPending(true);
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
      setPending(false);
    }
  }
  return (
    <section className="card">
      <h2>接続確認</h2>
      <p className="hint">
        Web とモバイルが使う API サーバーの状態を確認します。
      </p>
      <button
        type="button"
        className="button"
        onClick={check}
        disabled={pending}
      >
        API 接続を確認
      </button>
      <p role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
