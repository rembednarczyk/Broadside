import { create } from "zustand";

/**
 * HUD state, written only by the app's presenter and read by components through narrow
 * selectors (one field each), as in SpinalTap's ui store.
 */
export interface SailingHud {
  readonly speedKnots: number;
  readonly heading: number;
  readonly course: number | null;
  /** Direction the wind blows from, relative to the bow (radians, + = from starboard). */
  readonly windFromRelative: number;
  readonly windKnots: number;
  readonly beaufort: number;
  readonly sailTargets: readonly number[];
  readonly sailSet: readonly number[];
  readonly heelDeg: number;
  readonly hasOars: boolean;
  readonly oars: boolean;
  readonly classId: string;
}

export interface HudState {
  readonly sailing: SailingHud | null;
  readonly language: "en" | "pl";
  readonly drawCalls: number;
  readonly fps: number;
}

export const useHud = create<HudState>(() => ({ sailing: null, language: "en", drawCalls: 0, fps: 0 }));

export const patchHud = (p: Partial<HudState>): void => useHud.setState(p);
