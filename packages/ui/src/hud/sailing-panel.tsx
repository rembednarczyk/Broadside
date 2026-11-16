import { useHud } from "../store/hud-store";
import { isTextKey, text } from "../i18n/catalog";
import { type SailIntents } from "../intents";

const LEVELS = [0, 1, 2, 3, 4] as const;

/** Speed, wind and sail plan. */
export const SailingPanel = ({ intents }: { intents: SailIntents }) => {
  const s = useHud((h) => h.sailing);
  const lang = useHud((h) => h.language);
  if (!s) return null;
  const target = s.sailTargets[0] ?? 0;
  const bft = `bft.${s.beaufort}`;
  const cls = `class.${s.classId}`;
  return (
    <div className="panel sailing">
      <div className="title">{isTextKey(cls) ? text(lang, cls) : s.classId}</div>
      <div className="row">
        <span className="label">{text(lang, "hud.speed")}</span>
        <span className="value" data-testid="speed">{s.speedKnots.toFixed(1)} {text(lang, "hud.knots")}</span>
      </div>
      <div className="row">
        <span className="label">{text(lang, "hud.wind")}</span>
        <span className="value">{s.windKnots.toFixed(0)} {text(lang, "hud.knots")} · {isTextKey(bft) ? text(lang, bft) : ""}</span>
      </div>
      <div className="row">
        <span className="label">{text(lang, "hud.heel")}</span>
        <span className="value">{s.heelDeg.toFixed(0)}°</span>
      </div>
      <div className="label">{text(lang, "hud.sails")}</div>
      <div className="sail-buttons">
        {LEVELS.map((l) => (
          <button key={l} className={l === target ? "on" : ""} onPointerDown={() => intents.setSails(l)} data-testid={`sail-${l}`}>
            {text(lang, `sail.${l}`)}
          </button>
        ))}
      </div>
      {s.hasOars && (
        <button className={s.oars ? "on wide" : "wide"} onPointerDown={() => intents.toggleOars()}>
          {text(lang, "hud.oars")}
        </button>
      )}
    </div>
  );
};
