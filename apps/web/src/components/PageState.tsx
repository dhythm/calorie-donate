import Link from 'next/link';

export function Loading() {
  return (
    <p className="loading" aria-busy="true">
      読み込み中…
    </p>
  );
}

export function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="card state-message">
      <p role="alert" className="notice error">
        {message}
      </p>
      <button type="button" className="button" onClick={onRetry}>
        再読み込み
      </button>
    </div>
  );
}

export function NeedsProfile() {
  return (
    <section className="empty-state" aria-labelledby="setup-title">
      <p className="eyebrow">GET STARTED</p>
      <h1 id="setup-title">
        あなたの目標から、
        <br />
        はじめよう。
      </h1>
      <p className="empty-state-description">
        1日の目標カロリーを決めて、食事の記録をはじめましょう。
      </p>
      <Link href="/" className="button primary">
        設定をはじめる
        <span aria-hidden="true">↗</span>
      </Link>
    </section>
  );
}
