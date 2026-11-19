import { describe, expect, it } from "vitest";
import { damageState } from "../src/data/damage-states";

const sound = { hull: 1, mastsStanding: 1, rigging: 1, canvas: 1, struck: false, sinking: false };

describe("damage states", () => {
  it("names the condition from the hull, the masts and the rigging", () => {
    expect(damageState(sound)).toBe("sound");
    expect(damageState({ ...sound, canvas: 0.6 })).toBe("damaged");
    expect(damageState({ ...sound, hull: 0.7 })).toBe("damaged");
    expect(damageState({ ...sound, hull: 0.3 })).toBe("battered");
  });

  it("calls a ship with no mast standing or her rigging shot away disabled, whatever her hull", () => {
    expect(damageState({ ...sound, mastsStanding: 0 })).toBe("disabled");
    expect(damageState({ ...sound, hull: 0.2, rigging: 0.1 })).toBe("disabled");
  });

  it("puts sinking before struck before the rest", () => {
    expect(damageState({ ...sound, struck: true, mastsStanding: 0 })).toBe("struck");
    expect(damageState({ ...sound, struck: true, sinking: true })).toBe("sinking");
  });
});
