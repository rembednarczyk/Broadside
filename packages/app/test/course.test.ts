import { describe, expect, it } from "vitest";
import { STEP } from "@broadside/sim";
import { GameSession } from "../src/game-session";
import { COURSE_SPACING, MAX_POINTS, bindCourseGestures, thinCourse } from "../src/controllers/course-gestures";
import { presentCourse } from "../src/presenters/course-presenter";

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
    s.navigate([to], false);
    s.advance(STEP * 2);
    const c = presentCourse(s.sim, s.playerId);
    expect(c.path).toHaveLength(2);
    expect(c.goal).toEqual(to);
    // The helm takes the wheel back.
    s.steer(1);
    s.advance(STEP * 2);
    s.steer(0);
    expect(presentCourse(s.sim, s.playerId).path).toHaveLength(0);
  });

  it("tells a tap from a drawn line on the canvas", () => {
    const listeners = new Map<string, (e: PointerEvent) => void>();
    const canvas = { addEventListener: (t: string, f: (e: PointerEvent) => void) => listeners.set(t, f) } as unknown as HTMLElement;
    const sent: { route: readonly { x: number; z: number }[]; hold: boolean }[] = [];
    let stroke = 0;
    bindCourseGestures(canvas, {
      enabled: () => true,
      pick: (x, y) => ({ x, z: y }),
      showStroke: (p) => (stroke = p.length),
      navigate: (route, hold) => sent.push({ route, hold }),
    });
    const ev = (type: string, x: number, y: number, at: number) => listeners.get(type)!({ type, pointerId: 1, pointerType: "touch", button: 0, clientX: x, clientY: y, timeStamp: at } as PointerEvent);
    ev("pointerdown", 100, 100, 0);
    ev("pointerup", 103, 101, 120);
    expect(sent[0]).toEqual({ route: [{ x: 103, z: 101 }], hold: false });
    ev("pointerdown", 0, 0, 1000);
    for (let i = 1; i <= 50; i++) ev("pointermove", i * 4, 0, 1000 + i * 10);
    expect(stroke).toBeGreaterThan(10);
    ev("pointerup", 200, 0, 1600);
    expect(sent[1]!.hold).toBe(true);
    expect(sent[1]!.route.length).toBeGreaterThan(5);
    expect(stroke).toBe(0);
  });
});
