/**
 * Save format with a schema version and a chain of migrations (Memento + versioned schema, as in
 * SpinalTap packages/persistence/src/migrations.ts). A change to the format bumps
 * SAVE_SCHEMA_VERSION and adds a migration from the previous version with a test.
 */
export const SAVE_SCHEMA_VERSION = 1;

export interface SaveEnvelope {
  readonly version: number;
  readonly savedAt: string;
  readonly data: unknown;
}

export type Migration = (data: unknown) => unknown;

/** MIGRATIONS[n] migrates data of version n to n + 1. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export const migrate = (env: SaveEnvelope, target = SAVE_SCHEMA_VERSION, migrations = MIGRATIONS): SaveEnvelope => {
  let data = env.data;
  let version = env.version;
  if (version > target) throw new Error(`save version ${version} is newer than this game (${target})`);
  while (version < target) {
    const m = migrations[version];
    if (!m) throw new Error(`no migration from save version ${version}`);
    data = m(data);
    version++;
  }
  return { version, savedAt: env.savedAt, data };
};

/** Storage port: IndexedDB or Capacitor Preferences in the app, a Map in tests (Ports and Adapters). */
export interface SaveStore {
  read(slot: string): Promise<string | null>;
  write(slot: string, text: string): Promise<void>;
}

export const writeSave = async (store: SaveStore, slot: string, data: unknown, savedAt: string): Promise<void> => {
  const env: SaveEnvelope = { version: SAVE_SCHEMA_VERSION, savedAt, data };
  await store.write(slot, JSON.stringify(env));
};

export const readSave = async (store: SaveStore, slot: string): Promise<SaveEnvelope | null> => {
  const text = await store.read(slot);
  if (text === null) return null;
  return migrate(JSON.parse(text) as SaveEnvelope);
};
