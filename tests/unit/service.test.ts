import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  openDatabase,
  type DatabaseConfig,
  type DatabaseHandle,
} from '../../apps/web/src/server/db/client';
import { truncateAll } from '../../apps/web/src/server/db/testing';
import { createService, ServiceError } from '../../apps/web/src/server/service';

const migrationsFolder = path.resolve(__dirname, '../../apps/web/drizzle');

// PGlite always runs; a real PostgreSQL server (Docker locally, a service
// container in CI) runs too when TEST_DATABASE_URL is set.
const drivers: [string, DatabaseConfig][] = [['pglite', { driver: 'pglite' }]];
if (process.env.TEST_DATABASE_URL) {
  drivers.push([
    'postgres',
    { driver: 'postgres', url: process.env.TEST_DATABASE_URL },
  ]);
}

// 2026-10-12 09:00 in Tokyo.
const startAt = new Date('2026-10-12T00:00:00Z');
const profile = {
  dailyTargetKcal: 2000,
  donationYenPer100Kcal: 100,
  timeZone: 'Asia/Tokyo',
};
const meal = (
  date: string,
  calories: number,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'lunch',
) => ({ date, mealType, name: 'テスト', calories });
// 1x1 PNG.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4UWEDAAOIAX3sK7CeAAAAAElFTkSuQmCC',
  'base64',
).toString('base64');

describe.each(drivers)('calorie donate service on %s', (_name, config) => {
  let handle: DatabaseHandle;
  let now: Date;
  const clock = () => now;
  const newService = () => createService(handle.db, clock);

  beforeAll(async () => {
    handle = await openDatabase(config, { migrationsFolder });
  });
  afterAll(async () => {
    await handle.close();
  });
  beforeEach(async () => {
    now = startAt;
    await truncateAll(handle.db);
  });

  it('requires a profile before meals and reports onboarding state', async () => {
    const service = newService();
    await expect(service.overview()).resolves.toEqual({
      today: '2026-10-12',
      profile: null,
      day: null,
      totals: null,
    });
    await expect(
      service.createMeal(meal('2026-10-12', 500)),
    ).rejects.toMatchObject({ code: 'PROFILE_REQUIRED', status: 409 });
  });

  it('tracks today and the provisional donation', async () => {
    const service = newService();
    const saved = await service.saveProfile(profile);
    expect(saved).toMatchObject({ ...profile, displayName: '' });
    await service.createMeal(meal('2026-10-12', 1500));
    await service.createMeal(meal('2026-10-12', 800));
    const overview = await service.overview();
    expect(overview.day).toMatchObject({
      consumedKcal: 2300,
      overKcal: 300,
      donationYen: 300,
      status: 'open',
      editable: true,
    });
    expect(overview.day?.meals).toHaveLength(2);
    expect(overview.totals).toEqual({
      totalYen: 0,
      totalOverKcal: 0,
      daysOver: 0,
      pendingYen: 300,
    });
  });

  it('keeps data across a reopened PGlite data directory', async () => {
    if (config.driver !== 'pglite') return;
    const dir = await mkdtemp(path.join(tmpdir(), 'calorie-donate-'));
    try {
      const first = await openDatabase(
        { driver: 'pglite', dataDir: dir },
        { migrationsFolder },
      );
      await createService(first.db, clock).saveProfile(profile);
      await first.close();
      const second = await openDatabase(
        { driver: 'pglite', dataDir: dir },
        { migrationsFolder },
      );
      const overview = await createService(second.db, clock).overview();
      expect(overview.profile?.dailyTargetKcal).toBe(2000);
      await second.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('settles days older than yesterday into the donation ledger', async () => {
    const service = newService();
    await service.saveProfile(profile);
    await service.createMeal(meal('2026-10-11', 2600));
    await service.createMeal(meal('2026-10-12', 1000));
    // Two days later the 11th and 12th are closed.
    now = new Date('2026-10-14T00:00:00Z');
    const ledger = await service.donations();
    // A target change after the fact does not rewrite settled days.
    await service.saveProfile({ ...profile, dailyTargetKcal: 1500 });
    expect(ledger.entries).toEqual([
      expect.objectContaining({
        date: '2026-10-11',
        overKcal: 600,
        donationYen: 600,
      }),
    ]);
    expect(ledger.totals).toMatchObject({ totalYen: 600, daysOver: 1 });
    const day = await service.day('2026-10-11');
    expect(day).toMatchObject({
      status: 'settled',
      editable: false,
      targetKcal: 2000,
      donationYen: 600,
    });
    await expect(
      service.createMeal(meal('2026-10-12', 100)),
    ).rejects.toMatchObject({ code: 'DAY_LOCKED' });
    await expect(service.deleteMeal(day.meals[0]!.id)).rejects.toBeInstanceOf(
      ServiceError,
    );
    // Settlement is recorded once.
    expect((await service.donations()).entries).toHaveLength(1);
  });

  it('lets yesterday be edited, and refuses future or invalid input', async () => {
    const service = newService();
    await service.saveProfile(profile);
    const created = await service.createMeal(meal('2026-10-11', 400));
    const updated = await service.updateMeal(created.id, {
      ...meal('2026-10-11', 450),
      name: '修正後',
    });
    expect(updated).toMatchObject({ calories: 450, name: '修正後' });
    await expect(
      service.createMeal(meal('2026-10-13', 100)),
    ).rejects.toMatchObject({ code: 'DAY_LOCKED' });
    await expect(
      service.createMeal({ ...meal('2026-10-12', -1) }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400 });
    await expect(service.overview('2026-10-13')).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    await service.deleteMeal(created.id);
    await expect(service.meal(created.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.meal('not-a-uuid')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns newest-first history with settled and open days', async () => {
    const service = newService();
    await service.saveProfile(profile);
    await service.createMeal(meal('2026-10-12', 2100));
    now = new Date('2026-10-15T00:00:00Z');
    const { days } = await service.history(5);
    expect(days.map((day) => [day.date, day.status])).toEqual([
      ['2026-10-15', 'open'],
      ['2026-10-14', 'open'],
      ['2026-10-13', 'settled'],
      ['2026-10-12', 'settled'],
      ['2026-10-11', 'settled'],
    ]);
    expect(days[3]).toMatchObject({ overKcal: 100, donationYen: 100 });
  });

  it('stores photos, attaches them to meals and cleans them up', async () => {
    const service = newService();
    await service.saveProfile(profile);
    const photo = await service.uploadPhoto({
      mediaType: 'image/jpeg', // the bytes say PNG, and win
      imageBase64: png,
    });
    expect(photo).toMatchObject({ contentType: 'image/png', byteSize: 69 });
    const stored = await service.photo(photo.id);
    expect(stored.data.toString('base64')).toBe(png);
    const created = await service.createMeal({
      ...meal('2026-10-12', 500),
      photoId: photo.id,
    });
    expect(created.photoId).toBe(photo.id);
    // Replacing the photo removes the old one.
    const replacement = await service.uploadPhoto({
      mediaType: 'image/png',
      imageBase64: png,
    });
    await service.updateMeal(created.id, {
      ...meal('2026-10-12', 500),
      photoId: replacement.id,
    });
    await expect(service.photo(photo.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await service.deleteMeal(created.id);
    await expect(service.photo(replacement.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      service.createMeal({
        ...meal('2026-10-12', 500),
        photoId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(
      service.uploadPhoto({
        mediaType: 'image/png',
        imageBase64: Buffer.from('not an image').toString('base64'),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('drops photos never attached to a meal after a day', async () => {
    const service = newService();
    await service.saveProfile(profile);
    const orphan = await service.uploadPhoto({
      mediaType: 'image/png',
      imageBase64: png,
    });
    now = new Date(startAt.getTime() + 25 * 60 * 60 * 1000);
    await service.uploadPhoto({ mediaType: 'image/png', imageBase64: png });
    await expect(service.photo(orphan.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('builds habit stats from logged days', async () => {
    const service = newService();
    await service.saveProfile(profile);
    await service.createMeal(meal('2026-10-11', 600, 'breakfast'));
    await service.createMeal(meal('2026-10-11', 1000, 'dinner'));
    await service.createMeal(meal('2026-10-12', 2500, 'dinner'));
    const stats = await service.stats(7);
    expect(stats.days).toHaveLength(7);
    expect(stats.days.at(-1)).toMatchObject({
      date: '2026-10-12',
      consumedKcal: 2500,
      overKcal: 500,
      mealCount: 1,
    });
    expect(stats.summary).toMatchObject({
      loggedDays: 2,
      withinTargetDays: 1,
      achievementRate: 0.5,
      averageKcal: 2050,
      donationYen: 500,
    });
    expect(stats.streaks).toMatchObject({
      currentLogging: 2,
      currentWithinTarget: 0,
      bestWithinTarget: 1,
    });
    expect(stats.mealTypes).toEqual({
      breakfast: 300,
      lunch: 0,
      dinner: 1750,
      snack: 0,
    });
  });

  it('keeps every meal under concurrent writes', async () => {
    const service = newService();
    await service.saveProfile(profile);
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        service.createMeal(meal('2026-10-12', 100 + i)),
      ),
    );
    expect((await service.day('2026-10-12')).meals).toHaveLength(10);
  });
});
