/// <reference types="node" />
import { expect, it } from "vitest";
import { type DomainEvent, angleOffWind } from "@broadside/core";
import { STEP, createCaptain, portOwner } from "@broadside/sim";
import { GameSession } from "../src/game-session";

/**
 * Playtest of the core loop on autopilot: an AI captain takes the player's helm, sails to the
 * nearest friendly port, stops, takes the contract on offer and carries it out (the AI fights what
 * the contract names when it comes in sight). Reports the timeline; fails on a blocker: no seed
 * reaches a port and takes a contract, or a contract taken never ends (neither paid nor failed
 * for a reason). Whether the autopilot wins its contract is reported, not required: an escort
 * whose charge strikes to an attacker has run its course (decyzje 17.11, brasowanie).
 * PLAYTEST_SEEDS=3,7,11,... runs other seeds.
 */
const SEEDS = (process.env.PLAYTEST_SEEDS ?? "3,7,21").split(",").map(Number);

it("port, contract, pay: the core loop can be played through (report)", () => {
  let paid = 0;
  let taken = 0;
  let unfinished = 0;
  for (const seed of SEEDS) {
    const s = new GameSession({ seed });
    const sim = s.sim;
    const me = sim.byId(s.playerId)!;
    const b = () => me.body!.pos;
    const friendly = sim.ports.map((p, i) => ({ p, i })).filter(({ p, i }) => portOwner(sim.world, i, p) !== "pirates");
    // A captain picks a port he can fetch: not dead to windward (that means a long beat).
    const dist = (q: { p: { ax: number; az: number } }) => Math.hypot(q.p.ax - b().x, q.p.az - b().z);
    const fetchable = (q: { p: { ax: number; az: number } }) => angleOffWind(Math.atan2(q.p.ax - b().x, q.p.az - b().z), sim.env.windDirection) < 1.9;
    const port = [...friendly].sort((x, y) => dist(x) * (fetchable(x) ? 1 : 5) - dist(y) * (fetchable(y) ? 1 : 5))[0]!;
    // Components go through the world so its queries see them (miniplex).
    sim.world.addComponent(me, "captain", createCaptain(port.p.ax, port.p.az, 220, "patrol"));
    const log: string[] = [];
    const events: DomainEvent[] = [];
    let t = 0;
    const tick = (seconds: number, until: () => boolean): boolean => {
      for (let i = 0; i < seconds * 60; i++) {
        s.advance(STEP);
        t += STEP;
        events.push(...sim.drainEvents());
        if (until()) return true;
      }
      return false;
    };
    // Far out the AI captain sails; inside 350 m the player takes the helm like a human would:
    // shortened sail, straight for the anchorage.
    const near = () => {
      const d = Math.hypot(port.p.ax - b().x, port.p.az - b().z);
      if (me.captain) {
        me.captain.wx = port.p.ax;
        me.captain.wz = port.p.az;
        if (d < 350) {
          sim.world.removeComponent(me, "captain");
          sim.command({ type: "sails", ship: me.id, mast: "all", level: 1 });
        }
      } else if (Math.floor(t * 2) !== Math.floor((t - STEP) * 2)) {
        sim.command({ type: "course", ship: me.id, heading: Math.atan2(port.p.ax - b().x, port.p.az - b().z) });
        if (d > 450) sim.world.addComponent(me, "captain", createCaptain(port.p.ax, port.p.az, 220, "patrol"));
      }
      return d < 150;
    };
    const reached = tick(20 * 60, near);
    log.push(`${reached ? "reached" : "did not reach"} ${port.p.name} at ${(t / 60).toFixed(1)} min`);
    if (reached) {
      // Heave to alongside: no captain, sails furled and the anchor let go (as a player would: running
      // in she would carry her way past the port), until she lies still.
      if (me.captain) sim.world.removeComponent(me, "captain");
      sim.command({ type: "sails", ship: me.id, mast: "all", level: 0 });
      sim.command({ type: "anchor", ship: me.id, down: true });
      tick(90, () => Math.hypot(me.body!.vel.x, me.body!.vel.z) < 1.5);
      s.takeContract(port.i);
      tick(1, () => sim.jobs.active !== null);
      sim.command({ type: "anchor", ship: me.id, down: false });
      const job = sim.jobs.active;
      log.push(job ? `took a ${job.offer.kind} (${job.offer.classId}, ${job.offer.reward} gold)` : "no contract taken");
      const fail = (): string => {
        const e = events.find((x) => x.type === "contractFailed");
        const tt = job ? sim.byId(job.target) : undefined;
        return e ? ` [target ${tt ? `${tt.ship!.sinking ? "sinking" : ""}${tt.ship!.struck ? "struck" : ""} crew ${tt.ship!.crew}` : "gone"}]` : "";
      };
      if (job) {
        taken++;
        const target = sim.byId(job.target);
        // Steer for the ship named in the contract (escorts keep station on her).
        sim.world.addComponent(me, "captain", { ...createCaptain(b().x, b().z, 200, "patrol"), leader: target && job.offer.kind === "escort" ? target.id : -1 });
        const gold = sim.purse.gold;
        tick(25 * 60, () => {
          const tt = sim.byId(job.target);
          if (tt && me.captain && job.offer.kind !== "escort") {
            me.captain.wx = tt.body!.pos.x;
            me.captain.wz = tt.body!.pos.z;
          }
          return sim.jobs.active === null;
        });
        const done = events.some((e) => e.type === "contractDone");
        if (done) paid++;
        if (sim.jobs.active !== null) unfinished++;
        log.push(`${done ? "fulfilled" : events.some((e) => e.type === "contractFailed") ? `failed${fail()}` : "unfinished"} at ${(t / 60).toFixed(1)} min, gold ${gold} -> ${sim.purse.gold}`);
      }
    }
    console.log(`seed ${seed}: ${log.join("; ")}`);
  }
  console.log(`contracts: ${taken} taken, ${paid} paid, ${unfinished} unfinished`);
  expect(taken, "a contract taken on autopilot").toBeGreaterThan(0);
  expect(unfinished, "contracts that never end").toBe(0);
});
