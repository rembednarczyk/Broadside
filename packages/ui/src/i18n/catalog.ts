/**
 * Player-facing text catalogues (SpinalTap ADR-0056: English by default, Polish in options).
 * core and sim carry keys; only the UI turns keys into sentences.
 */
import { EN } from "./catalog-en";
import { PL } from "./catalog-pl";

export { EN, PL };

export type TextKey = keyof typeof EN;

export const text = (lang: "en" | "pl", key: TextKey): string => (lang === "pl" ? PL[key] : EN[key]);
export const isTextKey = (k: string): k is TextKey => k in EN;
