import { useHud } from "../store/hud-store";
import { isTextKey, text } from "../i18n/catalog";
import { type PortIntents } from "../intents";

const AMMO = ["round", "heavy", "chain", "grape", "hot", "shell", "greekFire", "rocket", "smoke", "mine"] as const;

/** Harbour services while alongside: repair, crew, provisions, shot, plunder. */
export const PortPanel = ({ intents }: { intents: PortIntents }) => {
  const p = useHud((h) => h.port);
  const lang = useHud((h) => h.language);
  const gold = useHud((h) => h.gold);
  if (!p) return null;
  const fac = `faction.${p.owner}`;
  return (
    <div className="panel harbour" data-testid="port">
      <div className="title">{p.name} · {isTextKey(fac) ? text(lang, fac) : p.owner}</div>
      {p.factor === null ? (
        <div className="alarm">{text(lang, "port.hostile")}</div>
      ) : (
        <>
          <div className="port-grid">
            <button disabled={p.repairCost === 0 || p.repairCost > gold} onPointerDown={() => intents.trade("repair", 1)}>{text(lang, "port.repair")} <small>{p.repairCost}</small></button>
            <button disabled={p.crewMissing === 0 || p.crewCost > gold} onPointerDown={() => intents.trade("crew", p.crewMissing)}>{text(lang, "port.crew")} <small>{p.crewMissing} · {p.crewCost}</small></button>
            <button onPointerDown={() => intents.trade("provisions", 10)}>{text(lang, "port.provisions")}</button>
            <button disabled={p.plunderValue === 0} onPointerDown={() => intents.trade("sellPlunder", 1)}>{text(lang, "port.sell")} <small>{p.plunderValue}</small></button>
          </div>
          <div className="label">{text(lang, "port.ammo")}</div>
          <div className="port-ammo">
            {AMMO.map((a) => {
              const key = `ammo.${a}`;
              return <button key={a} onPointerDown={() => intents.trade("ammo", 10, a)}>{isTextKey(key) ? text(lang, key) : a}</button>;
            })}
          </div>
        </>
      )}
      {p.factor !== null && p.yard.length > 0 && (
        <>
          <div className="label">{text(lang, "port.refits")}</div>
          <div className="port-grid">
            {p.refits.map((r) => {
              const key = `refit.${r.id}`;
              return (
                <button key={r.id} className={r.fitted ? "on" : ""} disabled={r.fitted || r.cost > gold} onPointerDown={() => intents.refit(r.id)} data-testid={`refit-${r.id}`}>
                  {isTextKey(key) ? text(lang, key) : r.id} <small>{r.fitted ? "✓" : r.cost}</small>
                </button>
              );
            })}
          </div>
          <div className="label">{text(lang, "port.yard")}</div>
          <div className="port-yard">
            {p.yard.map((y) => {
              const key = `class.${y.classId}`;
              return (
                <button key={y.classId} disabled={y.cost > gold} onPointerDown={() => intents.buyShip(y.classId)} data-testid={`buy-${y.classId}`}>
                  {isTextKey(key) ? text(lang, key) : y.classId}
                  <small>{y.cost < 0 ? `+${-y.cost}` : y.cost} · {y.guns} {text(lang, "port.guns")}</small>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="label">{text(lang, "port.standing")}</div>
      <div className="standings">
        {p.standings.map((s) => {
          const key = `faction.${s.faction}`;
          return (
            <div key={s.faction} className={s.value <= -0.5 ? "standing war" : "standing"}>
              <span>{isTextKey(key) ? text(lang, key) : s.faction}</span>
              <i style={{ width: `${Math.round((s.value + 1) * 50)}%` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
