import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../../content/i18n/en.json';
import { buildProfile, checkProfile, ProfileError, sensorPins } from './profile';

const dir = join(import.meta.dirname, '../../../content/robots');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (f: string) =>
  JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown>;
const basic = load('l9110s-basic.json');

describe('robot profile format (ADR-0008)', () => {
  it.each(files)('content/robots/%s is valid, named after its id, with its name text', (f) => {
    const spec = load(f);
    expect(checkProfile(spec)).toEqual([]);
    expect(f).toBe(`${String(spec.id)}.json`);
    expect((en as Record<string, string>)[String(spec.name)]).toBeTruthy();
  });

  it('rejects mistakes, with the path to each problem', () => {
    const paths = checkProfile({
      ...basic,
      id: 'Basic Board',
      colour: 'red',
      usedPins: [0, 1, 2],
      freePins: [13, 3, 2, 19, 13],
      lineDark: 2,
      status: 'published'
    }).map((p) => p.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '$.id',
        '$.colour',
        '$.usedPins', // motor pin 8 missing
        '$.freePins', // 13 twice
        '$.freePins[1]', // display pin
        '$.freePins[2]', // used by the board
        '$.freePins[3]', // I2C wire
        '$.lineDark',
        '$.testedBy' // required to publish
      ])
    );
    expect(() => buildProfile({ ...basic, motors: null })).toThrow(ProfileError);
  });

  it('rejects motor pins that are not edge pins and motors that share a pin', () => {
    const paths = checkProfile({
      ...basic,
      motors: {
        method: 'pins',
        left: { forward: 0, backward: 0 },
        right: { forward: 17, backward: 1 }
      }
    }).map((p) => p.path);
    expect(paths).toEqual(expect.arrayContaining(['$.motors.left', '$.motors.right.forward']));
  });

  it('accepts a one-motor board', () => {
    const one = buildProfile({
      ...basic,
      motors: { method: 'pins', left: { forward: 0, backward: 1 }, right: null }
    });
    expect(one.motors.right).toBeNull();
  });

  it('keeps chip-driven boards out until their chip has a driver', () => {
    const problems = checkProfile({
      ...basic,
      motors: {
        method: 'i2c',
        chip: 'pca9685',
        address: 64,
        left: { forward: 0, backward: 1 },
        right: { forward: 2, backward: 3 }
      },
      usedPins: [19, 20],
      detect: [64]
    });
    expect(problems.map((p) => p.path)).toEqual(['$.motors.chip']);
  });

  it('gives out sensor pins from the free pins, always in the same order', () => {
    expect(sensorPins(buildProfile(basic))).toEqual({
      lineLeft: 13,
      lineRight: 14,
      whiskerLeft: 12,
      whiskerRight: 15,
      pen: 16
    });
    expect(sensorPins(buildProfile({ ...basic, freePins: [16, 13] }))).toEqual({
      lineLeft: 16,
      lineRight: 13
    });
  });
});
