/**
 * Placing the ports' names on the sea chart so none covers another or a port's mark: each name
 * tries the places round its mark in turn (above, below, right, left, then the corners) and takes
 * the first whose box is clear of the names placed before it and of every mark, then the same
 * places twice as far out (greedy
 * point-feature labelling with a fixed set of candidate positions, Christensen, Marks and Shieber,
 * "An Empirical Study of Algorithms for Point-Feature Label Placement", 1995; the greedy pass,
 * not their simulated annealing: a chart has a score of names). A name with no clear place takes
 * the one it overlaps least. Names stay inside the chart. Chart units (SVG, y down).
 */
export interface LabelBox {
  /** Text anchor point and alignment for SVG. */
  readonly x: number;
  readonly y: number;
  readonly anchor: "start" | "middle" | "end";
}

type Box = { x0: number; y0: number; x1: number; y1: number };

/** Width of a name in chart units at a font size (the display face's capitals, about 0.72 em each with the spacing). */
export const nameWidth = (name: string, font: number): number => name.length * font * 0.72;

const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Places for `marks` (x, y and name), `font` high, `gap` off the mark, inside ±`half`. */
export const placeLabels = (marks: readonly { readonly x: number; readonly y: number; readonly name: string }[], font: number, gap: number, half: number): LabelBox[] => {
  const placed: Box[] = [];
  const dots: Box[] = marks.map((m) => ({ x0: m.x - gap * 0.6, y0: m.y - gap * 0.6, x1: m.x + gap * 0.6, y1: m.y + gap * 0.6 }));
  return marks.map((m) => {
    const w = nameWidth(m.name, font);
    // Candidates: anchor point, alignment, and the box they give (baseline at y).
    const near: { x: number; y: number; anchor: LabelBox["anchor"] }[] = [
      { x: m.x, y: m.y - gap, anchor: "middle" },
      { x: m.x, y: m.y + gap + font * 0.8, anchor: "middle" },
      { x: m.x + gap, y: m.y + font * 0.35, anchor: "start" },
      { x: m.x - gap, y: m.y + font * 0.35, anchor: "end" },
      { x: m.x + gap * 0.7, y: m.y - gap * 0.7, anchor: "start" },
      { x: m.x - gap * 0.7, y: m.y - gap * 0.7, anchor: "end" },
      { x: m.x + gap * 0.7, y: m.y + gap * 0.7 + font * 0.8, anchor: "start" },
      { x: m.x - gap * 0.7, y: m.y + gap * 0.7 + font * 0.8, anchor: "end" },
    ];
    // The same places twice as far out (a crowded harbour's names stand off a little).
    const options = [...near, ...near.map((o) => ({ ...o, x: m.x + (o.x - m.x) * 2, y: m.y + (o.y - m.y) * 2 }))];
    const boxOf = (o: (typeof options)[number]): Box => {
      const x0 = o.anchor === "middle" ? o.x - w / 2 : o.anchor === "start" ? o.x : o.x - w;
      return { x0, y0: o.y - font * 0.8, x1: x0 + w, y1: o.y + font * 0.2 };
    };
    const inside = (b: Box) => b.x0 >= -half && b.x1 <= half && b.y0 >= -half && b.y1 <= half;
    const clear = (b: Box) => inside(b) && !placed.some((p) => overlaps(p, b)) && !dots.some((d) => overlaps(d, b));
    const crowd = (b: Box) => placed.filter((p) => overlaps(p, b)).length + dots.filter((d) => overlaps(d, b)).length;
    const fallback = options.filter((o) => inside(boxOf(o))).sort((a, b) => crowd(boxOf(a)) - crowd(boxOf(b)))[0];
    const pick = options.find((o) => clear(boxOf(o))) ?? fallback ?? options[0]!;
    placed.push(boxOf(pick));
    return { x: pick.x, y: pick.y, anchor: pick.anchor };
  });
};
