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
  /** Weather state key (calm, fresh, storm...) or null for a fixed wind. */
  readonly weather: string | null;
  /** Load of each mast as a share of what it stands. */
  readonly mastLoad: readonly number[];
}

export interface BatteryHud {
  /** Share of the battery's guns that are loaded (0..1). */
  readonly ready: number;
  readonly count: number;
}

export interface CombatHud {
  readonly port: BatteryHud;
  readonly starboard: BatteryHud;
  readonly bow: BatteryHud;
  readonly stern: BatteryHud;
  readonly mortar: BatteryHud;
  readonly swivel: BatteryHud;
  readonly broadsideAmmo: string;
  /** Ammunition kinds the broadside can load, with the loads left in the hold. */
  readonly ammo: readonly { readonly id: string; readonly left: number }[];
  readonly barrels: number;
  readonly mines: number;
  readonly braced: boolean;
  readonly hull: number;
  readonly crew: number;
  readonly crewMax: number;
  readonly fires: number;
  readonly water: number;
}

export interface TargetHud {
  readonly classId: string;
  readonly faction: string;
  readonly range: number;
  readonly hull: number;
  readonly crew: number;
  readonly struck: boolean;
  /** Side of the player's ship the target is on. */
  readonly side: "port" | "starboard" | "ahead" | "astern";
}

export interface HudState {
  readonly sailing: SailingHud | null;
  readonly combat: CombatHud | null;
  readonly target: TargetHud | null;
  /** Short-lived notices as text keys (e.g. "notice.mastFell"). */
  readonly notices: readonly { readonly id: number; readonly key: string }[];
  readonly language: "en" | "pl";
  readonly drawCalls: number;
  readonly fps: number;
}

export const useHud = create<HudState>(() => ({ sailing: null, combat: null, target: null, notices: [], language: "en", drawCalls: 0, fps: 0 }));

export const patchHud = (p: Partial<HudState>): void => useHud.setState(p);
