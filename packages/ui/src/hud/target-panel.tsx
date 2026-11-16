import { useHud } from "../store/hud-store";
import { isTextKey, text } from "../i18n/catalog";

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
      <div className="bar"><span style={{ width: `${Math.round(t.hull * 100)}%` }} /></div>
      <div className="row"><span>{text(lang, "hud.range")}</span><span>{Math.round(t.range)} m</span></div>
      <div className="row"><span>{text(lang, "hud.crew")}</span><span>{t.crew}</span></div>
      {t.struck && <div className="alarm">{text(lang, "hud.struck")}</div>}
    </div>
  );
};
