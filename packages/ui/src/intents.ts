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
  drop(kind: "fireBarrel" | "mine" | "smoke"): void;
  /** Toggles the special load of a mount (Greek fire in the bow chaser, rockets in the swivels). */
  special(mount: "bowChaser" | "swivel"): void;
  assault(): void;
  board(): void;
}

export interface PortIntents {
  trade(service: "ammo" | "crew" | "repair" | "provisions" | "sellPlunder", qty: number, ammo?: string): void;
  buyShip(classId: string): void;
  refit(upgrade: string): void;
  takeContract(): void;
}

export interface SettingsIntents {
  setLanguage(lang: "en" | "pl"): void;
  setGraphicsPreset(preset: string): void;
  setRenderScale(scale: number): void;
  setColorMode(mode: string): void;
  toggleSettings(): void;
  toggleHelp(): void;
  newGame(): void;
  toggleHud(): void;
  nextCamera(): void;
}

export interface UiIntents {
  readonly helm: HelmIntents;
  readonly sails: SailIntents;
  readonly combat: CombatIntents;
  readonly port: PortIntents;
  readonly settings: SettingsIntents;
}
