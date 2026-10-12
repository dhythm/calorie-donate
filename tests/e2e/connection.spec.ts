import { expect, test } from '@playwright/test';
import { createApiClient } from '../../packages/api/src/index';

test('web connects to its Next.js API through the shared client', async ({
  page,
}) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'API 接続を確認' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '接続成功: calorie-donate-api (ok)',
  );
});
test('web shows a recoverable network error', async ({ page }) => {
  await page.goto('/settings');
  await page.route('**/api/health', (route) => route.abort());
  const button = page.getByRole('button', { name: 'API 接続を確認' });
  await button.click();
  await expect(page.getByRole('status')).toContainText('接続失敗: network');
  await expect(button).toBeEnabled();
  await page.unroute('**/api/health');
  await button.click();
  await expect(page.getByRole('status')).toContainText('接続成功');
});
test('the native-style absolute URL client reaches the same real backend', async () => {
  const api = createApiClient({ baseUrl: 'http://127.0.0.1:3100' });
  await expect(api.health()).resolves.toEqual({
    status: 'ok',
    service: 'calorie-donate-api',
  });
  await expect(api.echo({ message: '通信確認' })).resolves.toEqual({
    message: '通信確認',
  });
});
test('API rejects malformed JSON and invalid input with the shared error contract', async ({
  request,
}) => {
  for (const data of [
    '{bad-json',
    JSON.stringify({ message: '' }),
    JSON.stringify({ message: 'x'.repeat(201) }),
  ]) {
    const response = await request.post('/api/echo', {
      data,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message:
          'message must be a non-empty string of at most 200 characters.',
      },
    });
  }
  const health = await request.get('/api/health');
  expect(health.headers()['cache-control']).toBe('no-store');
});
