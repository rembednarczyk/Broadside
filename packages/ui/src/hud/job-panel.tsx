import { type JobHud, useHud } from "../store/hud-store";
import { isTextKey, text } from "../i18n/catalog";

type Lang = "en" | "pl";
const label = (lang: Lang, key: string, fallback: string): string => (isTextKey(key) ? text(lang, key) : fallback);

/** One line describing a contract: what to do, to whom, and the pay. */
export const JobLine = ({ j, lang }: { j: JobHud; lang: Lang }) => (
  <>
    <div className="title">{label(lang, `contract.${j.kind}`, j.kind)}</div>
    <div className="row">
      <span>{label(lang, `class.${j.classId}`, j.classId)} · {label(lang, `faction.${j.faction}`, j.faction)}</span>
      <span>{j.reward}</span>
    </div>
    {j.dest && <div className="row"><span>{text(lang, "contract.to")}</span><span>{j.dest}</span></div>}
  </>
);

/** The contract the player has taken: where the ship is and how long is left. */
export const JobPanel = () => {
  const j = useHud((h) => h.job);
  const lang = useHud((h) => h.language);
  if (!j) return null;
  return (
    <div className="panel job" data-testid="job">
      <JobLine j={j} lang={lang} />
      <div className="row">
        <span>{j.distance !== undefined ? `${(j.distance / 1000).toFixed(1)} km · ${Math.round(j.bearing ?? 0)}°` : ""}</span>
        <span>{j.minutes} min</span>
      </div>
    </div>
  );
};
