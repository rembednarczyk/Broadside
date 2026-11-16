import { type UiIntents } from "../intents";
import { Compass } from "./compass";
import { HelmPad } from "./helm-pad";
import { SailingPanel } from "./sailing-panel";
import { CombatPanel } from "./combat-panel";
import { TargetPanel } from "./target-panel";
import { Notices } from "./notices";
import { SettingsPanel } from "./settings-panel";
import { useHud } from "../store/hud-store";
import { isTextKey, text } from "../i18n/catalog";

export const Hud = ({ intents }: { intents: UiIntents }) => {
  const fps = useHud((h) => h.fps);
  const hidden = useHud((h) => h.hudHidden);
  const cam = useHud((h) => h.cameraMode);
  const lang = useHud((h) => h.language);
  if (hidden) {
    return (
      <div className="hud">
        <button className="show-hud" onPointerDown={() => intents.settings.toggleHud()} data-testid="show-hud">◉</button>
      </div>
    );
  }
  const camKey = `camera.${cam}`;
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
        <button className="lang" onPointerDown={() => intents.settings.nextCamera()} data-testid="next-camera">{isTextKey(camKey) ? text(lang, camKey) : cam}</button>
        <button className="lang" onPointerDown={() => intents.settings.toggleHud()} data-testid="hide-hud">◎</button>
        <button className="lang" onPointerDown={() => intents.settings.toggleSettings()} data-testid="open-settings">⚙</button>
        <span className="fps">{fps.toFixed(0)} fps</span>
      </div>
    </div>
  );
};
