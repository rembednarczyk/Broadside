import { type UiIntents } from "../intents";
import { Compass } from "./compass";
import { HelmPad } from "./helm-pad";
import { SailingPanel } from "./sailing-panel";
import { CombatPanel } from "./combat-panel";
import { TargetPanel } from "./target-panel";
import { JobPanel } from "./job-panel";
import { EnemyMarker } from "./enemy-marker";
import { Notices } from "./notices";
import { SettingsPanel } from "./settings-panel";
import { PortPanel } from "./port-panel";
import { HelpCard } from "./help-card";
import { useHud } from "../store/hud-store";
import { isTextKey, text } from "../i18n/catalog";

export const Hud = ({ intents }: { intents: UiIntents }) => {
  const fps = useHud((h) => h.fps);
  const hidden = useHud((h) => h.hudHidden);
  const cam = useHud((h) => h.cameraMode);
  const lang = useHud((h) => h.language);
  const steering = useHud((h) => h.steering);
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
      {/* Regions of the grid (style.css): the left and right columns, the top, the two fire
          corners and the bottom; the middle is the sea's, the port panel apart. */}
      <div className="col left">
        <SailingPanel intents={intents.sails} />
        <JobPanel />
      </div>
      <div className="col right">
        <Compass />
        <TargetPanel />
      </div>
      <CombatPanel intents={intents.combat} />
      <PortPanel intents={intents.port} />
      <div className="bottom">
        {steering === "classic" && <HelmPad intents={intents.helm} />}
        <div className="corner">
          <button className="lang" onPointerDown={() => intents.settings.nextCamera()} data-testid="next-camera">{isTextKey(camKey) ? text(lang, camKey) : cam}</button>
          <button className="lang" onPointerDown={() => intents.settings.toggleHud()} data-testid="hide-hud">◎</button>
          <button className="lang" onPointerDown={() => intents.settings.toggleSettings()} data-testid="open-settings">⚙</button>
          <span className="fps">{fps.toFixed(0)} fps</span>
        </div>
      </div>
      <EnemyMarker />
      <Notices />
      <SettingsPanel intents={intents.settings} />
      <HelpCard intents={intents.settings} />
    </div>
  );
};
