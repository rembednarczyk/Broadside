import { useState } from "react";
import { useHud } from "../store/hud-store";
import { isTextKey, text, type TextKey } from "../i18n/catalog";
import { type SailIntents } from "../intents";

const LEVELS = [0, 1, 2, 3, 4] as const;

/** Speed, wind and sail plan. */
export const SailingPanel = ({ intents }: { intents: SailIntents }) => {
  const s = useHud((h) => h.sailing);
  const lang = useHud((h) => h.language);
  const gold = useHud((h) => h.gold);
  const days = useHud((h) => h.provisions);
  // Phones hide the per-mast rows until asked (a toggle shown only on small screens).
  const [open, setOpen] = useState(false);
  if (!s) return null;
  const target = s.sailTargets[0] ?? 0;
  const bft = `bft.${s.beaufort}`;
  const cls = `class.${s.classId}`;
  return (
    <div className={open ? "panel sailing open" : "panel sailing"}>
      <div className="title">{isTextKey(cls) ? text(lang, cls) : s.classId}</div>
      <div className="row">
        <span className="label">{text(lang, "hud.speed")}</span>
        <span className="value" data-testid="speed">{s.speedKnots.toFixed(1)} {text(lang, "hud.knots")}</span>
      </div>
      <div className="row">
        <span className="label">{text(lang, "hud.wind")}</span>
        <span className="value">{s.windKnots.toFixed(0)} {text(lang, "hud.knots")} · {isTextKey(bft) ? text(lang, bft) : ""}</span>
      </div>
      {s.weather && isTextKey(`weather.${s.weather}`) && <div className="row weather"><span className="label">{text(lang, "hud.weather")}</span><span className="value">{text(lang, `weather.${s.weather}` as TextKey)}</span></div>}
      <div className="row gold">
        <span className="label">{text(lang, "hud.gold")}</span>
        <span className="value" data-testid="gold">{gold} · {days.toFixed(0)} {text(lang, "hud.days")}</span>
      </div>
      <div className="row heel">
        <span className="label">{text(lang, "hud.heel")}</span>
        <span className="value">{s.heelDeg.toFixed(0)}°</span>
      </div>
      <div className="label sails-label">{text(lang, "hud.sails")}</div>
      <div className="sail-buttons">
        {LEVELS.map((l) => (
          <button key={l} className={l === target ? "on" : ""} onPointerDown={() => intents.setSails(l)} data-testid={`sail-${l}`}>
            {text(lang, `sail.${l}`)}
          </button>
        ))}
      </div>
      {s.sailTargets.length > 1 && (
        <button className="masts-toggle" onPointerDown={() => setOpen(!open)} data-testid="masts-toggle">{text(lang, "hud.masts")} {open ? "▴" : "▾"}</button>
      )}
      {s.sailTargets.length > 1 && (
        <div className="masts">
          {s.sailTargets.map((lvl, i) => (
            <div key={i} className={`mast-row ${(s.mastLoad[i] ?? 0) > 1 ? "alarm" : (s.mastLoad[i] ?? 0) > 0.85 ? "warn" : ""}`}>
              <span>{text(lang, "hud.mast")} {i + 1}</span>
              <button onPointerDown={() => intents.setMastSails(i, Math.max(0, lvl - 1))}>−</button>
              <span className="lvl">{text(lang, `sail.${lvl}` as TextKey)}</span>
              <button onPointerDown={() => intents.setMastSails(i, Math.min(4, lvl + 1))}>+</button>
            </div>
          ))}
        </div>
      )}
      {s.mastLoad.some((l) => l > 1) && <div className="alarm">{text(lang, "hud.strain")}</div>}
      {s.shoalAhead && <div className="alarm shoal" data-testid="shoal">{text(lang, "hud.shoal")}</div>}
      {s.hasOars && (
        <button className={s.oars ? "on wide" : "wide"} onPointerDown={() => intents.toggleOars()}>
          {text(lang, "hud.oars")}
        </button>
      )}
    </div>
  );
};
