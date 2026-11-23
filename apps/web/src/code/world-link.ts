// The link between the on-screen micro:bit and the robot world (M4 spec §6.2, step 2).
// Robot calls from the micro:bit move the world's robot; the world pushes sensor answers back:
// line sensors and whiskers when they change and at least 10 times a second, the light level
// under the robot, and a "shake" when it bumps a wall. No DOM here, so it is unit-tested.
import {
  type RobotCall,
  SENSOR_NAMES,
  type SensorName
} from '../../../../packages/robots/src/index';
import {
  applyCall,
  buildWorld,
  type CallRecord,
  hashText,
  MAX_RECORDED_CALLS,
  type RunReport,
  Sim,
  type World
} from '../../../../packages/sim/src/index';

/** Sensor answers are sent at least this often, even when nothing changed (spec §6.2). */
export const PUSH_EVERY_MS = 100;

export interface Pushes {
  /** Line and whisker answers for the _rfa_sim module, when they changed or were due. */
  sensors?: Record<SensorName, number>;
  /** The micro:bit's light level under the robot, when it changed or was due. */
  light?: number;
  /** The robot bumped a wall in a "shake" world. */
  shake: boolean;
}

/** True if a program drives the right motor; if not, it is a one-motor cart (spec §2). */
export function usesRightMotor(mainPy: string): boolean {
  return /rfa_robot\.motor\(\s*["']right["']/.test(mainPy);
}

export class WorldLink {
  readonly sim: Sim;
  readonly programHash: string;
  private lastSensors = '';
  private lastLight = -1;
  private sinceSensors = PUSH_EVERY_MS;
  private sinceLight = PUSH_EVERY_MS;

  constructor(world: World, mainPy: string) {
    this.sim = new Sim(world, { oneMotor: !usesRightMotor(mainPy) });
    this.programHash = hashText(mainPy);
  }

  /** Every robot call and the step it arrived before, so the run can be replayed (FR-14). */
  readonly calls: CallRecord[] = [];

  /** A robot call from the on-screen micro:bit. */
  call(c: RobotCall): void {
    applyCall(this.sim, c);
    if (this.calls.length < MAX_RECORDED_CALLS) {
      this.calls.push({ step: this.sim.timeMs / 20, call: c.call, value: c.value });
    }
  }

  /** Moves the world on by real time `ms` and returns what to push into the micro:bit. */
  tick(ms: number): Pushes {
    this.sim.advance(ms);
    this.sinceSensors += ms;
    this.sinceLight += ms;
    const out: Pushes = { shake: this.sim.wasShaken() };

    const sensors = Object.fromEntries(
      SENSOR_NAMES.map((name) => {
        const [kind, side] = name.split('_') as ['line' | 'whisker', 'left' | 'right'];
        return [name, (kind === 'line' ? this.sim.line(side) : this.sim.whisker(side)) ? 1 : 0];
      })
    ) as Record<SensorName, number>;
    const key = JSON.stringify(sensors);
    if (key !== this.lastSensors || this.sinceSensors >= PUSH_EVERY_MS) {
      out.sensors = sensors;
      this.lastSensors = key;
      this.sinceSensors = 0;
    }

    const light = this.sim.lightLevel();
    if (light !== this.lastLight || this.sinceLight >= PUSH_EVERY_MS) {
      out.light = light;
      this.lastLight = light;
      this.sinceLight = 0;
    }
    return out;
  }

  report(): RunReport {
    return this.sim.report(this.programHash);
  }
}

/** All worlds and courses in content/worlds, checked (the build fails on a bad one). */
export function loadWorlds(specs: Record<string, unknown>): World[] {
  return Object.values(specs)
    .map((spec) => buildWorld(spec))
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

/** Launch worlds first, in lesson order, then the courses (spec §2, §14.5). */
const ORDER = [
  'open-floor',
  'dark-tunnel',
  'box-and-back',
  'follow-the-line',
  'simple-maze',
  'grid-map',
  'art-floor',
  'grid-delivery',
  'line-junction',
  'bump-maze',
  'line-maze',
  'rhino-patrol'
];

/** Run reports are kept on this device only, the latest per world (spec §2, §6.1, §7). */
export const REPORTS_KEY = 'rfa-run-reports-v1';

export function saveReport(
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  report: RunReport
): void {
  try {
    const all = JSON.parse(storage?.getItem(REPORTS_KEY) ?? '{}') as Record<string, RunReport>;
    all[report.worldId] = report;
    storage?.setItem(REPORTS_KEY, JSON.stringify(all));
  } catch {
    // Storage blocked or full: the run still counts on screen.
  }
}

export function loadReports(
  storage: Pick<Storage, 'getItem'> | undefined
): Record<string, RunReport> {
  try {
    const all = JSON.parse(storage?.getItem(REPORTS_KEY) ?? '{}') as unknown;
    return typeof all === 'object' && all !== null ? (all as Record<string, RunReport>) : {};
  } catch {
    return {};
  }
}

// --- Monitor and grid (M4 spec FR-11, FR-12) ------------------------------------------------

/** The values the Monitor lists, in order; each can also be drawn on the graph. */
export const MONITOR_VALUES = [
  'motor_left',
  'motor_right',
  'light',
  'line_left',
  'line_right',
  'whisker_left',
  'whisker_right',
  'pen'
] as const;
export type MonitorValue = (typeof MONITOR_VALUES)[number];

/** The Monitor redraws at most this often (spec §5: 5 times a second). */
export const MONITOR_EVERY_MS = 200;
/** The graph shows the last 10 seconds. */
export const GRAPH_SAMPLES = 10_000 / MONITOR_EVERY_MS;

/** A snapshot of the robot for the Monitor: speeds −100…100, light 0–255, sensors 0 or 1. */
export function monitorSample(sim: Sim): Record<MonitorValue, number> {
  const m = sim.motorSpeeds;
  const yes = (b: boolean) => (b ? 1 : 0);
  return {
    motor_left: m.left,
    motor_right: m.right,
    light: sim.lightLevel(),
    line_left: yes(sim.line('left')),
    line_right: yes(sim.line('right')),
    whisker_left: yes(sim.whisker('left')),
    whisker_right: yes(sim.whisker('right')),
    pen: yes(sim.pen)
  };
}

/** The range each value is drawn over on the graph. */
export function graphRange(v: MonitorValue): [number, number] {
  if (v === 'motor_left' || v === 'motor_right') return [-100, 100];
  if (v === 'light') return [0, 255];
  return [0, 1];
}

/** A world's grid, or 200 mm squares over the whole floor for worlds without one (FR-12). */
export function gridFor(world: World): { cols: number; rows: number; cell: number } {
  return (
    world.grid ?? {
      cols: Math.ceil(world.width / 200),
      rows: Math.ceil(world.height / 200),
      cell: 200
    }
  );
}

/** The grid square under a point, e.g. "C4": columns are letters, rows numbers from the top. */
export function squareAt(world: World, x: number, y: number): string {
  const g = gridFor(world);
  const col = Math.min(g.cols - 1, Math.max(0, Math.floor(x / g.cell)));
  const row = Math.min(g.rows - 1, Math.max(0, Math.floor(y / g.cell)));
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

// --- Missions and maze numbers (M4 spec FR-17, FR-18) ----------------------------------------

/** Each world's spec by id, so a maze course can be rebuilt with another maze number. */
export function specsById(specs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.values(specs).map((spec) => [buildWorld(spec).id, spec] as const)
  );
}

/** Highest maze number a learner can type (six digits, easy to read out on a competition day). */
export const MAZE_NUMBER_MAX = 999_999;

/** A maze course with this maze number and size (3–6); the same number gives the same maze. */
export function withMaze(spec: unknown, mazeNumber: number, size: number): World {
  const seed = Math.max(0, Math.min(MAZE_NUMBER_MAX, Math.floor(mazeNumber)));
  return buildWorld(spec, { seed, mazeSize: Math.max(3, Math.min(6, Math.floor(size))) });
}

/** The course's missions and whether each is done, for the checklist. */
export function missionList(sim: Sim): { id: string; points: number; done: boolean }[] {
  return sim.world.missions.map((m) => ({
    id: m.id,
    points: m.points,
    done: sim.missionDone(m.id)
  }));
}
