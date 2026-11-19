import { create } from "zustand";

/**
 * HUD state, written only by the app's presenter and read by components through narrow
 * selectors (one field each), as in SpinalTap's ui store.
 */
export interface SailingHud {
  /** Shallow water on the course ahead (the leadsman calls it). */
  readonly shoalAhead: boolean;
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
  /** Ships: the target's id (orders about it). */
  readonly id?: number;
  /** Ships: the condition's name (core damageState: sound, damaged, battered, disabled, struck, sinking). */
  readonly state?: string;
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
  /** Shipyard: classes for sale and what each costs after the part exchange (negative: the yard pays). */
  readonly yard: readonly { readonly classId: string; readonly cost: number; readonly crew: number; readonly guns: number }[];
  /** Refits for the current hull: price and whether already fitted. */
  readonly refits: readonly { readonly id: string; readonly cost: number; readonly fitted: boolean }[];
  /** The harbour master's contract (null: none, or one already taken). */
  readonly offer: JobHud | null;
}

/** A contract: kind, the ship it is about, the pay, and where to go. */
export interface JobHud {
  readonly kind: string;
  readonly classId: string;
  readonly faction: string;
  readonly reward: number;
  /** Port an escort must reach. */
  readonly dest: string | null;
  readonly minutes: number;
  /** Active contract only: distance and compass bearing to the ship (m, degrees). */
  readonly distance?: number;
  readonly bearing?: number;
}

export interface HudState {
  readonly gold: number;
  readonly provisions: number;
  readonly port: PortHud | null;
  /** The contract the player has taken. */
  readonly job: JobHud | null;
  /** Arrow towards the nearest enemy when it is off screen or under a panel (screen fractions, radians). */
  /** Arrow at the screen's edge towards an enemy, or else an unsalvaged wreck (`kind`, with its place for the salvage order). */
  readonly marker: { readonly x: number; readonly y: number; readonly angle: number; readonly range: number; readonly kind?: "enemy" | "wreck"; readonly at?: { readonly x: number; readonly z: number } } | null;
  readonly graphics: GraphicsHud;
  readonly settingsOpen: boolean;
  /** The how-to-play card (shown on the first start). */
  readonly helpOpen: boolean;
  readonly hudHidden: boolean;
  readonly cameraMode: string;
  readonly sailing: SailingHud | null;
  readonly combat: CombatHud | null;
  readonly target: TargetHud | null;
  /** Short-lived notices as text keys (e.g. "notice.mastFell"). */
  readonly notices: readonly { readonly id: number; readonly key: string }[];
  readonly language: "en" | "pl";
  /** Simple steering (tap or draw a course on the sea) or the classic helm buttons. */
  readonly steering: SteeringMode;
  /** Assisted sailing: going astern with the sails backed (the gear below furled). */
  readonly astern: boolean;
  /** The crew reefs in squalls without being told. */
  readonly reef: boolean;
  /** Vibration on hits and broadsides. */
  readonly haptics: boolean;
  /** The crew has a course or an order (simple steering): the cancel button shows. */
  readonly courseActive: boolean;
  /** Orders for a ship held down on (screen fractions, the ship, whether she is an enemy). */
  readonly shipMenu: { readonly x: number; readonly y: number; readonly target: number; readonly hostile: boolean } | null;
  readonly drawCalls: number;
  readonly fps: number;
}

/** Simple (tap or draw a course, the crew sails it), the classic helm, or assisted sailing with a pad (the action game's controls). */
export type SteeringMode = "simple" | "classic" | "arcade";

export const useHud = create<HudState>(() => ({ gold: 0, provisions: 0, port: null, job: null, marker: null, graphics: { preset: "high", colorMode: "sepia", renderScale: 1 }, settingsOpen: false, helpOpen: false, hudHidden: false, cameraMode: "isometric", sailing: null, combat: null, target: null, notices: [], language: "en", steering: "simple", astern: false, reef: true, haptics: true, courseActive: false, shipMenu: null, drawCalls: 0, fps: 0 }));

export const patchHud = (p: Partial<HudState>): void => useHud.setState(p);
