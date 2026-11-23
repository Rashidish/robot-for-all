// Robot profiles (ADR-0008): what a motor driver board needs, as checked data in
// content/robots/<id>.json. Programs name robot parts; a profile says how this board drives them.

/** The micro:bit's edge-connector pins that a board or a sensor can use. */
export const EDGE_PINS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20
] as const;
/** Pins the micro:bit itself needs: the LED display (3, 4, 6, 7, 9, 10) and buttons A and B (5, 11). */
export const BUILT_IN_PINS = [3, 4, 5, 6, 7, 9, 10, 11] as const;
/** The shared I2C wires (chip-driven boards talk on these). */
export const I2C_PINS = [19, 20] as const;
/** I2C motor chips we have a driver for. Each is added with the first board that uses it (rollout 2). */
export const I2C_CHIPS: readonly string[] = [];

/** Sensor pins are given out in this order, so a board's wiring diagram never changes. */
export const SENSOR_ORDER = [
  'lineLeft',
  'lineRight',
  'whiskerLeft',
  'whiskerRight',
  'pen'
] as const;
export type SensorPart = (typeof SENSOR_ORDER)[number];

export type Side = 'left' | 'right';

export interface PinMotor {
  /** Pin driven (with speed) to go forward. */
  forward: number;
  /** Pin driven (with speed) to go backward. */
  backward: number;
}

export type MotorMethod =
  | { method: 'pins'; left: PinMotor; right: PinMotor | null }
  | { method: 'i2c'; chip: string; address: number; left: PinMotor; right: PinMotor | null };

export interface Profile {
  id: string;
  version: number;
  /** i18n key of the board's name. */
  name: string;
  /** Picture of the board (in content/robots/images), or null until one is drawn. */
  picture: string | null;
  motors: MotorMethod;
  /** Pins the board itself uses. */
  usedPins: number[];
  /** Pins free for sensors, in the order they are given out. */
  freePins: number[];
  /** What a line sensor reads over a dark line: 1 on most boards, 0 on some. */
  lineDark: 0 | 1;
  /** I2C addresses that identify this board, for auto-detect (chip-driven boards only). */
  detect: number[];
  status: 'draft' | 'published';
  /** Who tested this profile on a real board; required to publish. */
  testedBy: string | null;
}

export interface Problem {
  path: string;
  message: string;
}

export class ProfileError extends Error {
  readonly problems: Problem[];
  constructor(problems: Problem[]) {
    super(`Invalid robot profile:\n${problems.map((p) => `  ${p.path}: ${p.message}`).join('\n')}`);
    this.problems = problems;
  }
}

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEY_RE = /^[a-z]+(_[a-z]+)+$/;
const KEYS = [
  'id',
  'version',
  'name',
  'picture',
  'motors',
  'usedPins',
  'freePins',
  'lineDark',
  'detect',
  'status',
  'testedBy'
];

/** Check a profile. An empty list means it is valid. */
export function checkProfile(spec: unknown): Problem[] {
  return parse(spec).problems;
}

/** Check and return a profile; throws ProfileError listing every problem. */
export function buildProfile(spec: unknown): Profile {
  const { profile, problems } = parse(spec);
  if (!profile || problems.length > 0) throw new ProfileError(problems);
  return profile;
}

/** The pin for each sensor part on this board, given out from its free pins in SENSOR_ORDER. */
export function sensorPins(profile: Profile): Partial<Record<SensorPart, number>> {
  const out: Partial<Record<SensorPart, number>> = {};
  SENSOR_ORDER.forEach((part, i) => {
    const pin = profile.freePins[i];
    if (pin !== undefined) out[part] = pin;
  });
  return out;
}

function parse(spec: unknown): { profile: Profile | null; problems: Problem[] } {
  const problems: Problem[] = [];
  const err = (path: string, message: string) => problems.push({ path, message });
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    return { profile: null, problems: [{ path: '$', message: 'must be an object' }] };
  }
  const o = spec as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KEYS.includes(k)) err(`$.${k}`, 'is not a known field');

  const text = (v: unknown, path: string, re: RegExp, hint: string): string => {
    if (typeof v !== 'string' || !re.test(v)) err(path, hint);
    return typeof v === 'string' ? v : '';
  };
  const id = text(
    o.id,
    '$.id',
    ID_RE,
    'must be lowercase words joined by hyphens (e.g. l9110s-basic)'
  );
  const name = text(
    o.name,
    '$.name',
    KEY_RE,
    'must be an i18n key such as robot_basic_two_motor_name'
  );
  if (!Number.isInteger(o.version) || (o.version as number) < 1)
    err('$.version', 'must be a whole number, 1 or more');
  let picture: string | null = null;
  if (o.picture !== null)
    picture = text(
      o.picture,
      '$.picture',
      /^[a-z0-9-]+\.(svg|png|webp)$/,
      'must be a file name such as l9110s-basic.svg, or null'
    );

  const pin = (v: unknown, path: string): number | null => {
    if (typeof v !== 'number' || !(EDGE_PINS as readonly number[]).includes(v)) {
      err(path, 'must be a micro:bit edge pin (0–16, 19, 20)');
      return null;
    }
    return v;
  };
  const pinList = (v: unknown, path: string): number[] => {
    if (!Array.isArray(v)) {
      err(path, 'must be a list of pins');
      return [];
    }
    const pins = v.map((p, i) => pin(p, `${path}[${i}]`)).filter((p): p is number => p !== null);
    if (new Set(pins).size !== pins.length) err(path, 'lists a pin twice');
    return pins;
  };
  const usedPins = pinList(o.usedPins, '$.usedPins');
  const freePins = pinList(o.freePins, '$.freePins');
  freePins.forEach((p, i) => {
    if (usedPins.includes(p)) err(`$.freePins[${i}]`, `pin ${p} is used by the board`);
    if ((BUILT_IN_PINS as readonly number[]).includes(p))
      err(`$.freePins[${i}]`, `pin ${p} is needed by the display or buttons`);
    if ((I2C_PINS as readonly number[]).includes(p))
      err(`$.freePins[${i}]`, `pin ${p} is an I2C wire`);
  });

  // Motors.
  let motors: MotorMethod | null = null;
  /** { forward, backward }: micro:bit pins for a pin-driven board, chip channels (0–15) for I2C. */
  const pair = (
    v: unknown,
    path: string,
    check: (x: unknown, p: string) => number | null
  ): PinMotor | null => {
    if (v === null || typeof v !== 'object') {
      err(path, 'must be { forward, backward }');
      return null;
    }
    const m = v as Record<string, unknown>;
    const f = check(m.forward, `${path}.forward`);
    const b = check(m.backward, `${path}.backward`);
    if (f === null || b === null) return null;
    if (f === b) err(path, 'forward and backward must be different');
    return { forward: f, backward: b };
  };
  const channel = (v: unknown, path: string): number | null => {
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 15) {
      err(path, 'must be a chip channel, 0–15');
      return null;
    }
    return v as number;
  };
  if (o.motors === null || typeof o.motors !== 'object') err('$.motors', 'must be an object');
  else {
    const m = o.motors as Record<string, unknown>;
    const check = m.method === 'i2c' ? channel : pin;
    const left = pair(m.left, '$.motors.left', check);
    const right = m.right === null ? null : pair(m.right, '$.motors.right', check);
    const ends = left
      ? [left.forward, left.backward, ...(right ? [right.forward, right.backward] : [])]
      : [];
    if (new Set(ends).size !== ends.length) err('$.motors', 'two motors share a pin or channel');
    if (m.method === 'pins') {
      for (const p of ends)
        if (!usedPins.includes(p)) err('$.usedPins', `must include motor pin ${p}`);
      if (left) motors = { method: 'pins', left, right };
    } else if (m.method === 'i2c') {
      const chip = typeof m.chip === 'string' ? m.chip : '';
      if (!I2C_CHIPS.includes(chip)) {
        err(
          '$.motors.chip',
          'no driver for this chip yet: each I2C chip is added with the first board that uses it'
        );
      }
      const address = m.address;
      if (!Number.isInteger(address) || (address as number) < 8 || (address as number) > 119) {
        err('$.motors.address', 'must be an I2C address, 8–119');
      }
      for (const p of I2C_PINS)
        if (!usedPins.includes(p)) err('$.usedPins', `must include I2C pin ${p}`);
      if (left) motors = { method: 'i2c', chip, address: address as number, left, right };
    } else err('$.motors.method', 'must be pins or i2c');
  }

  const lineDark = o.lineDark === undefined ? 1 : o.lineDark;
  if (lineDark !== 0 && lineDark !== 1) err('$.lineDark', 'must be 0 or 1');
  const detect = Array.isArray(o.detect) ? o.detect : [];
  if (o.detect !== undefined && !Array.isArray(o.detect))
    err('$.detect', 'must be a list of I2C addresses');
  detect.forEach((a, i) => {
    if (!Number.isInteger(a) || (a as number) < 8 || (a as number) > 119)
      err(`$.detect[${i}]`, 'must be an I2C address, 8–119');
  });
  if (o.status !== 'draft' && o.status !== 'published')
    err('$.status', 'must be draft or published');
  let testedBy: string | null = null;
  if (o.testedBy !== null)
    testedBy = text(o.testedBy, '$.testedBy', /\S/, 'must be a name, or null');
  if (o.status === 'published' && !testedBy)
    err('$.testedBy', 'is required to publish: who tested it on a real board');

  if (problems.length > 0 || !motors) return { profile: null, problems };
  return {
    profile: {
      id,
      version: o.version as number,
      name,
      picture,
      motors,
      usedPins,
      freePins,
      lineDark: lineDark as 0 | 1,
      detect: detect as number[],
      status: o.status as 'draft' | 'published',
      testedBy
    },
    problems
  };
}
