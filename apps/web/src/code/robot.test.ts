// M4 spec v0.5 acceptance: "The same program gives a byte-identical run report with two different
// robot profiles selected." On screen every board uses the simulator profile, so the on-screen
// files, and so the robot world's run report, can't depend on the board (ADR-0008, FR-21).
import { describe, expect, it } from 'vitest';
import darkTunnel from '../../../../content/worlds/dark-tunnel.json';
import { filesFor, toPython } from '../../../../packages/blocks/src/index';
import { buildProfile } from '../../../../packages/robots/src/index';
import { buildWorld, runScripted, type Driver } from '../../../../packages/sim/src/index';
import { DEFAULT_PROFILE, modulesFor } from './robot';

// A second board with different pins, and a learner's "flip a motor" fix.
const other = buildProfile({
  ...structuredClone(basicSpec()),
  id: 'other-board',
  motors: {
    method: 'pins',
    left: { forward: 13, backward: 14 },
    right: { forward: 15, backward: 16 }
  },
  usedPins: [13, 14, 15, 16],
  freePins: [0, 1, 2, 8, 12]
});

function basicSpec() {
  return {
    id: DEFAULT_PROFILE.id,
    version: DEFAULT_PROFILE.version,
    name: DEFAULT_PROFILE.name,
    picture: DEFAULT_PROFILE.picture,
    motors: DEFAULT_PROFILE.motors,
    usedPins: DEFAULT_PROFILE.usedPins,
    freePins: DEFAULT_PROFILE.freePins,
    lineDark: DEFAULT_PROFILE.lineDark,
    detect: DEFAULT_PROFILE.detect,
    status: DEFAULT_PROFILE.status,
    testedBy: DEFAULT_PROFILE.testedBy
  };
}

const program = toPython({
  version: 1,
  handlers: [
    {
      type: 'forever',
      body: [
        {
          type: 'if',
          cond: {
            type: 'compare',
            op: 'gt',
            a: { type: 'light_level' },
            b: { type: 'number', value: 50 }
          },
          then: [{ type: 'motor', action: 'forward' }],
          else: [{ type: 'motor', action: 'stop' }]
        }
      ]
    }
  ]
});

describe('robot profiles on screen and on a real micro:bit', () => {
  it('a real micro:bit gets a module made for its board', () => {
    expect(modulesFor('board', DEFAULT_PROFILE).rfa_robot).not.toBe(
      modulesFor('board', other).rfa_robot
    );
    expect(modulesFor('board', other, { flipLeft: true }).rfa_robot).toContain(
      '"left": (pin14, pin13)'
    );
  });

  it('the on-screen files are byte-identical whichever board is selected', () => {
    const a = filesFor(program, modulesFor('screen', DEFAULT_PROFILE));
    const b = filesFor(program, modulesFor('screen', other));
    expect(Object.keys(a)).toEqual(['main.py', 'rfa_robot.py']);
    expect(a).toEqual(b);
    expect(a['rfa_robot.py']).not.toMatch(/\bpin\d/);
  });

  it('the same program gives a byte-identical run report with two different profiles', () => {
    // The robot world only sees robot calls; here they come from the same program logic.
    const driver: Driver = (r) => (r.lightLevel() > 50 ? r.setMotor('left', 100) : r.stopMotors());
    const report = (oneMotor: boolean) =>
      JSON.stringify(runScripted(buildWorld(darkTunnel), driver, { oneMotor }).report('p'));
    const forProfile = (p: typeof DEFAULT_PROFILE) => report(p.motors.right === null);
    expect(forProfile(DEFAULT_PROFILE)).toBe(forProfile(other));
  });
});
