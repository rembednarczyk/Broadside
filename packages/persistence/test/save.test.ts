import { describe, expect, it } from "vitest";
import { type SaveStore, migrate, readSave, writeSave, SAVE_SCHEMA_VERSION } from "../src/save";

const memory = (): SaveStore => {
  const m = new Map<string, string>();
  return { read: async (k) => m.get(k) ?? null, write: async (k, v) => void m.set(k, v) };
};

describe("save", () => {
  it("round-trips through a store", async () => {
    const store = memory();
    await writeSave(store, "a", { gold: 5 }, "2026-11-16");
    const back = await readSave(store, "a");
    expect(back).toEqual({ version: SAVE_SCHEMA_VERSION, savedAt: "2026-11-16", data: { gold: 5 } });
    expect(await readSave(store, "missing")).toBeNull();
  });

  it("runs migrations in order and refuses the future", () => {
    const migrations = { 1: (d: unknown) => ({ ...(d as object), b: 1 }), 2: (d: unknown) => ({ ...(d as object), c: 2 }) };
    expect(migrate({ version: 1, savedAt: "", data: { a: 0 } }, 3, migrations).data).toEqual({ a: 0, b: 1, c: 2 });
    expect(() => migrate({ version: 4, savedAt: "", data: {} }, 3, migrations)).toThrow();
    expect(() => migrate({ version: 0, savedAt: "", data: {} }, 1, {})).toThrow();
  });
});
