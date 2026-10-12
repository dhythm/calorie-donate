import { ApiClientError } from '@calorie-donate/api';

/** Turns any thrown value into a short Japanese message for the UI. */
export function describeError(error: unknown): string {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case 'NOT_FOOD':
        return '料理が写っていないようです。料理全体が写るように撮り直してください。';
      case 'ESTIMATION_FAILED':
        return 'カロリーを推定できませんでした。別の写真で試すか、手入力で記録してください。';
      case 'DAY_LOCKED':
        return 'この日は確定済みのため変更できません。記録・編集できるのは今日と昨日だけです。';
      case 'PROFILE_REQUIRED':
        return '先に目標カロリーと寄付レートを設定してください。';
      case 'NOT_FOUND':
        return '対象のデータが見つかりませんでした。すでに削除された可能性があります。';
      case 'INVALID_REQUEST':
        return `入力内容を確認してください（${error.message}）`;
      default:
        break;
    }
    switch (error.kind) {
      case 'network':
        return 'サーバーに接続できません。通信環境と API URL を確認してください。';
      case 'timeout':
        return '通信がタイムアウトしました。しばらくしてからもう一度お試しください。';
      case 'invalid-response':
        return 'サーバーから想定外の応答がありました。アプリとサーバーのバージョンを確認してください。';
      case 'configuration':
        return `設定エラー: ${error.message}`;
      case 'http':
        return `エラーが発生しました（HTTP ${error.status ?? '不明'}）。もう一度お試しください。`;
    }
  }
  if (error instanceof Error && error.name === 'ZodError') {
    return '入力内容を確認してください。';
  }
  return '予期しないエラーが発生しました。もう一度お試しください。';
}
