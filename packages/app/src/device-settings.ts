import { type HudState } from "@broadside/ui";
import { readSetting, writeSetting } from "./frame-pacing";

/**
 * On/off choices kept on this device (localStorage through frame-pacing's guarded helpers):
 * vibration and camera shake (on unless turned off), the armoury unfolded (off unless unfolded),
 * the language. Read once into the HUD's store at start; each setter stores and patches.
 */
const HAPTICS_KEY = "broadside.haptics";
const SHAKE_KEY = "broadside.shake";
const ARMORY_KEY = "broadside.armory";

export const deviceToggles = (patchHud: (p: Partial<HudState>) => void) => {
  patchHud({
    haptics: readSetting(HAPTICS_KEY) !== "0",
    shake: readSetting(SHAKE_KEY) !== "0",
    armory: readSetting(ARMORY_KEY) === "1",
    language: readSetting("broadside.lang") === "pl" ? "pl" : "en",
  });
  const toggle = (key: string, field: "haptics" | "shake" | "armory") => (on: boolean) => {
    patchHud({ [field]: on } as Partial<HudState>);
    writeSetting(key, on ? "1" : "0");
  };
  return { setHaptics: toggle(HAPTICS_KEY, "haptics"), setShake: toggle(SHAKE_KEY, "shake"), setArmory: toggle(ARMORY_KEY, "armory") };
};
