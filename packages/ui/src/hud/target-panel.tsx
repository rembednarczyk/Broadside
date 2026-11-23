import { useEffect, useRef, useState } from "react";
import { useHud } from "../store/hud-store";
import { type OrderIntents } from "../intents";
import { isTextKey, text, type TextKey } from "../i18n/catalog";

/**
 * A counter that steps each time the same target's hull drops (a hit told at a glance, as an action
 * game's health bar flashes: beta test 22.11); a new target starts again from zero.
 */
const useHitFlash = (who: string | null, hull: number): number => {
  const last = useRef<{ who: string | null; hull: number }>({ who, hull });
  const [n, setN] = useState(0);
  useEffect(() => {
    const was = last.current;
    if (was.who === who && hull < was.hull - 0.002) setN((k) => k + 1);
    else if (was.who !== who) setN(0);
    last.current = { who, hull };
  }, [who, hull]);
  return n;
};

/** The ship the guns would fire at: class, flag, range and condition. */
export const TargetPanel = ({ intents }: { intents: OrderIntents }) => {
  const t = useHud((h) => h.target);
  const lang = useHud((h) => h.language);
  const flash = useHitFlash(t ? `${t.kind}|${t.id ?? t.classId}|${t.faction}` : null, t?.hull ?? 1);
  if (!t) return null;
  const cls = `class.${t.classId}`;
  const fac = `faction.${t.faction}`;
  return (
    <div className="panel target" data-testid="target">
      <div className="title">{t.marked && <span className="marked" title={text(lang, "hud.marked")}>◎ </span>}{isTextKey(cls) ? text(lang, cls) : t.classId} · {isTextKey(fac) ? text(lang, fac) : t.faction}</div>
      {/* Segmented like an action game's health bar: a quarter of the hull to a segment. */}
      {/* The bar flashes when a hit takes off the target's hull (the key restarts the animation). */}
      <div key={flash} className={`bar segmented${flash > 0 ? " hit" : ""}`}><span style={{ width: `${Math.round(t.hull * 100)}%` }} /></div>
      {/* Her rigging as a thinner bar under the hull's, and her masts standing: what chain shot has done (beta test 19.11). */}
      {t.rigging !== undefined && <div className="bar rig" title={text(lang, "hud.rigging")}><span style={{ width: `${Math.round(t.rigging * 100)}%` }} /></div>}
      {/* A disabled ship can be taken (Black Flag's prompt): the crew run her down and board her. */}
      {t.state === "disabled" && !t.struck && t.id !== undefined && (
        <button className="alarm wide" onPointerDown={() => intents.board(t.id!)} data-testid="board-disabled">{text(lang, "state.disabled")}</button>
      )}
      {/* A ship that has struck lies hove to: run down and take her as a prize (once). */}
      {t.struck && !t.taken && t.id !== undefined && (
        <button className="alarm wide" onPointerDown={() => intents.board(t.id!)} data-testid="board-struck">{text(lang, "state.struckBoard")}</button>
      )}
      {t.state && t.state !== "sound" && t.state !== "disabled" && !t.struck && isTextKey(`state.${t.state}`) && (
        <div className="row"><span>{text(lang, `state.${t.state}` as TextKey)}</span></div>
      )}
      <div className="row"><span>{text(lang, "hud.range")}</span><span>{Math.round(t.range)} m</span></div>
      {t.far && t.kind !== "fort" && <div className="row hint"><span>{text(lang, "hud.far")}</span></div>}
      {t.kind === "fort" && t.guns ? (
        <>
          <div className="row"><span>{text(lang, "hud.guns")}</span><span>{t.guns[0]}/{t.guns[1]}</span></div>
          {t.mortars && t.mortars[1] > 0 && <div className="row"><span>{text(lang, "hud.mortars")}</span><span>{t.mortars[0]}/{t.mortars[1]}</span></div>}
          {/* What a landing would meet, and its odds (beta test 22.11: a galleon's party lost every storm unseen). */}
          {t.garrison !== undefined && <div className="row"><span>{text(lang, "hud.garrison")}</span><span>{t.garrison}</span></div>}
          {t.party !== undefined && <div className="row"><span>{text(lang, "hud.party")}</span><span>{t.party}</span></div>}
          {t.chance !== undefined && <div className="row"><span>{text(lang, "hud.stormChance")}</span><span>{Math.round(t.chance * 100)}%</span></div>}
        </>
      ) : (
        <>
          <div className="row"><span>{text(lang, "hud.crew")}</span><span>{t.crew}</span></div>
          {t.masts && t.masts[0] < t.masts[1] && <div className="row"><span>{text(lang, "hud.masts")}</span><span>{t.masts[0]}/{t.masts[1]}</span></div>}
        </>
      )}
      {t.silenced && <div className="alarm">{text(lang, "hud.silenced")}</div>}
      {t.struck && t.taken && <div className="alarm">{text(lang, "hud.struck")}</div>}
    </div>
  );
};
