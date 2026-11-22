import { describe, expect, it } from 'vitest';
import en from '../../../../content/i18n/en.json';
import { parseProgram } from '../program';
import { SAMPLES } from '../samples';
import { BLOCK_DEFINITIONS, iconImage, messageKeys } from './definitions';
import { fromBlockly, NEW_PROGRAM, toBlockly, type BlockJson } from './serialization';
import { TOOLBOX, variableBlocks } from './toolbox';

const defined = new Set(BLOCK_DEFINITIONS.map((d) => d.type));

describe('block definitions', () => {
  it('have an English message for every %{BKY_...} key', () => {
    const messages = en as Record<string, string>;
    const missing = messageKeys().filter((k) => !messages[k.toLowerCase()]);
    expect(missing).toEqual([]);
  });

  it('cover every block in the toolbox', () => {
    const used: string[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (typeof o['type'] === 'string' && (o['kind'] === 'block' || 'fields' in o || 'shadow' in o || o['type'].startsWith('rfa_'))) {
          used.push(o['type']);
        }
        Object.values(o).forEach(walk);
      }
    };
    walk(TOOLBOX);
    walk(variableBlocks({ name: 'score', id: 'v1' }));
    expect(used.filter((t) => !defined.has(t as never))).toEqual([]);
  });

  it('draw each icon as a small picture', () => {
    expect(iconImage('HEART')).toMatch(/^data:image\/svg\+xml,/);
    expect(decodeURIComponent(iconImage('HEART')).match(/fill="#e00"/g)?.length).toBe(16);
  });
});

describe('Blockly ⇄ program JSON', () => {
  it('round-trips every sample program', () => {
    for (const sample of [...Object.values(SAMPLES), NEW_PROGRAM]) {
      const back = fromBlockly(JSON.parse(JSON.stringify(toBlockly(sample))));
      expect(parseProgram(back)).toEqual(sample);
    }
  });

  it('only uses defined block types', () => {
    const types: string[] = [];
    const walk = (b?: BlockJson) => {
      if (!b) return;
      types.push(b.type);
      for (const i of Object.values(b.inputs ?? {})) {
        walk(i.block);
        walk(i.shadow);
      }
      walk(b.next?.block);
    };
    for (const sample of Object.values(SAMPLES)) toBlockly(sample).blocks?.blocks?.forEach(walk);
    expect(types.filter((t) => !defined.has(t as never))).toEqual([]);
  });

  it('leaves out loose blocks and runs event blocks from top to bottom', () => {
    const program = fromBlockly({
      blocks: {
        blocks: [
          { type: 'rfa_forever', y: 200, inputs: { DO: { block: { type: 'rfa_clear' } } } },
          { type: 'rfa_show_icon', y: 100, fields: { ICON: 'HEART' } },
          { type: 'rfa_on_start', y: 10, inputs: { DO: { block: { type: 'rfa_show_icon', fields: { ICON: 'HAPPY' } } } } }
        ]
      }
    });
    expect(program.handlers.map((h) => h.type)).toEqual(['on_start', 'forever']);
  });

  it('reads variables by their names', () => {
    const program = fromBlockly({
      variables: [{ name: 'score', id: 'abc' }],
      blocks: {
        blocks: [
          {
            type: 'rfa_on_start',
            inputs: {
              DO: {
                block: {
                  type: 'rfa_var_change',
                  fields: { VAR: { id: 'abc' } },
                  inputs: { BY: { shadow: { type: 'rfa_number', fields: { NUM: 2 } } } }
                }
              }
            }
          }
        ]
      }
    });
    expect(program.handlers[0]).toEqual({
      type: 'on_start',
      body: [{ type: 'change', name: 'score', by: { type: 'number', value: 2 } }]
    });
  });
});
