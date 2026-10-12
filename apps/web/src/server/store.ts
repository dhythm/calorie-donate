import 'server-only';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  donationEntrySchema,
  mealSchema,
  profileSchema,
} from '@calorie-donate/api';

const dataSchema = z.object({
  version: z.literal(1),
  profile: profileSchema.nullable(),
  meals: z.array(mealSchema),
  settlements: z.array(donationEntrySchema),
});
export type StoreData = z.infer<typeof dataSchema>;

const emptyData = (): StoreData => ({
  version: 1,
  profile: null,
  meals: [],
  settlements: [],
});

export interface Store {
  read(): Promise<StoreData>;
  /** Serialized read-modify-write; the callback's data is saved on return. */
  update<T>(change: (data: StoreData) => T | Promise<T>): Promise<T>;
}

/**
 * Single-user JSON file store. Writes are serialized in-process and replaced
 * atomically. Swap for a database once accounts and multiple users exist.
 */
export function createFileStore(file: string): Store {
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<StoreData> {
    try {
      return dataSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return emptyData();
      }
      throw error;
    }
  }
  async function save(data: StoreData) {
    await mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(data, null, 2));
    await rename(temp, file);
  }
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task, task);
    queue = result.catch(() => undefined);
    return result;
  }
  return {
    read: () => enqueue(load),
    update: (change) =>
      enqueue(async () => {
        const data = await load();
        const result = await change(data);
        await save(dataSchema.parse(data));
        return result;
      }),
  };
}
