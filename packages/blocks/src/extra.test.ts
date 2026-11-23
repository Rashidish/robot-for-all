// Every MakeCode-level block (extra.ts): valid program JSON, Blockly round trip, and MicroPython
// that Python can compile. The real behaviour is checked in the simulator by the browser tests.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import en from '../../../content/i18n/en.json';
import { EXTRA_SPECS, type GenericNode, type NodeSpec } from './extra';
import { parseProgram, type Expr, type Program, type Stmt } from './program';
import { filesFor, toPython } from './python';
import { GAME_PY } from './modules';
import { fromBlockly, toBlockly } from './blockly/serialization';
import { extraMessageKey } from './blockly/definitions';
import { toolbox, EXTENSIONS } from './blockly/toolbox';

const messages = en as Record<string, string>;

/** A block of this type with every field at its default value. */
function sample(spec: NodeSpec): GenericNode {
  const node: GenericNode = { type: spec.type };
  for (const f of spec.fields) {
    if (f.kind === 'expr') node[f.key] = f.shadow ?? { type: 'var', name: 'thing' };
    if (f.kind === 'stmts') node[f.key] = [{ type: 'clear' }];
    if (f.kind === 'enum') node[f.key] = f.options[0]?.[1];
    if (f.kind === 'int' || f.kind === 'text' || f.kind === 'ident') node[f.key] = f.value;
    if (f.kind === 'leds') node[f.key] = '0101011111111110111000100';
  }
  return node;
}

function everything(): Program {
  const stmts: Stmt[] = [];
  for (const spec of EXTRA_SPECS) {
    if (spec.role === 'stmt' && !['x_break', 'x_continue'].includes(spec.type))
      stmts.push(sample(spec));
    if (spec.role === 'expr') stmts.push({ type: 'show_text', value: sample(spec) as Expr });
  }
  stmts.push({
    type: 'repeat',
    times: { type: 'number', value: 2 },
    body: [{ type: 'x_break' }, { type: 'x_continue' }]
  });
  return {
    version: 1,
    handlers: [
      {
        type: 'on_start',
        body: [{ type: 'set', name: 'score', value: { type: 'number', value: 0 } }]
      },
      { type: 'forever', body: stmts },
      ...EXTRA_SPECS.filter((s) => s.role === 'handler' || s.role === 'function').map(sample)
    ]
  };
}

describe('MakeCode-level blocks', () => {
  it('each have English text with the right number of gaps', () => {
    for (const spec of EXTRA_SPECS) {
      const text = messages[extraMessageKey(spec).toLowerCase()];
      expect(text, spec.type).toBeTruthy();
      const gaps = spec.fields.filter((f) => !['stmts', 'leds'].includes(f.kind)).length;
      expect((text ?? '').match(/%\d/g)?.length ?? 0, spec.type).toBe(gaps);
    }
  });

  it('every toolbox category has a name', () => {
    const keys = [...JSON.stringify(toolbox([...EXTENSIONS])).matchAll(/%\{BKY_([A-Z_]+)\}/g)].map(
      (m) => m[1] ?? ''
    );
    expect(keys.filter((k) => !messages[k.toLowerCase()])).toEqual([]);
  });

  it('are valid program JSON and survive a trip through Blockly', () => {
    const program = everything();
    expect(parseProgram(JSON.parse(JSON.stringify(program)))).toEqual(program);
    expect(parseProgram(fromBlockly(JSON.parse(JSON.stringify(toBlockly(program)))))).toEqual(
      program
    );
  });

  it('turn into MicroPython that compiles', () => {
    const python = toPython(everything());
    for (const module of ['import music', 'import radio', 'import neopixel', 'radio.on()']) {
      expect(python).toContain(module);
    }
    expect(python).toContain('def doSomething():\n    global score');
    expect(python).toContain('import game');
    const check = spawnSync('python3', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], {
      input: python,
      encoding: 'utf8'
    });
    expect(check.stderr).toBe('');
    expect(check.status).toBe(0);
  });

  it('robot blocks make rfa_robot calls, never pins (ADR-0008)', () => {
    const drive = (motor: string, dir: string, speed: number) =>
      ({ type: 'x_drive', motor, dir, speed: { type: 'number', value: speed } }) as unknown as Stmt;
    const node = (n: Record<string, unknown>) => n as unknown as Stmt;
    const python = toPython({
      version: 1,
      handlers: [
        {
          type: 'on_start',
          body: [
            drive('A', 'forward', 75),
            drive('B', 'backward', 50),
            node({ type: 'x_drive_stop', motor: 'B' }),
            node({ type: 'x_drive_stop', motor: 'both' }),
            node({ type: 'x_pen', pen: 'down' }),
            node({
              type: 'if',
              cond: { type: 'x_whisker', side: 'left' },
              then: [node({ type: 'x_pen', pen: 'up' })],
              else: []
            }),
            node({
              type: 'if',
              cond: { type: 'x_line', side: 'right' },
              then: [],
              else: []
            })
          ]
        }
      ]
    });
    expect(python).toContain('import rfa_robot\n');
    expect(python).toContain(
      [
        'rfa_robot.motor("left", max(0, min(100, 75)))',
        'rfa_robot.motor("right", -max(0, min(100, 50)))',
        'rfa_robot.motor("right", 0)',
        'rfa_robot.stop()',
        'rfa_robot.pen(True)',
        'if rfa_robot.whisker("left"):',
        '    rfa_robot.pen(False)',
        'if rfa_robot.line("right"):'
      ].join('\n')
    );
    expect(python).not.toMatch(/\bpin\d/);
  });

  it('add rfa_robot.py made for this run when a program uses the robot', () => {
    const files = filesFor('import rfa_robot\nrfa_robot.stop()\n', { rfa_robot: '# board\n' });
    expect(files).toEqual({
      'main.py': 'import rfa_robot\nrfa_robot.stop()\n',
      'rfa_robot.py': '# board\n'
    });
    expect(Object.keys(filesFor('from microbit import *\n', { rfa_robot: '# board\n' }))).toEqual([
      'main.py'
    ]);
  });

  it('add game.py when a program uses the Game blocks, for blocks and typed Python', () => {
    expect(Object.keys(filesFor(toPython(everything())))).toEqual(['main.py', 'game.py']);
    expect(Object.keys(filesFor('from microbit import *\nimport game\n'))).toEqual([
      'main.py',
      'game.py'
    ]);
    expect(Object.keys(filesFor('from microbit import *\n# no game here\n'))).toEqual(['main.py']);
  });

  it('game.py compiles', () => {
    const check = spawnSync('python3', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], {
      input: GAME_PY,
      encoding: 'utf8'
    });
    expect(check.status).toBe(0);
  });

  it('reject bad values', () => {
    const bad = (node: Record<string, unknown>) => () =>
      parseProgram({ version: 1, handlers: [{ type: 'on_start', body: [node] }] });
    expect(bad({ type: 'x_show_leds', leds: '2'.repeat(25) })).toThrow(/25 LEDs/);
    expect(bad({ type: 'x_call', name: 'os.system' })).toThrow(/names/);
    expect(bad({ type: 'x_radio_group', group: 300 })).toThrow(/whole number/);
    expect(bad({ type: 'x_play_melody', melody: 'NOPE' })).toThrow(/one of/);
  });
});
