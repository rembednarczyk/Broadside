import { useEffect, useRef, useState } from "react";
import { type HelmIntents } from "../intents";
import { useHud } from "../store/hud-store";
import { text } from "../i18n/catalog";

/** Rudder dead zone and the throws that shift a gear (a share of the pad's radius). */
const DEAD = 0.12;
const SHIFT = 0.6;
const RELEASE = 0.3;
/** Held up or down past the shift, the stick shifts on a gear every this many milliseconds. */
const REPEAT_MS = 650;

/**
 * Assisted sailing's touch pad (a virtual thumbstick, the usual control of touch action games):
 * left and right put the helm over as far as the thumb goes and back amidships on release; a flick
 * up or down shifts one gear of sail (furled, reefed, battle, full, studding sails, and astern
 * below furled), and held there goes on shifting a gear every REPEAT_MS; only a throw more up or
 * down than sideways shifts (a hard turn with the thumb a little high changed gear by accident,
 * beta test 19.11). The helm comes amidships when the pad goes away under a thumb (the menu
 * opened, the HUD hidden: the thumb's release never reaches it).
 */
export const DrivePad = ({ intents }: { intents: HelmIntents }) => {
  const astern = useHud((h) => h.astern);
  const lang = useHud((h) => h.language);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pad = useRef<HTMLDivElement>(null);
  const latch = useRef(0);
  const rudder = useRef(0);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRepeat = () => {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = null;
  };
  useEffect(
    () => () => {
      stopRepeat();
      if (rudder.current !== 0) intents.rudder(0);
    },
    [],
  );
  const move = (e: React.PointerEvent) => {
    const r = pad.current?.getBoundingClientRect();
    if (!r) return;
    const radius = r.width / 2;
    let x = (e.clientX - r.left - radius) / radius;
    let y = -(e.clientY - r.top - radius) / radius;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    setKnob({ x, y });
    const helm = Math.abs(x) < DEAD ? 0 : Math.round(((Math.abs(x) - DEAD) / (1 - DEAD)) * Math.sign(x) * 20) / 20;
    if (helm !== rudder.current) {
      rudder.current = helm;
      intents.rudder(helm);
    }
    if (latch.current === 0 && Math.abs(y) > SHIFT && Math.abs(y) > Math.abs(x)) {
      const step = y > 0 ? 1 : -1;
      latch.current = step;
      intents.gear(step);
      stopRepeat();
      repeat.current = setInterval(() => intents.gear(step), REPEAT_MS);
    } else if (Math.abs(y) < RELEASE) {
      latch.current = 0;
      stopRepeat();
    }
  };
  const end = () => {
    stopRepeat();
    setKnob({ x: 0, y: 0 });
    latch.current = 0;
    rudder.current = 0;
    intents.rudder(0);
  };
  return (
    <div
      className="drive-pad"
      ref={pad}
      data-testid="drive-pad"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => e.buttons !== 0 && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span className="drive-arrow up">▲</span>
      <span className="drive-arrow down">▼</span>
      <span className="drive-arrow left">◀</span>
      <span className="drive-arrow right">▶</span>
      <span className="drive-knob" style={{ transform: `translate(${knob.x * 50}%, ${-knob.y * 50}%)` }} />
      {astern && <span className="drive-astern">{text(lang, "drive.astern")}</span>}
    </div>
  );
};
