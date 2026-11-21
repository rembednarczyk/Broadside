import { useHud, usesPad } from "../store/hud-store";
import { text, type TextKey } from "../i18n/catalog";
import { type SettingsIntents } from "../intents";

const LINES: readonly TextKey[] = ["help.goal", "help.sail", "help.drive", "help.orders", "help.wind", "help.fire", "help.ammo", "help.port", "help.danger", "help.keys", "help.credits"];

/** A screen worked with a finger (a phone or tablet): no keyboard to list. */
const touchOnly = (): boolean => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches;

/**
 * How to play, on the first start and from the settings: only what applies to the steering in
 * use and the device (11 paragraphs on a phone, keys and all, ran far below the fold; beta test
 * 19.11). The credits stay (the models' licence asks for them).
 */
export const HelpCard = ({ intents }: { intents: SettingsIntents }) => {
  const open = useHud((h) => h.helpOpen);
  const lang = useHud((h) => h.language);
  const steering = useHud((h) => h.steering);
  if (!open) return null;
  // Pointing and orders are simple steering's; the sailing paragraph also covers the classic helm; the pad is the action mode's.
  const shown = LINES.filter((k) => k !== "help.orders" || steering === "simple")
    .filter((k) => k !== "help.sail" || !usesPad(steering))
    .filter((k) => k !== "help.drive" || usesPad(steering))
    .filter((k) => k !== "help.keys" || !touchOnly());
  return (
    <div className="panel help" data-testid="help">
      <div className="title">{text(lang, "help.title")}</div>
      <ul>
        {shown.map((k) => (
          <li key={k}>{text(lang, k)}</li>
        ))}
      </ul>
      <button className="wide" onPointerDown={() => intents.toggleHelp()} data-testid="close-help">{text(lang, "help.close")}</button>
    </div>
  );
};
