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
  toggleOars(): void;
}

export interface SettingsIntents {
  setLanguage(lang: "en" | "pl"): void;
}

export interface UiIntents {
  readonly helm: HelmIntents;
  readonly sails: SailIntents;
  readonly settings: SettingsIntents;
}
