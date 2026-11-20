import { useHud } from "../store/hud-store";
import { type OrderIntents } from "../intents";
import { text } from "../i18n/catalog";

/**
 * An arrow at the edge of the clear middle of the screen, pointing at an enemy hidden from view;
 * with no enemy about, at the ship of the contract in hand (tap it: follow her under escort, fight
 * her otherwise), else at the nearest wreck still to be salvaged (tap it: the crew go and anchor
 * off her, as a tap on the wreck itself).
 */
export const EnemyMarker = ({ intents }: { intents: OrderIntents }) => {
  const m = useHud((h) => h.marker);
  const lang = useHud((h) => h.language);
  // Alongside a port its panel holds the middle of the screen: no arrows over it.
  const inPort = useHud((h) => h.port !== null);
  if (!m || inPort) return null;
  const wreck = m.kind === "wreck" && m.at;
  const job = m.kind === "job" && m.target !== undefined;
  // A tap on the contract's arrow: follow the merchantman under escort, fight the quarry.
  const tap = wreck ? () => intents.salvage(m.at!.x, m.at!.z) : job ? () => (m.order === "follow" ? intents.follow(m.target!) : intents.engage(m.target!)) : undefined;
  return (
    <div
      className={wreck ? "enemy-marker wreck" : job ? "enemy-marker job" : "enemy-marker"}
      style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
      data-testid={wreck ? "wreck-marker" : job ? "job-marker" : "enemy-marker"}
      onPointerDown={tap}
    >
      <span className="arrow" style={{ transform: `rotate(${m.angle}rad) scaleX(0.6)` }}>▲</span>
      <small>{wreck ? `${text(lang, "marker.wreck")} ` : job ? `${text(lang, "marker.job")} ` : ""}{Math.round(m.range)} m</small>
    </div>
  );
};
