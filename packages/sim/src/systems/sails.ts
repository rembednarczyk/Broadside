import { DEG, type RigType, type Vec3, approach, rotate, rotateInv, sailForce, sailForceAt, vec3 } from "@broadside/core";
import { type System } from "./context";
import { applyForceAt, bodyToWorld, pointVelocity } from "../physics/rigid-body";
import { type ShipState, crewShare, setFactor } from "../ship/ship-state";
import { windAt } from "../environment/environment";
import { type MastModel } from "../ship/ship-model";

/**
 * Sail handling and sail forces. Setting or taking in sail takes time that grows with the sail
 * area and shrinks with the hands available and the rigging condition. Trimming takes time too:
 * the crew find the best chord for the apparent wind (sailForce), but the yards are braced round,
 * and the booms sheeted, at a rate (BRACE_RATE) that the hands and the rigging set, and the sail
 * pulls where its yard is now (sailForceAt). A ship that tacks has her yards aback for a while.
 * Each mast reports its force; a mast loaded past its strength is damaged and can go by the board.
 */
const HANDLING_RATE = 0.25;
/** Damage per second per unit of overload (force / strength - 1). */
const OVERLOAD_DAMAGE = 0.5;
/**
 * Game scale on sail drive (decyzje 16.11): real square riggers make 7-9 kn in a fresh breeze;
 * the game wants about 10-12 kn. Mast strength is scaled by the same factor.
 */
export const SAIL_GAIN = 1.6;

/**
 * How fast a full, well-found crew swings a yard or a boom (radians per second). Square yards are
 * braced round by the hands on the braces, about 12 s through their 70 degree range; a boom swings
 * on its sheet about three times as fast. Game scale: on real ships of the period a full tack of
 * all the yards took the better part of a minute.
 */
export const BRACE_RATE: Readonly<Record<RigType, number>> = { square: 6 * DEG, foreAft: 18 * DEG };

const studdingOf = (m: MastModel): boolean => m.sails.some((s) => s.studding);

const handleSails = (s: ShipState, dt: number): void => {
  const handsShare = Math.max(0.15, crewShare(s)) * (0.35 + 0.65 * s.rigging);
  s.model.masts.forEach((m, i) => {
    if (s.mastHp[i]! <= 0) {
      s.sailSet[i] = 0;
      return;
    }
    const target = setFactor(s.sailTarget[i]!, studdingOf(m));
    const areaFactor = 400 / (400 + m.sails.reduce((a, x) => a + x.area, 0));
    s.sailSet[i] = approach(s.sailSet[i]!, target, HANDLING_RATE * handsShare * (0.5 + areaFactor) * dt);
  });
};

export const sailSystem: System = (ctx, dt) => {
  for (const e of ctx.world.with("ship", "body")) {
    const s = e.ship;
    const b = e.body;
    if (s.sinking) continue;
    handleSails(s, dt);
    const trim = Math.min(1, crewShare(s) * 1.2) * (0.4 + 0.6 * s.rigging);
    const hands = Math.max(0.15, crewShare(s)) * (0.35 + 0.65 * s.rigging);
    s.model.masts.forEach((m, i) => {
      if (s.mastHp[i]! <= 0 || s.sailSet[i]! <= 0) return;
      let total: Vec3 = vec3(0, 0, 0);
      m.sails.forEach((sail, j) => {
        const ceWorld = bodyToWorld(b, sail.ce);
        const tw = windAt(ctx.env, ceWorld.y, ceWorld.x, ceWorld.z);
        const pv = pointVelocity(b, ceWorld);
        const local = rotateInv(b.rot, vec3(tw.x - pv.x, 0, tw.z - pv.z));
        const area = sail.area * s.sailSet[i]! * (0.3 + 0.7 * s.sailCloth[i]!);
        // The trim the crew want, and the yards swung towards it as fast as the hands can brace them.
        const want = sailForce(sail.rig, area, local.x, local.z, trim).chord;
        const chord = approach(s.sailChord[i]![j]!, want, BRACE_RATE[sail.rig] * hands * dt);
        const f = sailForceAt(sail.rig, area, local.x, local.z, chord, trim);
        const world = rotate(b.rot, vec3(f.fx * SAIL_GAIN, 0, f.fz * SAIL_GAIN));
        applyForceAt(b, world, ceWorld);
        total = vec3(total.x + world.x, total.y + world.y, total.z + world.z);
        const q = 0.5 * 1.225 * (local.x * local.x + local.z * local.z);
        s.sailChord[i]![j] = f.chord;
        s.sailFill[i]![j] = area > 0 && q > 0 ? Math.hypot(f.fx, f.fz) / (q * area) : 0;
      });
      const load = Math.hypot(total.x, total.z) / (m.strength * SAIL_GAIN);
      s.mastLoad[i] = load;
      if (load > 1) s.mastHp[i] = Math.max(0, s.mastHp[i]! - (load - 1) * OVERLOAD_DAMAGE * s.model.def.mastHp * dt * 0.1);
      if (s.mastHp[i]! <= 0) {
        s.sailSet[i] = 0;
        ctx.events.push({ type: "mastFell", ship: e.id, mast: i });
      }
    });
  }
};
