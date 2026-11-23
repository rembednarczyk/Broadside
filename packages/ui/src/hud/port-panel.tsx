import { useEffect, useState } from "react";
import { AMMO_LOTS, type PortHud, useHud } from "../store/hud-store";
import { isTextKey, text, type TextKey } from "../i18n/catalog";
import { type PortIntents } from "../intents";
import { JobLine } from "./job-panel";

type Tab = "services" | "shot" | "yard" | "jobs";
const TABS: readonly { readonly id: Tab; readonly label: TextKey }[] = [
  { id: "services", label: "port.tab.services" },
  { id: "shot", label: "port.ammo" },
  { id: "yard", label: "port.tab.yard" },
  { id: "jobs", label: "port.tab.jobs" },
];

type Lang = "en" | "pl";
const label = (lang: Lang, key: string, fallback: string): string => (isTextKey(key) ? text(lang, key) : fallback);

const Services = ({ p, lang, gold, intents }: { p: PortHud; lang: Lang; gold: number; intents: PortIntents }) => (
  <>
    <div className="port-grid">
      <button disabled={p.repairCost === 0 || p.repairCost > gold} onPointerDown={() => intents.trade("repair", 1)}>{text(lang, "port.repair")} <small>{p.repairCost}</small></button>
      <button disabled={p.crewMissing === 0 || p.crewCost > gold} onPointerDown={() => intents.trade("crew", p.crewMissing)}>{text(lang, "port.crew")} <small>{p.crewMissing} · {p.crewCost}</small></button>
      <button onPointerDown={() => intents.trade("provisions", 10)}>{text(lang, "port.provisions")}</button>
      <button disabled={p.plunderValue === 0} onPointerDown={() => intents.trade("sellPlunder", 1)}>{text(lang, "port.sell")} <small>{p.plunderValue}</small></button>
    </div>
    <div className="label">{text(lang, "port.standing")}</div>
    <div className="standings">
      {p.standings.map((s) => (
        <div key={s.faction} className={s.value <= -0.5 ? "standing war" : "standing"}>
          <span>{label(lang, `faction.${s.faction}`, s.faction)}</span>
          <i style={{ width: `${Math.round((s.value + 1) * 50)}%` }} />
        </div>
      ))}
    </div>
  </>
);

/** Shot by the lot (owner 22.11: ten at a time was too few): the lot chosen above, each load's price and stock. */
const Shot = ({ p, lang, gold, intents }: { p: PortHud; lang: Lang; gold: number; intents: PortIntents }) => {
  const [lot, setLot] = useState(0);
  const n = AMMO_LOTS[lot]!;
  return (
    <>
      <div className="port-lots">
        <span className="label">{text(lang, "port.lot")}</span>
        {AMMO_LOTS.map((k, i) => (
          <button key={k} className={i === lot ? "on" : ""} onPointerDown={() => setLot(i)} data-testid={`lot-${k}`}>×{k}</button>
        ))}
      </div>
      <div className="port-ammo">
        {p.ammo.map((a) => (
          <button key={a.id} disabled={a.prices[lot]! > gold} onPointerDown={() => intents.trade("ammo", n, a.id)} data-testid={`buy-ammo-${a.id}`}>
            {label(lang, `ammo.${a.id}`, a.id)}
            <small>{a.have} · {a.prices[lot]}</small>
          </button>
        ))}
      </div>
    </>
  );
};

const Yard = ({ p, lang, gold, intents }: { p: PortHud; lang: Lang; gold: number; intents: PortIntents }) => (
  <>
    <div className="label">{text(lang, "port.refits")}</div>
    <div className="port-grid">
      {p.refits.map((r) => (
        <button key={r.id} className={r.fitted ? "on" : ""} disabled={r.fitted || r.cost > gold} onPointerDown={() => intents.refit(r.id)} data-testid={`refit-${r.id}`}>
          {label(lang, `refit.${r.id}`, r.id)} <small>{r.fitted ? "✓" : r.cost}</small>
        </button>
      ))}
    </div>
    <div className="label">{text(lang, "port.yard")}</div>
    <div className="port-yard">
      {p.yard.map((y) => (
        <button key={y.classId} disabled={y.cost > gold} onPointerDown={() => intents.buyShip(y.classId)} data-testid={`buy-${y.classId}`}>
          {label(lang, `class.${y.classId}`, y.classId)}
          <small>{y.cost < 0 ? `+${-y.cost}` : y.cost} · {y.guns} {text(lang, "port.guns")}</small>
        </button>
      ))}
    </div>
  </>
);

/** Harbour services while alongside, in tabs: services and standing, shot, shipyard and refits. */
export const PortPanel = ({ intents }: { intents: PortIntents }) => {
  const p = useHud((h) => h.port);
  const lang = useHud((h) => h.language);
  const gold = useHud((h) => h.gold);
  const [tab, setTab] = useState<Tab>("services");
  // The port the player shut the panel of (it stays shut until she leaves the port or opens it again).
  const [closed, setClosed] = useState<number | null>(null);
  const index = p?.index ?? null;
  useEffect(() => {
    if (index === null) setClosed(null);
  }, [index]);
  if (!p) return null;
  if (closed === p.index) {
    return (
      <button className="harbour-open" onPointerDown={() => setClosed(null)} data-testid="port-open">{text(lang, "port.open")} · {p.name}</button>
    );
  }
  return (
    <div className="panel harbour" data-testid="port">
      <div className="title">
        {p.name} · {label(lang, `faction.${p.owner}`, p.owner)}
        <button className="close" onPointerDown={() => setClosed(p.index)} aria-label={text(lang, "port.close")} data-testid="port-close">×</button>
      </div>
      {p.factor === null ? (
        <div className="alarm">{text(lang, "port.hostile")}</div>
      ) : (
        <>
          <div className="port-tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? "on" : ""} onPointerDown={() => setTab(t.id)} data-testid={`port-tab-${t.id}`}>{text(lang, t.label)}</button>
            ))}
          </div>
          {tab === "services" && <Services p={p} lang={lang} gold={gold} intents={intents} />}
          {tab === "shot" && <Shot p={p} lang={lang} gold={gold} intents={intents} />}
          {tab === "jobs" && (p.offer ? (
            <div className="offer">
              <JobLine j={p.offer} lang={lang} />
              <button onPointerDown={() => intents.takeContract()} data-testid="take-contract">{text(lang, "contract.take")} <small>{p.offer.minutes} min</small></button>
            </div>
          ) : <div className="label">{text(lang, "contract.none")}</div>)}
          {tab === "yard" && <Yard p={p} lang={lang} gold={gold} intents={intents} />}
        </>
      )}
    </div>
  );
};
