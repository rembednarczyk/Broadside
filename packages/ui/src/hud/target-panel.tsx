import { useHud } from "../store/hud-store";
import { isTextKey, text, type TextKey } from "../i18n/catalog";

/** The ship the guns would fire at: class, flag, range and condition. */
export const TargetPanel = () => {
  const t = useHud((h) => h.target);
  const lang = useHud((h) => h.language);
  if (!t) return null;
  const cls = `class.${t.classId}`;
  const fac = `faction.${t.faction}`;
  return (
    <div className="panel target" data-testid="target">
      <div className="title">{isTextKey(cls) ? text(lang, cls) : t.classId} · {isTextKey(fac) ? text(lang, fac) : t.faction}</div>
      {/* Segmented like an action game's health bar: a quarter of the hull to a segment. */}
      <div className="bar segmented"><span style={{ width: `${Math.round(t.hull * 100)}%` }} /></div>
      {t.state && t.state !== "sound" && !t.struck && isTextKey(`state.${t.state}`) && (
        <div className={t.state === "disabled" ? "alarm" : "row"}><span>{text(lang, `state.${t.state}` as TextKey)}</span></div>
      )}
      <div className="row"><span>{text(lang, "hud.range")}</span><span>{Math.round(t.range)} m</span></div>
      {t.kind === "fort" && t.guns ? (
        <div className="row"><span>{text(lang, "hud.guns")}</span><span>{t.guns[0]}/{t.guns[1]}</span></div>
      ) : (
        <div className="row"><span>{text(lang, "hud.crew")}</span><span>{t.crew}</span></div>
      )}
      {t.silenced && <div className="alarm">{text(lang, "hud.silenced")}</div>}
      {t.struck && <div className="alarm">{text(lang, "hud.struck")}</div>}
    </div>
  );
};
