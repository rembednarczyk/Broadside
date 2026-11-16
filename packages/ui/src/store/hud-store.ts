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
  readonly smoke: number;
  /** Special loads: Greek fire in the bow chaser, rockets in the swivels (left, and whether loaded). */
  readonly greekFire: { readonly left: number; readonly on: boolean } | null;
  readonly rockets: { readonly left: number; readonly on: boolean } | null;
  readonly braced: boolean;
  readonly hull: number;
  readonly crew: number;
  readonly crewMax: number;
  readonly fires: number;
  readonly water: number;
  /** A silenced enemy fort is within reach of a landing party. */
  readonly canStorm: boolean;
  /** A ship is alongside and slow enough to board. */
  readonly canBoard: boolean;
}

export interface TargetHud {
  readonly kind: "ship" | "fort";
  readonly classId: string;
  /** Forts: guns still in action and in all. */
  readonly guns?: readonly [number, number];
  readonly silenced?: boolean;
  readonly faction: string;
  readonly range: number;
  readonly hull: number;
  readonly crew: number;
  readonly struck: boolean;
  /** Side of the player's ship the target is on. */
  readonly side: "port" | "starboard" | "ahead" | "astern";
}

export interface GraphicsHud {
  readonly preset: string;
  readonly colorMode: string;
  readonly renderScale: number;
}

export interface PortHud {
  readonly index: number;
  readonly name: string;
  readonly owner: string;
  /** Null: the port refuses to trade (hostile). */
  readonly factor: number | null;
  readonly repairCost: number;
  readonly crewMissing: number;
  readonly crewCost: number;
  readonly plunderValue: number;
  /** The player's standing with each nation (-1 war .. 1 allied). */
  readonly standings: readonly { readonly faction: string; readonly value: number }[];
}

export interface HudState {
  readonly gold: number;
  readonly provisions: number;
  readonly port: PortHud | null;
  readonly graphics: GraphicsHud;
  readonly settingsOpen: boolean;
  readonly hudHidden: boolean;
  readonly cameraMode: string;
  readonly sailing: SailingHud | null;
  readonly combat: CombatHud | null;
  readonly target: TargetHud | null;
  /** Short-lived notices as text keys (e.g. "notice.mastFell"). */
  readonly notices: readonly { readonly id: number; readonly key: string }[];
  readonly language: "en" | "pl";
  readonly drawCalls: number;
  readonly fps: number;
}

export const useHud = create<HudState>(() => ({ gold: 0, provisions: 0, port: null, graphics: { preset: "high", colorMode: "sepia", renderScale: 1 }, settingsOpen: false, hudHidden: false, cameraMode: "isometric", sailing: null, combat: null, target: null, notices: [], language: "en", drawCalls: 0, fps: 0 }));

export const patchHud = (p: Partial<HudState>): void => useHud.setState(p);
