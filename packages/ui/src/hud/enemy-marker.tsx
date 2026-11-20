import { useHud } from "../store/hud-store";
import { type OrderIntents } from "../intents";
import { text } from "../i18n/catalog";

/**
 * An arrow at the edge of the clear middle of the screen, pointing at an enemy hidden from view;
 * with no enemy about, at the nearest wreck still to be salvaged (tap it: the crew go and anchor
 * off her, as a tap on the wreck itself).
 */
export const EnemyMarker = ({ intents }: { intents: OrderIntents }) => {
  const m = useHud((h) => h.marker);
  const lang = useHud((h) => h.language);
  if (!m) return null;
  const wreck = m.kind === "wreck" && m.at;
  return (
    <div
      className={wreck ? "enemy-marker wreck" : "enemy-marker"}
      style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
      data-testid={wreck ? "wreck-marker" : "enemy-marker"}
      onPointerDown={wreck ? () => intents.salvage(m.at!.x, m.at!.z) : undefined}
    >
      <span className="arrow" style={{ transform: `rotate(${m.angle}rad) scaleX(0.6)` }}>▲</span>
      <small>{wreck ? `${text(lang, "marker.wreck")} ` : ""}{Math.round(m.range)} m</small>
    </div>
  );
};
