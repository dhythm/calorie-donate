import { ApiClientError, createApiClient } from '@calorie-donate/api';

/** The browser talks to the same-origin Next.js API. */
export const api = createApiClient({ baseUrl: '' });

const codeMessages: Record<string, string> = {
  PROFILE_REQUIRED: '先に1日の目標カロリーを設定してください。',
  DAY_LOCKED:
    'この日は確定済みのため変更できません。記録・修正できるのは今日と昨日です。',
  NOT_FOOD:
    '料理が写っていないようです。別の写真を選ぶか、手入力してください。',
  ESTIMATION_FAILED:
    'カロリーを推定できませんでした。もう一度試すか、手入力してください。',
  NOT_FOUND: '記録が見つかりませんでした。',
};

/** User-facing Japanese message for any API failure. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError)) {
    return '問題が発生しました。もう一度お試しください。';
  }
  if (error.code && codeMessages[error.code]) {
    return codeMessages[error.code]!;
  }
  switch (error.kind) {
    case 'network':
      return 'サーバーに接続できません。通信環境を確認してください。';
    case 'timeout':
      return 'サーバーの応答がありませんでした。もう一度お試しください。';
    case 'invalid-response':
      return 'サーバーから予期しない応答がありました。';
    default:
      return error.code === 'INVALID_REQUEST'
        ? `入力内容を確認してください（${error.message}）`
        : 'サーバーでエラーが発生しました。時間をおいてお試しください。';
  }
}
