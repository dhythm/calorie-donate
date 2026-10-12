import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createService, ServiceError } from '../../apps/web/src/server/service';
import { createFileStore } from '../../apps/web/src/server/store';

let dir: string;
let file: string;
let now: Date;
const clock = () => now;
// 2026-10-12 09:00 in Tokyo.
const startAt = new Date('2026-10-12T00:00:00Z');

const profile = {
  dailyTargetKcal: 2000,
  donationYenPer100Kcal: 100,
  timeZone: 'Asia/Tokyo',
};
const meal = (date: string, calories: number) => ({
  date,
  mealType: 'lunch' as const,
  name: 'テスト',
  calories,
});

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'calorie-donate-'));
  file = path.join(dir, 'data.json');
  now = startAt;
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('calorie donate service', () => {
  it('requires a profile before meals and reports onboarding state', async () => {
    const service = createService(createFileStore(file), clock);
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

  it('tracks today, provisional donation and persists to disk', async () => {
    const service = createService(createFileStore(file), clock);
    await service.saveProfile(profile);
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
    const saved = JSON.parse(await readFile(file, 'utf8'));
    expect(saved.meals).toHaveLength(2);
  });

  it('settles days older than yesterday into the donation ledger', async () => {
    const service = createService(createFileStore(file), clock);
    await service.saveProfile(profile);
    await service.createMeal(meal('2026-10-11', 2600));
    await service.createMeal(meal('2026-10-12', 1000));
    // Two days later the 11th and 12th are closed.
    now = new Date('2026-10-14T00:00:00Z');
    // A target change after the fact does not rewrite settled days.
    const ledger = await service.donations();
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
    const service = createService(createFileStore(file), clock);
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
  });

  it('returns newest-first history with settled and open days', async () => {
    const service = createService(createFileStore(file), clock);
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

  it('serializes concurrent writes without losing meals', async () => {
    const service = createService(createFileStore(file), clock);
    await service.saveProfile(profile);
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        service.createMeal(meal('2026-10-12', 100 + i)),
      ),
    );
    expect((await service.day('2026-10-12')).meals).toHaveLength(10);
  });
});
