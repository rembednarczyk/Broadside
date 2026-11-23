import { useHud } from "../store/hud-store";

/** Ship-relative compass: the bow is up, the arrow shows where the wind comes from. */
export const Compass = () => {
  const s = useHud((h) => h.sailing);
  const way = useHud((h) => h.waypoint);
  if (!s) return null;
  const windDeg = (s.windFromRelative * 180) / Math.PI;
  const courseDeg = s.course === null ? null : (((s.course - s.heading) * 180) / Math.PI);
  return (
    <svg className="compass" viewBox="-50 -50 100 100" data-testid="compass">
      <defs>
        <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0d28a" />
          <stop offset="0.5" stopColor="#c9a050" />
          <stop offset="1" stopColor="#7a5a24" />
        </linearGradient>
      </defs>
      <circle r="46" className="dial" />
      <circle r="46" className="rim" />
      {/* A card of 32 points: ticks every 11.25 deg, the eight principal ones longer. */}
      {Array.from({ length: 32 }, (_, i) => (
        <line key={i} className={i % 4 === 0 ? "tick major" : "tick"} x1="0" y1={-43} x2="0" y2={i % 4 === 0 ? -36 : -39.5} transform={`rotate(${i * 11.25})`} />
      ))}
      <path d="M0,-40 L6,-28 L-6,-28 Z" className="bow" />
      <g transform={`rotate(${windDeg})`}>
        <path d="M0,-44 L0,-14 M-6,-22 L0,-14 L6,-22" className="wind" />
      </g>
      {courseDeg !== null && (
        <g transform={`rotate(${courseDeg})`}>
          <circle cx="0" cy="-36" r="3" className="course" />
        </g>
      )}
      {/* The waypoint set on the chart: a flag on the rim at its bearing, its distance under the heading. */}
      {way && (
        <g transform={`rotate(${(way.relative * 180) / Math.PI})`} data-testid="compass-waypoint">
          <path d="M0,-46 L0,-30 M0,-46 L8,-42 L0,-38" className="waypoint" />
        </g>
      )}
      {way && <text y="31" className="waypoint-distance">{way.distance >= 1000 ? `${(way.distance / 1000).toFixed(1)} km` : `${Math.round(way.distance)} m`}</text>}
      <text y="6" className="heading">{(((s.heading * 180) / Math.PI + 360) % 360).toFixed(0)}°</text>
    </svg>
  );
};
