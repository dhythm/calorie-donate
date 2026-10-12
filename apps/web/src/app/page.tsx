'use client';
import { useState } from 'react';
import { ApiClientError, createApiClient } from '@calorie-donate/api';
const api = createApiClient({ baseUrl: '' });
export default function Home() {
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
    <main>
      <p className="eyebrow">DEVELOPMENT FOUNDATION</p>
      <h1>Calorie Donate</h1>
      <p>Web とモバイルが同じ Next.js API に接続する、開発用の最小構成です。</p>
      <button onClick={check} disabled={pending}>
        API 接続を確認
      </button>
      <p role="status" aria-live="polite">
        {status}
      </p>
    </main>
  );
}
