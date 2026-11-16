import { type UiIntents } from "../intents";
import { Compass } from "./compass";
import { HelmPad } from "./helm-pad";
import { SailingPanel } from "./sailing-panel";
import { CombatPanel } from "./combat-panel";
import { TargetPanel } from "./target-panel";
import { Notices } from "./notices";
import { SettingsPanel } from "./settings-panel";
import { useHud } from "../store/hud-store";

export const Hud = ({ intents }: { intents: UiIntents }) => {
  const fps = useHud((h) => h.fps);
  return (
    <div className="hud">
      <SailingPanel intents={intents.sails} />
      <Compass />
      <HelmPad intents={intents.helm} />
      <CombatPanel intents={intents.combat} />
      <TargetPanel />
      <Notices />
      <SettingsPanel intents={intents.settings} />
      <div className="corner">
        <button className="lang" onPointerDown={() => intents.settings.toggleSettings()} data-testid="open-settings">⚙</button>
        <span className="fps">{fps.toFixed(0)} fps</span>
      </div>
    </div>
  );
};
