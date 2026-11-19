/**
 * Frame pacing under a cap (the 30 fps option: steadier frames and less heat on phones): the
 * display's refreshes (requestAnimationFrame) that come before the next frame is due are skipped,
 * as console games hold 30 fps on a 60 Hz screen by presenting every second refresh. The due time
 * advances by whole intervals, so 60 Hz gives every second refresh and 120 Hz every fourth; a
 * refresh up to SLACK ms early still counts (refresh times jitter), and after a stall the schedule
 * restarts from now instead of rushing frames to catch up. Cap 0: every refresh is drawn.
 */
const SLACK = 2;

export class FramePacer {
  private next = 0;
  constructor(public cap: number) {}

  /** Whether to draw at the refresh at `now` (ms). */
  due(now: number): boolean {
    if (this.cap <= 0) return true;
    if (now < this.next - SLACK) return false;
    const interval = 1000 / this.cap;
    this.next = now - this.next > interval ? now + interval : this.next + interval;
    return true;
  }
}

/** A setting kept on this device (null where storage is unavailable, e.g. private mode). */
export const readSetting = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeSetting = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the choice lasts for this run only.
  }
};
