/**
 * Narrow intent interfaces (Interface Segregation; SpinalTap ADR-0031 split of UiIntents): each
 * HUD part depends only on the intents it raises. The app implements them.
 */
export interface HelmIntents {
  /** Starts or stops turning the course: -1 to port, 1 to starboard, 0 to hold. */
  steer(direction: -1 | 0 | 1): void;
}

export interface SailIntents {
  setSails(level: number): void;
  setMastSails(mast: number, level: number): void;
  toggleOars(): void;
}

export type Mount = "broadside" | "bowChaser" | "sternChaser" | "mortar" | "swivel";

export interface CombatIntents {
  fire(mount: Mount, side?: "port" | "starboard"): void;
  loadAmmo(ammo: string): void;
  brace(): void;
  drop(kind: "fireBarrel" | "mine"): void;
}

export interface SettingsIntents {
  setLanguage(lang: "en" | "pl"): void;
  setGraphicsPreset(preset: string): void;
  setRenderScale(scale: number): void;
  toggleSettings(): void;
}

export interface UiIntents {
  readonly helm: HelmIntents;
  readonly sails: SailIntents;
  readonly combat: CombatIntents;
  readonly settings: SettingsIntents;
}
