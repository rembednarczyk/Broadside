import { pitchOf, rollOf, rotate, rotateInv, vec3 } from "@broadside/core";
import { type Simulation } from "@broadside/sim";
import { type ShipAudioState } from "@broadside/engine";

/**
 * What the player's ship sounds like aboard, read from the simulation (Presenter): her speed, the
 * wind over the deck, the load on her masts, canvas luffing, heel, the bow's plunge, sail being
 * handled, the turn, guns ready, water in the hold and the time of the watch. `distance` is how
 * far the listener (the camera) is from her: the ship's own sounds fade as the view pulls away.
 */
export const presentShipAudio = (sim: Simulation, playerId: number, distance: number, hours: number): ShipAudioState | null => {
  const me = sim.byId(playerId);
  if (!me?.body || !me.ship || me.ship.sinking) return null;
  const b = me.body;
  const s = me.ship;
  const env = sim.env;
  const local = rotateInv(b.rot, b.vel);
  const wx = Math.sin(env.windDirection) * env.windSpeed - b.vel.x;
  const wz = Math.cos(env.windDirection) * env.windSpeed - b.vel.z;
  let set = 0;
  let luffing = 0;
  s.sailFill.forEach((mast, i) => {
    if ((s.sailSet[i] ?? 0) < 0.05 || (s.mastHp[i] ?? 0) <= 0) return;
    for (const fill of mast) {
      set++;
      if (fill < 0.35) luffing++;
    }
  });
  // Vertical speed of the stem: the hull's own plus the pitching about the centre.
  const stem = rotate(b.rot, vec3(0, 0, s.model.def.hull.length / 2));
  const bow = b.vel.y + (b.angVel.z * stem.x - b.angVel.x * stem.z);
  return {
    aboard: Math.max(0.2, Math.min(1, 1.15 - distance / 220)),
    speed: Math.abs(local.z),
    wind: Math.hypot(wx, wz),
    load: Math.max(0, ...s.mastLoad),
    luff: set > 0 ? luffing / set : 0,
    heel: Math.abs(rollOf(b.rot)) + Math.abs(pitchOf(b.rot)) * 0.5,
    bow,
    canvas: s.sailSet.reduce((a, x) => a + x, 0),
    turn: Math.abs(b.angVel.y),
    ready: s.guns.filter((g) => g.reload === 0 && !g.dismounted).length,
    water: s.sections.reduce((a, x) => a + x.water, 0),
    halfHour: Math.floor(hours * 2),
    fire: Math.max(0, ...s.sections.map((x) => x.fire)),
  };
};
