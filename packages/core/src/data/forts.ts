import { type AmmoId } from "./ammo";

/**
 * Fort classes as data (Type Object). Stone soaks round shot (armour), garrisons defend against
 * landing parties, the citadel's furnace heats shot (fires on ships) and its chain bars the
 * harbour to enemies (the boom of Cartagena de Indias, 1741, and of Havana's Morro).
 */
export type FortClassId = "watchtower" | "battery" | "starFort" | "citadel";

export interface FortClassDef {
  readonly id: FortClassId;
  /** Hit points of the walls. */
  readonly hp: number;
  /** Damage taken is multiplied by this (stone and earth absorb shot). */
  readonly armour: number;
  readonly guns: number;
  readonly pounder: number;
  readonly mortars: number;
  readonly garrison: number;
  /** Footprint radius and height of the works (metres). */
  readonly radius: number;
  readonly height: number;
  /** Ammunition of the guns (the citadel fires heated shot). */
  readonly ammo: AmmoId;
  /** Guns fired per salvo (a battery fires in divisions). */
  readonly salvo: number;
  /** Gold looted on capture. */
  readonly treasury: number;
  /** A chain boom across the harbour mouth it guards (a port's citadel). */
  readonly chain: boolean;
  /** A furnace heating the shot (its guns fire round shot once it is out). */
  readonly furnace: boolean;
}

export const FORT_CLASSES: Readonly<Record<FortClassId, FortClassDef>> = {
  watchtower: { id: "watchtower", hp: 1400, armour: 0.6, guns: 4, pounder: 12, mortars: 0, garrison: 30, radius: 9, height: 16, ammo: "round", salvo: 2, treasury: 800, chain: false, furnace: false },
  battery: { id: "battery", hp: 2600, armour: 0.5, guns: 10, pounder: 24, mortars: 0, garrison: 80, radius: 26, height: 7, ammo: "round", salvo: 5, treasury: 2000, chain: false, furnace: false },
  starFort: { id: "starFort", hp: 8000, armour: 0.4, guns: 16, pounder: 24, mortars: 2, garrison: 200, radius: 46, height: 11, ammo: "round", salvo: 6, treasury: 6000, chain: false, furnace: false },
  citadel: { id: "citadel", hp: 11000, armour: 0.35, guns: 24, pounder: 32, mortars: 4, garrison: 400, radius: 62, height: 18, ammo: "hot", salvo: 8, treasury: 15000, chain: true, furnace: true },
};

export const FORT_CLASS_IDS = Object.keys(FORT_CLASSES) as FortClassId[];
/** Gun range of a fort (its height adds to the long guns' reach). */
export const FORT_RANGE = 520;
export const MORTAR_RANGE = 800;
