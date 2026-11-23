// The robot world (spec §6, §6.2, FR-21): robot calls in, sensor answers out, fixed 20 ms steps,
// walls and bumps, the challenge or missions, and the run report. No pins anywhere: the same
// calls come from the on-screen micro:bit (simulator profile), a scripted test driver or replay.
import {
  bodyPoint,
  kinematicStep,
  LINE_AHEAD_MM,
  LINE_SIDE_MM,
  RADIUS_MM,
  type RobotState,
  type Side,
  STEP_MS,
  TOP_SPEED_MM_S,
  WHISKER_AHEAD_MM,
  WHISKER_SIDE_MM
} from './robot';
import { type Area, type Mission, type World, worldHash } from './world';
import { circleHitsRect, distToSegment, inRect, mulberry32, type Point, type Rect } from './util';

/** What a program can ask of the robot. Blocks and Python name these parts, never pins (ADR-0008). */
export interface RobotCalls {
  /** Speed −100 (full backward) to 100 (full forward). */
  setMotor(side: Side, speed: number): void;
  stopMotors(): void;
  setPen(down: boolean): void;
  /** Is there a dark line under this line sensor? */
  line(side: Side): boolean;
  /** Is this whisker touching something? */
  whisker(side: Side): boolean;
  /** The micro:bit's own light level, 0–255. */
  lightLevel(): number;
  /** Was there a shake gesture since the last call? (micro:bit `was_gesture('shake')`) */
  wasShaken(): boolean;
}

/** A scripted driver: called once per 20 ms step, like one pass of a program's `while True` loop. */
export type Driver = (robot: RobotCalls, timeMs: number) => void;

export interface SimOptions {
  /** Each wheel gets a seeded difference of up to ±3 %, like a real floor (spec §6). */
  realFloor?: boolean;
  /** Seed for "real floor"; defaults to the maze number, or 0. */
  seed?: number;
  /** A one-motor robot: both wheels follow the left motor; right-motor calls are ignored (§6.2). */
  oneMotor?: boolean;
}

export type Status = 'running' | 'done' | 'failed';
export type FailReason = 'timeLimit' | 'bumped';

export interface RunReport {
  sim: 'rfa-sim/1';
  worldId: string;
  worldVersion: number;
  worldHash: string;
  programHash: string;
  status: Status;
  reason?: FailReason;
  timeMs: number;
  bumps: number;
  /** Metres driven, to 2 decimals. */
  distance: number;
  realFloor: boolean;
  seed: number;
  oneMotor?: true;
  score?: number;
  missions?: Record<string, 0 | 1>;
}

export interface PoseView {
  x: number;
  y: number;
  /** Degrees, 0–360, clockwise from east. */
  heading: number;
}

/** Longest time one advance() call moves the world, so the robot doesn't jump after a phone sleeps. */
export const MAX_ADVANCE_MS = 1000;
const REAL_FLOOR_SPREAD = 0.03;

interface Contact {
  /** "wall" (walls and the world's edge) or a target id. */
  what: string;
  /** The touching point. */
  at: Point;
}

interface MissionState {
  done: boolean;
  next: number;
  wasInside: boolean;
  leftZone: boolean;
}

export class Sim implements RobotCalls {
  readonly world: World;
  readonly realFloor: boolean;
  readonly seed: number;
  readonly oneMotor: boolean;

  timeMs = 0;
  bumps = 0;
  status: Status = 'running';
  reason: FailReason | null = null;
  /** Pen drawing as line segments [x1, y1, x2, y2] (mm). */
  readonly strokes: [number, number, number, number][] = [];

  private robot: RobotState;
  private motors = { left: 0, right: 0 };
  private factor = { left: 1, right: 1 };
  private penDown = false;
  private distanceMm = 0;
  private carryMs = 0;
  private touchingWall = false;
  private touchingTarget: string | null = null;
  /** The whisker wire spans the cart's front: a body touch ahead of the axle presses that side. */
  private frontContact: Side | 'both' | null = null;
  private shaken = false;
  private stoppedByLearner = false;
  private visitIndex = 0;
  private readonly missionState = new Map<string, MissionState>();
  private readonly areaById = new Map<string, Area>();
  private readonly hash: string;

  constructor(world: World, options: SimOptions = {}) {
    this.world = world;
    this.realFloor = options.realFloor ?? false;
    this.oneMotor = options.oneMotor ?? false;
    this.seed = options.seed ?? world.maze?.seed ?? 0;
    this.robot = {
      x: world.start.x,
      y: world.start.y,
      heading: (world.start.heading * Math.PI) / 180
    };
    if (this.realFloor) {
      const rand = mulberry32(this.seed);
      this.factor = {
        left: 1 + (rand() * 2 - 1) * REAL_FLOOR_SPREAD,
        right: 1 + (rand() * 2 - 1) * REAL_FLOOR_SPREAD
      };
    }
    for (const a of world.areas) if (a.id) this.areaById.set(a.id, a);
    this.hash = worldHash(world);
  }

  // --- Robot calls -----------------------------------------------------------------------------

  setMotor(side: Side, speed: number): void {
    const s = Number.isFinite(speed) ? Math.max(-100, Math.min(100, speed)) : 0;
    if (this.oneMotor && side === 'right') return;
    this.motors[side] = s;
  }

  stopMotors(): void {
    this.motors.left = 0;
    this.motors.right = 0;
  }

  setPen(down: boolean): void {
    this.penDown = down;
  }

  line(side: Side): boolean {
    const p = bodyPoint(this.robot, LINE_AHEAD_MM, side, LINE_SIDE_MM);
    for (const l of this.world.lines) {
      for (let i = 1; i < l.points.length; i++) {
        const a = l.points[i - 1];
        const b = l.points[i];
        if (a && b && distToSegment(p, a, b) <= l.width / 2) return true;
      }
    }
    return this.world.areas.some((a) => a.dark === true && inRect(p, a));
  }

  whisker(side: Side): boolean {
    if (this.frontContact === side || this.frontContact === 'both') return true;
    return this.solidAt(bodyPoint(this.robot, WHISKER_AHEAD_MM, side, WHISKER_SIDE_MM)) !== null;
  }

  lightLevel(): number {
    let level = this.world.light;
    for (const a of this.world.areas)
      if (a.light !== undefined && inRect(this.robot, a)) level = Math.min(level, a.light);
    return level;
  }

  wasShaken(): boolean {
    const s = this.shaken;
    this.shaken = false;
    return s;
  }

  // --- Running ---------------------------------------------------------------------------------

  get pose(): PoseView {
    const deg = ((this.robot.heading * 180) / Math.PI) % 360;
    return { x: this.robot.x, y: this.robot.y, heading: deg < 0 ? deg + 360 : deg };
  }

  get motorSpeeds(): { left: number; right: number } {
    return this.oneMotor ? { left: this.motors.left, right: this.motors.left } : { ...this.motors };
  }

  get pen(): boolean {
    return this.penDown;
  }

  get finished(): boolean {
    return this.status !== 'running' || this.stoppedByLearner;
  }

  /** Move the world on by `ms` (at most 1 s) in fixed 20 ms steps; the driver runs before each step. */
  advance(ms: number, driver?: Driver): void {
    this.carryMs += Math.max(0, Math.min(ms, MAX_ADVANCE_MS));
    while (this.carryMs >= STEP_MS) {
      this.carryMs -= STEP_MS;
      this.step(driver);
    }
  }

  /** One fixed 20 ms step. */
  step(driver?: Driver): void {
    if (this.finished) return;
    driver?.(this, this.timeMs);
    if (this.finished) return;

    const speeds = this.motorSpeeds;
    const vL = (speeds.left / 100) * TOP_SPEED_MM_S * this.factor.left;
    const vR = (speeds.right / 100) * TOP_SPEED_MM_S * this.factor.right;
    const from = this.robot;
    const to = kinematicStep(from, vL, vR, STEP_MS / 1000);

    const hit = this.bodyHit(to);
    this.touchingTarget = hit !== null && hit.what !== 'wall' ? hit.what : null;
    this.frontContact = hit && this.frontSide(to, hit.at);
    // Blocked: slide along what it touches (keep only the part of the move along the surface).
    const next = hit
      ? (this.slide(from, to, hit.at) ?? { x: from.x, y: from.y, heading: to.heading })
      : to;
    const moved = Math.hypot(next.x - from.x, next.y - from.y);
    if (moved > 0) {
      this.distanceMm += moved;
      if (this.penDown) this.draw(from, next);
    }
    this.robot = next;

    // One touch is one bump: the cart counts as touching while within 1 mm of a wall.
    const touchingWall = hit?.what === 'wall' || this.bodyHit(next, RADIUS_MM + 1)?.what === 'wall';
    const newBump = touchingWall && !this.touchingWall;
    this.touchingWall = touchingWall;
    if (newBump) {
      this.bumps++;
      if (this.world.bump === 'shake') {
        this.shaken = true;
        this.stopMotors();
      }
    }
    this.timeMs += STEP_MS;

    this.checkProgress();
    if (this.status !== 'running') return;
    if (newBump && this.world.noBumps) this.fail('bumped');
    else if (this.world.timeLimitMs !== null && this.timeMs >= this.world.timeLimitMs)
      this.fail('timeLimit');
  }

  /** The learner pressed Stop: the run ends with status "running". */
  stop(): void {
    this.stoppedByLearner = true;
  }

  /** Points scored so far (courses with missions). */
  score(): number {
    const sc = this.world.scoring;
    let total = 0;
    for (const m of this.world.missions) if (this.ms(m.id).done) total += m.points;
    if (sc) {
      const limit = this.world.timeLimitMs;
      if (this.status === 'done' && limit !== null) {
        total += Math.round((sc.timeBonus * Math.max(0, limit - this.timeMs)) / limit);
      }
      total += sc.wallTouch * this.bumps;
    }
    return Math.max(0, total);
  }

  missionDone(id: string): boolean {
    return this.missionState.get(id)?.done ?? false;
  }

  report(programHash: string): RunReport {
    // Keys are always written in this order, so the same run gives the same text on every device.
    const r: RunReport = {
      sim: 'rfa-sim/1',
      worldId: this.world.id,
      worldVersion: this.world.version,
      worldHash: this.hash,
      programHash,
      status: this.status,
      ...(this.reason ? { reason: this.reason } : {}),
      timeMs: this.timeMs,
      bumps: this.bumps,
      distance: Math.round(this.distanceMm / 10) / 100,
      realFloor: this.realFloor,
      seed: this.seed
    };
    if (this.oneMotor) r.oneMotor = true;
    if (this.world.missions.length > 0) {
      r.score = this.score();
      r.missions = {};
      for (const m of this.world.missions) r.missions[m.id] = this.ms(m.id).done ? 1 : 0;
    }
    return r;
  }

  // --- Inside ----------------------------------------------------------------------------------

  private ms(id: string): MissionState {
    let st = this.missionState.get(id);
    if (!st) {
      st = { done: false, next: 0, wasInside: false, leftZone: false };
      this.missionState.set(id, st);
    }
    return st;
  }

  private fail(reason: FailReason): void {
    this.status = 'failed';
    this.reason = reason;
  }

  /** What the body would hit at this position, and where it touches; null when clear. */
  private bodyHit(s: Point, r = RADIUS_MM): Contact | null {
    const w = this.world;
    if (s.x < r) return { what: 'wall', at: { x: 0, y: s.y } };
    if (s.y < r) return { what: 'wall', at: { x: s.x, y: 0 } };
    if (s.x > w.width - r) return { what: 'wall', at: { x: w.width, y: s.y } };
    if (s.y > w.height - r) return { what: 'wall', at: { x: s.x, y: w.height } };
    let target: Contact | null = null;
    for (const solid of w.solids) {
      if (!circleHitsRect(s, r, solid)) continue;
      const at = {
        x: Math.max(solid.x, Math.min(s.x, solid.x + solid.w)),
        y: Math.max(solid.y, Math.min(s.y, solid.y + solid.h))
      };
      if (solid.kind === 'wall') return { what: 'wall', at };
      target ??= { what: solid.id ?? 'target', at };
    }
    return target;
  }

  private slide(from: RobotState, to: RobotState, at: Point): RobotState | null {
    let nx = from.x - at.x;
    let ny = from.y - at.y;
    const len = Math.hypot(nx, ny);
    if (len === 0) return null;
    nx /= len;
    ny /= len;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const into = dx * nx + dy * ny;
    const tries: RobotState[] = [];
    if (into < 0)
      tries.push({ x: from.x + dx - into * nx, y: from.y + dy - into * ny, heading: to.heading });
    tries.push(
      { x: to.x, y: from.y, heading: to.heading },
      { x: from.x, y: to.y, heading: to.heading }
    );
    return tries.find((t) => this.bodyHit(t) === null) ?? null;
  }

  /** Which side of the cart's front a touch is on, or null when it is beside or behind the axle. */
  private frontSide(s: RobotState, at: Point): Side | 'both' | null {
    const dx = at.x - s.x;
    const dy = at.y - s.y;
    const fx = Math.cos(s.heading);
    const fy = Math.sin(s.heading);
    const ahead = dx * fx + dy * fy;
    if (ahead <= RADIUS_MM * 0.3) return null;
    const left = dx * fy - dy * fx;
    if (Math.abs(left) < 5) return 'both';
    return left > 0 ? 'left' : 'right';
  }

  /** What is at a point: "wall" (walls and outside the world), a target id, or null. */
  private solidAt(p: Point): string | null {
    const w = this.world;
    if (p.x < 0 || p.y < 0 || p.x > w.width || p.y > w.height) return 'wall';
    for (const s of w.solids)
      if (inRect(p, s)) return s.kind === 'wall' ? 'wall' : (s.id ?? 'target');
    return null;
  }

  private draw(from: Point, to: Point): void {
    const last = this.strokes[this.strokes.length - 1];
    if (last && last[2] === from.x && last[3] === from.y) {
      // Extend the last segment when the robot keeps going straight.
      const cross = (last[2] - last[0]) * (to.y - from.y) - (last[3] - last[1]) * (to.x - from.x);
      if (Math.abs(cross) < 1e-6) {
        last[2] = to.x;
        last[3] = to.y;
        return;
      }
    }
    this.strokes.push([from.x, from.y, to.x, to.y]);
  }

  private inArea(id: string): boolean {
    const a: Rect | undefined = this.areaById.get(id);
    return a !== undefined && inRect(this.robot, a);
  }

  private checkProgress(): void {
    const stopped = this.motorSpeeds.left === 0 && this.motorSpeeds.right === 0;
    const goal = this.world.goal;
    if (goal) {
      const nextVisit = goal.visit[this.visitIndex];
      if (nextVisit !== undefined && this.inArea(nextVisit)) this.visitIndex++;
      if (this.visitIndex >= goal.visit.length) {
        if (goal.reach !== undefined && this.inArea(goal.reach)) this.status = 'done';
        if (goal.stopInside !== undefined && stopped && this.inArea(goal.stopInside))
          this.status = 'done';
      }
      return;
    }
    const missions = this.world.missions;
    if (missions.length === 0) return;
    let home: Mission | null = null;
    for (const m of missions) {
      const st = this.ms(m.id);
      if (st.done) continue;
      switch (m.type) {
        case 'reachZone':
          st.done = this.inArea(m.zone);
          break;
        case 'stopInZone':
          st.done = stopped && this.inArea(m.zone);
          break;
        case 'checkpoints':
          if (this.inArea(m.zones[st.next] ?? '')) st.next++;
          st.done = st.next >= m.zones.length;
          break;
        case 'touchTarget':
          st.done =
            this.touchingTarget === m.target ||
            (['left', 'right'] as const).some(
              (side) =>
                this.solidAt(bodyPoint(this.robot, WHISKER_AHEAD_MM, side, WHISKER_SIDE_MM)) ===
                m.target
            );
          break;
        case 'passTunnel': {
          const inside = this.inArea(m.tunnel);
          if (inside) st.wasInside = true;
          else if (st.wasInside) st.done = true;
          break;
        }
        case 'returnHome':
          home = m;
          break;
      }
    }
    if (home) {
      const st = this.ms(home.id);
      const inside = this.inArea(home.zone);
      if (!inside) st.leftZone = true;
      const others = missions.filter((m) => m !== home);
      const anyOther = others.length === 0 || others.some((m) => this.ms(m.id).done);
      if (inside && st.leftZone && anyOther) st.done = true;
    }
    if (missions.every((m) => this.ms(m.id).done) || (home && this.ms(home.id).done)) {
      this.status = 'done';
    }
  }
}

/** Run a scripted driver on a world with no screen until the run ends or `maxMs` passes. */
export function runScripted(
  world: World,
  driver: Driver,
  options: SimOptions & { maxMs?: number } = {}
): Sim {
  const sim = new Sim(world, options);
  const maxMs = options.maxMs ?? world.timeLimitMs ?? 120_000;
  while (!sim.finished && sim.timeMs < maxMs) sim.step(driver);
  return sim;
}
