import { describe, expect, it } from "vitest";
import { STEP } from "@broadside/sim";
import { GameSession } from "../src/game-session";
import { COURSE_SPACING, MAX_POINTS, bindCourseGestures, thinCourse } from "../src/controllers/course-gestures";
import { presentCourse } from "../src/presenters/course-presenter";
import { type Tappable, attackDrawn, orderFor, tappedAt } from "../src/controllers/tap-targets";

describe("simple steering in the app", () => {
  it("thins a drawn line to points some metres apart, keeping its ends", () => {
    const line = Array.from({ length: 200 }, (_, i) => ({ x: i * 2, z: Math.sin(i * 0.05) * 30 }));
    const course = thinCourse(line);
    expect(course[0]).toEqual(line[0]);
    expect(course[course.length - 1]).toEqual(line[line.length - 1]);
    expect(course.length).toBeLessThanOrEqual(MAX_POINTS);
    for (let i = 1; i < course.length - 2; i++) expect(Math.hypot(course[i]!.x - course[i - 1]!.x, course[i]!.z - course[i - 1]!.z)).toBeGreaterThanOrEqual(COURSE_SPACING);
  });

  it("sends a tapped point and shows the route with its destination ring", () => {
    const s = new GameSession({ seed: 1 });
    s.advance(1);
    const me = s.sim.byId(s.playerId)!;
    const to = { x: me.body!.pos.x + 300, z: me.body!.pos.z + 300 };
    s.helm.navigate([to], false);
    s.advance(STEP * 2);
    const c = presentCourse(s.sim, s.playerId);
    expect(c.path).toHaveLength(2);
    expect(c.goal).toMatchObject({ ...to, kind: "go" });
    // The helm takes the wheel back.
    s.helm.steer(1);
    s.advance(STEP * 2);
    s.helm.steer(0);
    expect(presentCourse(s.sim, s.playerId).path).toHaveLength(0);
  });

  it("tells a tap from a drawn line on the canvas", () => {
    const listeners = new Map<string, (e: PointerEvent) => void>();
    const canvas = { addEventListener: (t: string, f: (e: PointerEvent) => void) => listeners.set(t, f) } as unknown as HTMLElement;
    const taps: { x: number; y: number }[] = [];
    const drawn: (readonly { x: number; z: number }[])[] = [];
    const longs: { x: number; y: number }[] = [];
    let stroke = 0;
    bindCourseGestures(canvas, {
      enabled: () => true,
      pick: (x, y) => ({ x, z: y }),
      showStroke: (p) => (stroke = p.length),
      tap: (x, y) => taps.push({ x, y }),
      longPress: (x, y) => longs.push({ x, y }),
      draw: (route) => drawn.push(route),
    });
    const ev = (type: string, x: number, y: number, at: number) => listeners.get(type)!({ type, pointerId: 1, pointerType: "touch", button: 0, clientX: x, clientY: y, timeStamp: at } as PointerEvent);
    ev("pointerdown", 100, 100, 0);
    ev("pointerup", 103, 101, 120);
    expect(taps).toEqual([{ x: 103, y: 101 }]);
    // Held without moving: a long press, not a tap.
    ev("pointerdown", 50, 50, 500);
    ev("pointerup", 52, 50, 1200);
    expect(longs).toEqual([{ x: 52, y: 50 }]);
    expect(taps).toHaveLength(1);
    ev("pointerdown", 0, 0, 1000);
    for (let i = 1; i <= 50; i++) ev("pointermove", i * 4, 0, 1000 + i * 10);
    expect(stroke).toBeGreaterThan(10);
    ev("pointerup", 200, 0, 1600);
    expect(drawn).toHaveLength(1);
    expect(drawn[0]!.length).toBeGreaterThan(5);
    expect(stroke).toBe(0);
  });

  it("reads a tap by what it falls on: fight an enemy broadside, follow a friend, put into port, storm a fort, stop the ship, else sail there", () => {
    const at = { x: 0, z: 0 };
    const items: Tappable[] = [
      { kind: "self", id: 1, sx: 100, sy: 100, reach: 30, at },
      { kind: "ship", id: 2, sx: 300, sy: 100, reach: 30, at, hostile: true },
      { kind: "ship", id: 3, sx: 500, sy: 100, reach: 30, at, hostile: false },
      { kind: "port", id: 0, sx: 100, sy: 300, reach: 40, at },
      { kind: "fort", id: 9, sx: 300, sy: 300, reach: 60, at },
    ];
    const water = { x: 5, z: 6 };
    const tap = (x: number, y: number) => orderFor(tappedAt(x, y, items), water)?.kind;
    expect(tap(105, 98)).toBe("stop");
    expect(tap(310, 95)).toBe("engage");
    expect(tap(495, 105)).toBe("follow");
    expect(tap(120, 320)).toBe("dock");
    expect(tap(340, 300)).toBe("storm");
    expect(tap(700, 400)).toBe("go");
    expect(orderFor(null, null)).toBeNull();
    // A line drawn from the own ship onto an enemy is an attack; onto a friend or water, a course.
    expect(attackDrawn(tappedAt(100, 100, items), tappedAt(300, 100, items))?.kind).toBe("engage");
    expect(attackDrawn(tappedAt(100, 100, items), tappedAt(500, 100, items))).toBeNull();
    expect(attackDrawn(tappedAt(100, 100, items), null)).toBeNull();
    // Overlapping reaches: the one whose middle is nearer, for its size, wins.
    expect(tappedAt(300, 330, items)?.kind).toBe("fort");
  });
});
