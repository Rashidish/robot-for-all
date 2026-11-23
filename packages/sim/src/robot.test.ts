import { describe, expect, it } from 'vitest';
import { buildWorld } from './world';
import { runScripted, Sim } from './sim';
import { kinematicStep, TOP_SPEED_MM_S } from './robot';

const open = buildWorld({
  id: 'open',
  version: 1,
  challenge: null,
  size: { w: 4000, h: 4000 },
  start: { x: 2000, y: 2000, heading: 0 }
});

describe('kinematics', () => {
  it('forward at 100 % for 1 s moves the expected distance (± 5 %)', () => {
    const sim = runScripted(
      open,
      (r) => {
        r.setMotor('left', 100);
        r.setMotor('right', 100);
      },
      { maxMs: 1000 }
    );
    const moved = sim.pose.x - 2000;
    expect(Math.abs(moved - TOP_SPEED_MM_S) / TOP_SPEED_MM_S).toBeLessThan(0.05);
    expect(sim.pose.y).toBeCloseTo(2000, 6);
    expect(sim.report('test').distance).toBeCloseTo(0.2, 2);
  });

  it('turns right (clockwise) when the left wheel is faster, and left when the right is faster', () => {
    const right = kinematicStep({ x: 0, y: 0, heading: 0 }, 100, 50, 0.5);
    const left = kinematicStep({ x: 0, y: 0, heading: 0 }, 50, 100, 0.5);
    expect(right.heading).toBeGreaterThan(0);
    expect(right.y).toBeGreaterThan(0); // y down: clockwise curves towards the bottom of the screen
    expect(left.heading).toBeLessThan(0);
    expect(left.y).toBeLessThan(0);
  });

  it('spins on the spot with the wheels in opposite directions', () => {
    const s = kinematicStep({ x: 10, y: 10, heading: 0 }, 100, -100, 0.1);
    expect(s.x).toBeCloseTo(10, 9);
    expect(s.y).toBeCloseTo(10, 9);
    expect(s.heading).toBeCloseTo(0.2, 9);
  });

  it('a one-motor robot drives both wheels from the left motor and ignores the right', () => {
    const sim = new Sim(open, { oneMotor: true });
    sim.setMotor('left', 100);
    sim.setMotor('right', -100);
    sim.advance(1000);
    expect(sim.pose.x - 2000).toBeCloseTo(TOP_SPEED_MM_S, 0);
    expect(sim.report('p').oneMotor).toBe(true);
  });

  it('clamps speeds to −100…100 and treats bad numbers as stop', () => {
    const sim = new Sim(open);
    sim.setMotor('left', 500);
    sim.setMotor('right', Number.NaN);
    expect(sim.motorSpeeds).toEqual({ left: 100, right: 0 });
  });

  it('moves at most 1 s per advance call, in fixed 20 ms steps', () => {
    const sim = new Sim(open);
    sim.setMotor('left', 100);
    sim.setMotor('right', 100);
    sim.advance(60_000); // a phone waking from sleep
    expect(sim.timeMs).toBe(1000);
    sim.advance(10);
    sim.advance(10);
    expect(sim.timeMs).toBe(1020);
  });
});
