import { useHud } from "../store/hud-store";

/** Ship-relative compass: the bow is up, the arrow shows where the wind comes from. */
export const Compass = () => {
  const s = useHud((h) => h.sailing);
  if (!s) return null;
  const windDeg = (s.windFromRelative * 180) / Math.PI;
  const courseDeg = s.course === null ? null : (((s.course - s.heading) * 180) / Math.PI);
  return (
    <svg className="compass" viewBox="-50 -50 100 100" data-testid="compass">
      <circle r="46" className="dial" />
      <path d="M0,-40 L6,-28 L-6,-28 Z" className="bow" />
      <g transform={`rotate(${windDeg})`}>
        <path d="M0,-44 L0,-14 M-6,-22 L0,-14 L6,-22" className="wind" />
      </g>
      {courseDeg !== null && (
        <g transform={`rotate(${courseDeg})`}>
          <circle cx="0" cy="-36" r="3" className="course" />
        </g>
      )}
      <text y="6" className="heading">{(((s.heading * 180) / Math.PI + 360) % 360).toFixed(0)}°</text>
    </svg>
  );
};
