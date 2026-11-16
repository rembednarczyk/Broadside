import { type HelmIntents } from "../intents";

/** Two hold-to-turn buttons for touch steering; release holds the new course. */
export const HelmPad = ({ intents }: { intents: HelmIntents }) => {
  const hold = (d: -1 | 1) => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      intents.steer(d);
    },
    onPointerUp: () => intents.steer(0),
    onPointerCancel: () => intents.steer(0),
  });
  return (
    <div className="helm-pad">
      <button className="helm" data-testid="helm-port" {...hold(-1)}>◀</button>
      <button className="helm" data-testid="helm-starboard" {...hold(1)}>▶</button>
    </div>
  );
};
