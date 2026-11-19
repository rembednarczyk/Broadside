import { type PointerEvent } from "react";
import { useHud } from "../store/hud-store";
import { text, type TextKey } from "../i18n/catalog";
import { type ChartIntents, type SettingsIntents } from "../intents";

type P = { readonly x: number; readonly z: number };

/** Grid of the chart (m): squares of a kilometre. */
const GRID = 1000;

/** Names near the chart's side edges run inwards, so they are not cut off. */
const anchor = (x: number, half: number): "start" | "middle" | "end" => (x > half * 0.7 ? "end" : x < -half * 0.7 ? "start" : "middle");

const points = (ps: readonly P[]): string => ps.map((p) => `${p.x.toFixed(0)},${(-p.z).toFixed(0)}`).join(" ");
/** Closed loops as one SVG path (M … Z per loop). */
const path = (loops: readonly (readonly P[])[]): string => loops.map((l) => `M${points(l)}Z`).join("");

/**
 * The sea chart: the mainland's coast and the islands from above, north up, as a chart of the period (land washed in,
 * the shallows dotted, a kilometre grid, a compass rose), with the ports, forts, wrecks and ships
 * in hand and the crew's course. Under simple steering a tap on the water sets a course there.
 * SVG in world metres (y = -z), so the chart scales with the screen; data from the app's chart
 * presenter (Presentation Model), the game paused behind it as behind the menu.
 */
export const SeaChart = ({ intents, settings }: { intents: ChartIntents; settings: SettingsIntents }) => {
  const chart = useHud((h) => h.chart);
  const lang = useHud((h) => h.language);
  const steering = useHud((h) => h.steering);
  const t = (k: TextKey) => text(lang, k);
  if (!chart) return null;
  const h = chart.half;
  const plot = steering === "simple";
  const onTap = (e: PointerEvent<SVGSVGElement>) => {
    if (!plot) return;
    const m = e.currentTarget.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    intents.sailTo(p.x, -p.y);
  };
  const grid: number[] = [];
  for (let g = -h + GRID; g < h; g += GRID) grid.push(g);
  const size = h / 40;
  return (
    <div className="menu-screen" data-testid="chart">
      <div className="panel chart">
        <svg viewBox={`${-h} ${-h} ${2 * h} ${2 * h}`} onPointerDown={onTap} data-testid="chart-map">
          <defs>
            <radialGradient id="chart-paper">
              <stop offset="0.55" stopColor="#dccaa3" />
              <stop offset="1" stopColor="#b9a074" />
            </radialGradient>
          </defs>
          <rect x={-h} y={-h} width={2 * h} height={2 * h} fill="url(#chart-paper)" />
          {grid.map((g) => (
            <g key={g} className="chart-grid">
              <line x1={g} y1={-h} x2={g} y2={h} />
              <line x1={-h} y1={g} x2={h} y2={g} />
            </g>
          ))}
          <path d={path(chart.shoals)} className="chart-shoal" fillRule="evenodd" />
          <path d={path(chart.land)} className="chart-land" fillRule="evenodd" />
          {chart.route.length > 1 && <polyline points={points(chart.route)} className="chart-route" />}
          {chart.goal && <circle cx={chart.goal.x} cy={-chart.goal.z} r={size * 1.6} className="chart-goal" />}
          {chart.wrecks.map((w, i) => (
            <path key={`w${i}`} d={`M${w.x - size} ${-w.z - size}L${w.x + size} ${-w.z + size}M${w.x + size} ${-w.z - size}L${w.x - size} ${-w.z + size}`} className={w.salvaged ? "chart-wreck done" : "chart-wreck"} />
          ))}
          {chart.forts.map((f, i) => (
            <rect key={`f${i}`} x={f.x - size} y={-f.z - size} width={size * 2} height={size * 2} className={f.hostile ? "chart-fort hostile" : "chart-fort"} />
          ))}
          {chart.ports.map((p, i) => (
            <g key={`p${i}`} className={p.hostile ? "chart-port hostile" : "chart-port"}>
              <circle cx={p.x} cy={-p.z} r={size * 0.9} />
              <text x={p.x} y={-p.z - size * 1.6} fontSize={size * 2.2} textAnchor={anchor(p.x, h)}>{p.name}</text>
            </g>
          ))}
          {chart.ships.map((s, i) => (
            <path
              key={`v${i}`}
              d={`M0 ${-size * 1.6}L${size} ${size * 1.2}L0 ${size * 0.5}L${-size} ${size * 1.2}Z`}
              transform={`translate(${s.x} ${-s.z}) rotate(${(s.heading * 180) / Math.PI}) scale(${s.kind === "player" ? 1.5 : 1})`}
              className={`chart-ship ${s.kind}`}
            />
          ))}
          <g className="chart-rose" transform={`translate(${h - size * 6} ${-h + size * 6})`}>
            <circle r={size * 4} />
            <path d={`M0 ${-size * 4}L${size} 0L0 ${size * 4}L${-size} 0Z`} />
            <text y={-size * 4.6} fontSize={size * 2.6}>N</text>
          </g>
        </svg>
        <div className="chart-side">
          <div className="title">{t("chart.title")}</div>
          <div className="chart-legend">
            <span><i className="key player" />{t("chart.you")}</span>
            <span><i className="key hostile" />{t("chart.hostile")}</span>
            <span><i className="key port" />{t("chart.ports")}</span>
            <span><i className="key fort" />{t("chart.forts")}</span>
            <span><i className="key wreck">✕</i>{t("chart.wrecks")}</span>
          </div>
          <small>{t(plot ? "chart.tap" : "chart.view")}</small>
          <button className="wide" onPointerDown={() => settings.showMenu("main")} data-testid="chart-back">{t("menu.back")}</button>
          <button className="wide" onPointerDown={() => settings.showMenu(null)} data-testid="chart-close">{t("menu.resume")}</button>
        </div>
      </div>
    </div>
  );
};
