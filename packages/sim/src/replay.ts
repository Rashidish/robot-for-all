// Headless replay (M4 spec FR-14, §13.5): run the robot calls a program made, in the same 20 ms
// steps, on the same world, with no screen, and get the same run report byte for byte.
//
// What this covers now: a recorded run (the robot calls and the step each arrived at) replays
// exactly, so a stored report can be checked against its call log and a run can be watched
// again. Re-running the learner's MicroPython itself on a server (competitions, §13.5) needs a
// headless MicroPython there: later, with the competitions work.
import { Sim, type SimOptions } from './sim';
import type { World } from './world';

/** One robot call, as the simulator profile sends it, and the step (20 ms) it arrived before. */
export interface CallRecord {
  step: number;
  call: 'motor_left' | 'motor_right' | 'stop' | 'pen';
  value: number;
}

/** Most calls kept for one run: a busy program (50 calls a second) for over 6 minutes. */
export const MAX_RECORDED_CALLS = 20_000;

/** Applies one recorded call to the robot. */
export function applyCall(sim: Sim, c: Pick<CallRecord, 'call' | 'value'>): void {
  if (c.call === 'motor_left') sim.setMotor('left', c.value);
  else if (c.call === 'motor_right') sim.setMotor('right', c.value);
  else if (c.call === 'stop') sim.stopMotors();
  else sim.setPen(c.value === 1);
}

/**
 * Replays a run. `endMs` is when the learner pressed Stop (for runs that didn't finish by
 * themselves); without it the replay runs until the challenge ends or the world's time limit.
 */
export function replay(
  world: World,
  calls: readonly CallRecord[],
  options: SimOptions & { endMs?: number; maxMs?: number } = {}
): Sim {
  const sim = new Sim(world, options);
  const maxMs = options.endMs ?? options.maxMs ?? world.timeLimitMs ?? 600_000;
  let next = 0;
  while (!sim.finished && sim.timeMs < maxMs) {
    const step = sim.timeMs / 20;
    while (next < calls.length && (calls[next]?.step ?? Infinity) <= step) {
      const c = calls[next];
      if (c) applyCall(sim, c);
      next++;
    }
    sim.step();
  }
  if (options.endMs !== undefined && !sim.finished) sim.stop();
  return sim;
}
