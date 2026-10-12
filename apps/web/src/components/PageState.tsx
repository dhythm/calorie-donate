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
    <div className="card">
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
    <div className="card">
      <p>まずは1日の目標カロリーを設定しましょう。</p>
      <Link href="/" className="button primary">
        設定をはじめる
      </Link>
    </div>
  );
}
