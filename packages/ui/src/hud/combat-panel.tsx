import { useHud, type BatteryHud } from "../store/hud-store";
import { isTextKey, text, type TextKey } from "../i18n/catalog";
import { type CombatIntents } from "../intents";

const Gauge = ({ b }: { b: BatteryHud }) => <span className="gauge"><span style={{ width: `${Math.round(b.ready * 100)}%` }} /></span>;

/** Fire controls (Black Flag style: a side per button, a gauge of loaded guns) and ammunition. */
export const CombatPanel = ({ intents }: { intents: CombatIntents }) => {
  const c = useHud((h) => h.combat);
  const lang = useHud((h) => h.language);
  if (!c) return null;
  const t = (k: TextKey) => text(lang, k);
  const small = (label: TextKey, b: BatteryHud, onFire: () => void, id: string) =>
    b.count > 0 && (
      <button className="fire small" onPointerDown={onFire} data-testid={id} disabled={b.ready === 0}>
        {t(label)}
        <Gauge b={b} />
      </button>
    );
  return (
    <>
      <button className="fire side port" onPointerDown={() => intents.fire("broadside", "port")} data-testid="fire-port">
        {t("hud.fire")}
        <small>{t("hud.port")}</small>
        <Gauge b={c.port} />
      </button>
      <button className="fire side starboard" onPointerDown={() => intents.fire("broadside", "starboard")} data-testid="fire-starboard">
        {t("hud.fire")}
        <small>{t("hud.starboard")}</small>
        <Gauge b={c.starboard} />
      </button>
      <div className="panel combat">
        <div className="ammo">
          {c.ammo.map((a) => {
            const key = `ammo.${a.id}`;
            return (
              <button key={a.id} className={c.broadsideAmmo === a.id ? "on" : ""} disabled={a.left === 0} onPointerDown={() => intents.loadAmmo(a.id)} data-testid={`ammo-${a.id}`}>
                {isTextKey(key) ? text(lang, key) : a.id}
                <small>{a.left}</small>
              </button>
            );
          })}
        </div>
        <div className="batteries">
          {small("hud.bow", c.bow, () => intents.fire("bowChaser"), "fire-bow")}
          {small("hud.stern", c.stern, () => intents.fire("sternChaser"), "fire-stern")}
          {small("hud.mortar", c.mortar, () => intents.fire("mortar"), "fire-mortar")}
          {small("hud.swivel", c.swivel, () => intents.fire("swivel"), "fire-swivel")}
          <button className={c.braced ? "on small" : "small"} onPointerDown={() => intents.brace()}>{t("hud.brace")}</button>
          <button className="small" disabled={c.barrels === 0} onPointerDown={() => intents.drop("fireBarrel")}>{t("hud.barrel")} <small>{c.barrels}</small></button>
          <button className="small" disabled={c.mines === 0} onPointerDown={() => intents.drop("mine")}>{t("hud.mine")} <small>{c.mines}</small></button>
          {c.canBoard && <button className="small storm" onPointerDown={() => intents.board()} data-testid="board">{t("hud.board")}</button>}
          {c.canStorm && <button className="small storm" onPointerDown={() => intents.assault()} data-testid="storm">{t("hud.storm")}</button>}
        </div>
        <div className="status">
          <span>{t("hud.hull")} {Math.round(c.hull * 100)}%</span>
          <span>{t("hud.crew")} {c.crew}/{c.crewMax}</span>
          {c.fires > 0 && <span className="alarm">{t("hud.fires")} {c.fires}</span>}
          {c.water > 0.5 && <span className="alarm">{t("hud.water")} {c.water.toFixed(0)} m³</span>}
        </div>
      </div>
    </>
  );
};
