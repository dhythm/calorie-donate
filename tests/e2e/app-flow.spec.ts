import { expect, test } from '@playwright/test';
import { createApiClient } from '../../packages/api/src/index';

// 8x8 solid PNG; the browser decodes and re-encodes it before upload.
const mealPhoto = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4UWGDFTEMLQkAQfNfAVTFtrMAAAAASUVORK5CYII=',
  'base64',
);

test.describe.configure({ mode: 'serial' });

test('onboarding sets the daily target', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'はじめの設定' }),
  ).toBeVisible();
  await page.getByLabel('1日の目標カロリー').fill('2000');
  await page.getByLabel('寄付レート（100 kcal 超過ごと）').fill('100');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.getByTestId('day-status')).toHaveText(
    'あと 2,000 kcal 食べられます',
  );
  await expect(page.getByTestId('total-donation')).toHaveText('¥0');
});

test('logs a meal manually and edits it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '手入力で記録' }).click();
  await page.getByLabel('料理名').fill('鮭おにぎり');
  await page.getByLabel('カロリー', { exact: true }).fill('1500');
  await page.getByText('昼食', { exact: true }).click();
  await page.getByRole('button', { name: '記録する' }).click();
  await expect(page.getByTestId('day-status')).toHaveText(
    'あと 500 kcal 食べられます',
  );
  await page.getByRole('link', { name: '鮭おにぎりを編集' }).click();
  await page.getByLabel('カロリー', { exact: true }).fill('1800');
  await page.getByRole('button', { name: '変更を保存' }).click();
  await expect(page.getByTestId('day-status')).toHaveText(
    'あと 200 kcal 食べられます',
  );
});

test('estimates a photo, saves it and shows the provisional donation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: '写真で記録' }).click();
  await page.getByTestId('photo-input').setInputFiles({
    name: 'meal.png',
    mimeType: 'image/png',
    buffer: mealPhoto,
  });
  await expect(page.getByText('サンプル推定です')).toBeVisible();
  const total = await page.getByTestId('meal-total').textContent();
  const kcal = Number(total?.replace(/[^\d]/g, ''));
  // Every sample estimate is large enough to push the day over target.
  expect(kcal).toBeGreaterThan(200);
  await page.getByRole('button', { name: '記録する' }).click();
  const over = 1800 + kcal - 2000;
  await expect(page.getByTestId('day-status')).toHaveText(
    `目標を ${over.toLocaleString('ja-JP')} kcal 超過`,
  );
  await expect(page.getByTestId('day-donation')).toHaveText(
    `このままだと ¥${over.toLocaleString('ja-JP')} を寄付します`,
  );
  await expect(page.getByText('写真', { exact: true })).toBeVisible();
  // The uploaded photo is stored and shown as the meal's thumbnail.
  const thumb = page.locator('img.meal-thumb');
  await expect(thumb).toHaveCount(1);
  expect(
    await thumb.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(8);
});

test('deletes a meal after confirmation', async ({ page }) => {
  await page.goto('/');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '鮭おにぎりを削除' }).click();
  await expect(
    page.getByRole('button', { name: '鮭おにぎりを削除' }),
  ).toHaveCount(0);
});

test('history, donations and settings pages render the saved state', async ({
  page,
}) => {
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'グラフ' })).toBeVisible();
  await expect(page.getByTestId('logging-streak')).toHaveText('1 日');
  await expect(
    page.getByRole('heading', { name: '毎日の摂取カロリー' }),
  ).toBeVisible();
  await expect(
    page.getByRole('grid', { name: '習慣カレンダー' }),
  ).toBeVisible();
  await page
    .getByRole('img', { name: /摂取カロリーと目標/ })
    .getByLabel(/^今日/)
    .hover();
  await expect(page.locator('.chart-tip')).toContainText('kcal');
  await expect(page.getByText('今日', { exact: true }).first()).toBeVisible();
  await page.goto('/donations');
  await expect(page.getByTestId('ledger-total')).toHaveText('¥0');
  await expect(page.getByText('まだ確定した寄付はありません')).toBeVisible();
  await page.goto('/settings');
  await page.getByLabel('1日の目標カロリー').fill('1800');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('保存しました')).toBeVisible();
});

test('the native-style client reads the same data and errors', async () => {
  const api = createApiClient({ baseUrl: 'http://127.0.0.1:3100' });
  const overview = await api.overview();
  expect(overview.profile?.dailyTargetKcal).toBe(1800);
  expect(overview.day?.meals.length).toBe(1);
  await expect(
    api.createMeal({
      date: '2000-01-01',
      mealType: 'lunch',
      name: '古い記録',
      calories: 100,
    }),
  ).rejects.toMatchObject({ status: 409, code: 'DAY_LOCKED' });
  await expect(api.meal('missing')).rejects.toMatchObject({
    status: 404,
    code: 'NOT_FOUND',
  });
});

test('API validates meal and photo payloads', async ({ request }) => {
  const meal = await request.post('/api/meals', {
    data: { date: 'today', mealType: 'brunch', name: '', calories: -1 },
  });
  expect(meal.status()).toBe(400);
  expect((await meal.json()).error.code).toBe('INVALID_REQUEST');
  const photo = await request.post('/api/photos', {
    data: { mediaType: 'image/bmp', imageBase64: 'not base64!' },
  });
  expect(photo.status()).toBe(400);
  const estimate = await request.post('/api/meals/estimate', {
    data: { photoId: 'missing' },
  });
  expect(estimate.status()).toBe(400);
  const missingPhoto = await request.get(
    '/api/photos/00000000-0000-4000-8000-000000000000',
  );
  expect(missingPhoto.status()).toBe(404);
  const malformed = await request.put('/api/profile', {
    data: '{bad',
    headers: { 'Content-Type': 'application/json' },
  });
  expect(malformed.status()).toBe(400);
  const future = await request.get('/api/overview?date=2999-01-01');
  expect(future.status()).toBe(400);
});
