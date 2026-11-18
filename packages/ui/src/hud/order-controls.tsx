import { type OrderIntents } from "../intents";
import { useHud } from "../store/hud-store";
import { text } from "../i18n/catalog";

/** The cancel button of simple steering: drops the course or order the crew is carrying out. */
export const CancelCourse = ({ intents }: { intents: OrderIntents }) => {
  const active = useHud((h) => h.courseActive && h.steering === "simple");
  const lang = useHud((h) => h.language);
  if (!active) return null;
  return (
    <button className="cancel-course" onPointerDown={() => intents.cancelCourse()} data-testid="cancel-course">
      ✕ {text(lang, "order.cancel")}
    </button>
  );
};

/** Orders for a ship held down on: board, attack broadside to broadside, follow. */
export const ShipMenu = ({ intents }: { intents: OrderIntents }) => {
  const m = useHud((h) => h.shipMenu);
  const lang = useHud((h) => h.language);
  if (!m) return null;
  const pick = (f: (t: number) => void) => () => {
    f(m.target);
    intents.closeMenu();
  };
  return (
    <div className="panel ship-menu" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }} data-testid="ship-menu">
      {m.hostile && <button onPointerDown={pick(intents.engage)} data-testid="order-engage">{text(lang, "order.engage")}</button>}
      <button onPointerDown={pick(intents.board)} data-testid="order-board">{text(lang, "order.board")}</button>
      <button onPointerDown={pick(intents.follow)} data-testid="order-follow">{text(lang, "order.follow")}</button>
      <button onPointerDown={() => intents.closeMenu()} data-testid="order-close">{text(lang, "order.close")}</button>
    </div>
  );
};
