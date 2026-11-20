import { describe, expect, it } from "vitest";
import { nameWidth, placeLabels } from "../src/hud/chart-labels";

const box = (l: { x: number; y: number; anchor: string }, name: string, font: number) => {
  const w = nameWidth(name, font);
  const x0 = l.anchor === "middle" ? l.x - w / 2 : l.anchor === "start" ? l.x : l.x - w;
  return { x0, y0: l.y - font * 0.8, x1: x0 + w, y1: l.y + font * 0.2 };
};

describe("chart labels", () => {
  it("puts a lone name above its mark", () => {
    const [l] = placeLabels([{ x: 0, y: 0, name: "Tortue" }], 200, 150, 4000);
    expect(l).toEqual({ x: 0, y: -150, anchor: "middle" });
  });

  it("keeps the names of close ports apart", () => {
    const marks = [
      { x: 0, y: 0, name: "Kingsbay" },
      { x: 120, y: 60, name: "Cala Negra" },
      { x: -80, y: 140, name: "Mercy Harbour" },
    ];
    const ls = placeLabels(marks, 200, 150, 4000);
    const boxes = ls.map((l, i) => box(l, marks[i]!.name, 200));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        expect(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1, `${marks[i]!.name} / ${marks[j]!.name}`).toBe(false);
      }
    }
  });

  it("keeps names inside the chart at its edges", () => {
    const [l] = placeLabels([{ x: 3950, y: -3950, name: "Port Saint-Ange" }], 200, 150, 4000);
    const b = box(l!, "Port Saint-Ange", 200);
    expect(b.x1).toBeLessThanOrEqual(4000);
    expect(b.y0).toBeGreaterThanOrEqual(-4000);
  });
});
