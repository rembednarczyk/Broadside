import { describe, expect, it } from "vitest";
import { shipModel } from "@broadside/sim";
import { Matrix, Quaternion, Vector3 } from "../src/babylon";
import { aloftPose, aloftRoute, aloftSeconds, type ClimbClip } from "../src/renderer/crew-aloft";
import { shroudLadders } from "../src/renderer/rig-layout";
import { rigPlan } from "../src/renderer/rig-plan";

// The travel of the baked clips (crew-anim.bin header): a ladder cycle and the climb over the rim.
const climb: ClimbClip = { seconds: 0.767, frames: 11, rise: 0.495, advance: -0.054, reach: 0.281 };
const mount: ClimbClip = { seconds: 4, frames: 61, rise: 1.556, advance: 1.452, reach: 0.922 };

const route = () => {
  const model = shipModel("galleon");
  const ladder = shroudLadders(model).find((l) => l.side === 1)!;
  const mz = model.def.masts[ladder.mast]!.z;
  const top = rigPlan(model.def).tops.find((t) => Math.abs(t.z - mz) < 1)!;
  return aloftRoute(ladder, [2, 1.5, mz], top.y + 0.1, top.z);
};

describe("a topman's way aloft", () => {
  it("starts on deck, climbs the ratlines steadily and ends standing in the top", () => {
    const r = route();
    const total = aloftSeconds(r, climb, mount);
    // At the ladder's pace (0.65 m/s) a dozen metres take about twenty seconds.
    expect(total).toBeGreaterThan(10);
    expect(total).toBeLessThan(40);
    expect(aloftPose(r, climb, mount, 0).at).toEqual(r.deck);
    const end = aloftPose(r, climb, mount, total);
    expect(end.at).toEqual(r.top);
    expect(end.lean).toBe(0);
    let last = -Infinity;
    for (let u = 0.1; u < total - mount.seconds; u += 0.5) {
      const p = aloftPose(r, climb, mount, u);
      expect(p.clip).toBe("climb");
      expect(p.frame).toBeGreaterThanOrEqual(0);
      expect(p.frame).toBeLessThan(climb.frames);
      expect(p.at[1]).toBeGreaterThan(last);
      last = p.at[1];
    }
    const over = aloftPose(r, climb, mount, total - mount.seconds / 2);
    expect(over.clip).toBe("mount");
    expect(over.frame).toBeLessThan(mount.frames);
  });

  it("faces in board, leans with the shroud and stands outboard of the ratlines", () => {
    const r = route();
    const p = aloftPose(r, climb, mount, 3);
    // His up, turned as the view turns him (yaw, then lean), runs along the shroud.
    const m = Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(p.yaw, p.lean, 0), Vector3.Zero());
    const up = Vector3.TransformNormal(new Vector3(0, 1, 0), m);
    const along = new Vector3(r.head[0] - r.foot[0], r.head[1] - r.foot[1], r.head[2] - r.foot[2]).normalize();
    expect(Vector3.Dot(up, along)).toBeGreaterThan(0.999);
    const forward = Vector3.TransformNormal(new Vector3(0, 0, 1), m);
    expect(forward.x).toBeLessThan(0);
    // His feet are further out from the middle line than the ratlines at his height.
    const k = (p.at[1] - r.foot[1]) / (r.head[1] - r.foot[1]);
    expect(p.at[0]).toBeGreaterThan(r.foot[0] + (r.head[0] - r.foot[0]) * k);
  });
});
