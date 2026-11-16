import { useHud } from "../store/hud-store";

/** An arrow at the edge of the clear middle of the screen, pointing at an enemy hidden from view. */
export const EnemyMarker = () => {
  const m = useHud((h) => h.marker);
  if (!m) return null;
  return (
    <div className="enemy-marker" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }} data-testid="enemy-marker">
      <span className="arrow" style={{ transform: `rotate(${m.angle}rad)` }}>▲</span>
      <small>{Math.round(m.range)} m</small>
    </div>
  );
};
