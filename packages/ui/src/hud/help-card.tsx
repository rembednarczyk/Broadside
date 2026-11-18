import { useHud } from "../store/hud-store";
import { text, type TextKey } from "../i18n/catalog";
import { type SettingsIntents } from "../intents";

const LINES: readonly TextKey[] = ["help.goal", "help.sail", "help.orders", "help.wind", "help.fire", "help.ammo", "help.port", "help.danger", "help.keys", "help.credits"];

/** How to play, on the first start and from the settings. */
export const HelpCard = ({ intents }: { intents: SettingsIntents }) => {
  const open = useHud((h) => h.helpOpen);
  const lang = useHud((h) => h.language);
  if (!open) return null;
  return (
    <div className="panel help" data-testid="help">
      <div className="title">{text(lang, "help.title")}</div>
      <ul>
        {LINES.map((k) => (
          <li key={k}>{text(lang, k)}</li>
        ))}
      </ul>
      <button className="wide" onPointerDown={() => intents.toggleHelp()} data-testid="close-help">{text(lang, "help.close")}</button>
    </div>
  );
};
