import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { log } from 'node:console';

export const webRoot = fileURLToPath(new URL('../', import.meta.url));
export const demoDataDir = path.join(webRoot, '.data', 'demo-pglite');
const require = createRequire(path.join(webRoot, 'package.json'));

function addDays(date, amount) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function todayInTokyo(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type).value)
    .join('-');
}

function stableId(key) {
  const hash = createHash('sha256')
    .update(`calorie-donate-demo-v1/${key}`)
    .digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/** Dedicated demo DB only. Inserts are idempotent and preserve existing entries. */
export async function seedDemo({
  dataDir = demoDataDir,
  now = new Date(),
} = {}) {
  if (path.resolve(dataDir) === path.join(webRoot, '.data', 'pglite'))
    throw new Error('通常DBへのシード投入はできません。');
  const { PGlite } = require('@electric-sql/pglite');
  const { drizzle } = require('drizzle-orm/pglite');
  const { migrate } = require('drizzle-orm/pglite/migrator');
  await mkdir(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const today = todayInTokyo(now);
  const currentYear = Number(today.slice(0, 4));
  const from = `${currentYear - 1}-01-01`;
  let inserted = 0;
  try {
    await migrate(drizzle(client), {
      migrationsFolder: path.join(webRoot, 'drizzle'),
    });
    await client.exec('BEGIN');
    try {
      await client.query(
        `INSERT INTO profiles (user_id, display_name, daily_target_kcal, donation_yen_per_100_kcal, time_zone, created_at, updated_at)
        VALUES ('local', 'デモユーザー', 2000, 100, 'Asia/Tokyo', $1, $2) ON CONFLICT (user_id) DO NOTHING`,
        [`${from}T00:00:00Z`, now.toISOString()],
      );
      const {
        rows: [profile],
      } = await client.query(
        "SELECT daily_target_kcal, donation_yen_per_100_kcal FROM profiles WHERE user_id='local'",
      );
      const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
      const names = [
        'トーストとヨーグルト',
        '鶏肉の定食',
        'ごはんと焼き魚',
        'ナッツと果物',
      ];
      for (let date = from; date <= today; date = addDays(date, 1)) {
        const month = Number(date.slice(5, 7));
        const day = Number(date.slice(8));
        const recent = Math.round(
          (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) /
            86_400_000,
        );
        const isPreviousYear = Number(date.slice(0, 4)) < currentYear;
        // A completely unlogged past month, plus irregular gaps elsewhere.
        if (isPreviousYear && month === 2) continue;
        let pattern = (day * 7 + month * 3) % 11;
        if (recent <= 6) pattern = [1, 8, 5, 10, 0, 2, 4][recent];
        if (pattern === 0 || pattern === 3) continue;
        const target =
          recent < 2 ? profile.daily_target_kcal : isPreviousYear ? 2100 : 2000;
        const rate =
          recent < 2
            ? profile.donation_yen_per_100_kcal
            : isPreviousYear
              ? 80
              : 100;
        const total =
          recent === 0
            ? 650
            : pattern === 10
              ? 0
              : pattern === 5
                ? target
                : pattern >= 8
                  ? target + 450 + day * 7
                  : 1100 + pattern * 110;
        const count =
          recent === 0 ? 2 : total === 0 ? 1 : pattern % 2 === 0 ? 4 : 3;
        const parts =
          count === 4
            ? [0.2, 0.32, 0.38]
            : count === 3
              ? [0.25, 0.35]
              : count === 2
                ? [0.4]
                : [];
        const calories = parts.map((ratio) => Math.floor(total * ratio));
        calories.push(total - calories.reduce((sum, value) => sum + value, 0));
        for (let index = 0; index < count; index++) {
          const name = total === 0 ? 'ブラックコーヒー' : names[index];
          const kind =
            total === target
              ? '目標ちょうど'
              : total > target
                ? '目標を超えた日'
                : total === 0
                  ? '0 kcalの記録'
                  : '目標以内の日';
          const items =
            index === 1
              ? [
                  {
                    name: 'ごはん',
                    calories: Math.floor(calories[index] * 0.45),
                  },
                  {
                    name: 'おかず',
                    calories:
                      calories[index] - Math.floor(calories[index] * 0.45),
                  },
                ]
              : [];
          const result = await client.query(
            `INSERT INTO meals (id, user_id, date, meal_type, name, calories, source, items, note, created_at, updated_at)
            VALUES ($1, 'local', $2, $3, $4, $5, 'manual', $6::jsonb, $7, $8, $8) ON CONFLICT (id) DO NOTHING RETURNING id`,
            [
              stableId(`${date}/${index}`),
              date,
              mealTypes[index],
              name,
              calories[index],
              JSON.stringify(items),
              `デモ: ${kind}`,
              `${date}T0${index + 1}:00:00Z`,
            ],
          );
          inserted += result.rows.length;
        }
        if (date < addDays(today, -1)) {
          // Include any manual demo records in totals, but never rewrite an existing ledger.
          const {
            rows: [sum],
          } = await client.query(
            "SELECT coalesce(sum(calories), 0)::int AS kcal FROM meals WHERE user_id='local' AND date=$1",
            [date],
          );
          const over = Math.max(0, sum.kcal - target);
          await client.query(
            `INSERT INTO settlements (user_id, date, target_kcal, consumed_kcal, over_kcal, donation_yen, donation_yen_per_100_kcal, settled_at)
            VALUES ('local', $1, $2, $3, $4, $5, $6, $7) ON CONFLICT (user_id, date) DO NOTHING`,
            [
              date,
              target,
              sum.kcal,
              over,
              Math.floor((over * rate) / 100),
              rate,
              now.toISOString(),
            ],
          );
        }
      }
      await client.exec('COMMIT');
    } catch (error) {
      await client.exec('ROLLBACK');
      throw error;
    }
    const {
      rows: [summary],
    } = await client.query(
      "SELECT count(*)::int AS meals, count(distinct date)::int AS days FROM meals WHERE user_id='local'",
    );
    return { ...summary, inserted, from, today, dataDir };
  } finally {
    await client.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  seedDemo()
    .then((result) =>
      log(
        `デモDBを準備しました: ${result.from}〜${result.today} / ${result.days}日 / ${result.meals}件（今回追加 ${result.inserted}件）\n${result.dataDir}\n起動: pnpm dev:demo`,
      ),
    )
    .catch((error) => {
      log(error);
      process.exitCode = 1;
    });
}
