import { describe, expect, it } from 'vitest';
import { answerSheet, plainText, sheetIsDense } from './answers';

const body = `
## Predict

![A crank (1) and a rod (2).](./images/x.svg)

1. **Crank**: the disc
2. **Push rod**

Talk with a partner:

- What will the **head** do?
- Why?

## Run

1. Print the template.
2. Glue it on card.
3. Was your prediction right?

## Investigate

1. Swap the wires. What happens? Why?
2. Fill in the table:

   | Change | Prediction |
   |---|---|
   | Bigger weight | |
   | Wider legs | |

3. Write these steps:

   1. Go forward
   2. Stop

## Modify

Which change made the biggest difference? Why do you think so?

## Make

Design your own robot. What will it do?

## Teacher notes

- Is this a question? Not for learners.
`;

describe('answer sheet', () => {
  const sheet = answerSheet(body);

  it('has the five PRIMM steps and no teacher notes', () => {
    expect(sheet.map((s) => s.step)).toEqual(['Predict', 'Run', 'Investigate', 'Modify', 'Make']);
  });

  it('takes questions, skips diagram legends and instructions', () => {
    expect(sheet[0]?.items).toEqual([
      { kind: 'question', text: 'What will the head do?' },
      { kind: 'question', text: 'Why?' }
    ]);
  });

  it('counts steps to tick and keeps questions in order', () => {
    expect(sheet[1]?.items).toEqual([
      { kind: 'steps', count: 2 },
      { kind: 'question', text: 'Was your prediction right?' }
    ]);
  });

  it('copies tables with their blank answer cells, and nested lists stay one step', () => {
    expect(sheet[2]?.items).toEqual([
      { kind: 'steps', count: 2 },
      { kind: 'question', text: 'Swap the wires. What happens? Why?' },
      {
        kind: 'table',
        head: ['Change', 'Prediction'],
        rows: [
          ['Bigger weight', ''],
          ['Wider legs', '']
        ]
      }
    ]);
  });

  it('turns paragraph questions into one question; Make gets a box, not questions', () => {
    expect(sheet[3]?.items).toEqual([
      { kind: 'question', text: 'Which change made the biggest difference? Why do you think so?' }
    ]);
    expect(sheet[4]?.items).toEqual([]);
  });

  it('strips markdown marks', () => {
    expect(plainText('Tap **Run** and read `while True:` [here](/x)')).toBe(
      'Tap Run and read while True: here'
    );
  });

  it('uses one answer line per question only for long sheets', () => {
    expect(sheetIsDense(sheet)).toBe(false);
    const long = Array.from({ length: 12 }, () => ({
      kind: 'question' as const,
      text: 'A long question that takes up most of a printed line on the sheet?'
    }));
    expect(sheetIsDense([{ step: 'Investigate', label: 'Investigate', items: long }])).toBe(true);
  });

  it('maps a translation to its PRIMM steps by position, with the translated headings', () => {
    const zu = body
      .replace('## Predict', '## Bikezela')
      .replace('## Run', '## Qalisa')
      .replace('## Investigate', '## Phenya')
      .replace('## Modify', '## Shintsha')
      .replace('## Make', '## Yenza')
      .replace('## Teacher notes', '## Amanothi kathisha');
    const english = ['Predict', 'Run', 'Investigate', 'Modify', 'Make', 'Teacher notes'];
    const translated = answerSheet(zu, english);
    expect(translated.map((s) => s.step)).toEqual(english.slice(0, 5));
    expect(translated.map((s) => s.label)).toEqual([
      'Bikezela',
      'Qalisa',
      'Phenya',
      'Shintsha',
      'Yenza'
    ]);
    expect(translated.map((s) => s.items)).toEqual(sheet.map((s) => s.items));
    // Without the English headings, translated sections aren't PRIMM steps.
    expect(answerSheet(zu)).toEqual([]);
  });
});
