// The answer check (spec §6, FR-11, FR-13).
import { describe, expect, it } from 'vitest';
import { checkAnswer, soundsUnsafe } from './check.ts';

describe('checkAnswer', () => {
  it.each([
    ['Plug the motor into the wall socket for more power.', 'mains'],
    ['Use a CR2032 coin cell, it is smaller.', 'coin cell'],
    ['You can recharge the lithium battery on the stove.', 'lithium'],
    ['Light a candle under the straw so it bends.', 'fire or chemicals'],
    ['Cut the slot with a craft knife.', 'blades'],
    ['Use mains instead.', 'mains']
  ])('blocks advice: %s', (text, rule) => {
    expect(checkAnswer(text, 500)).toEqual({ text: '', blocked: true, rule });
  });

  it.each([
    'Never use mains electricity: only the battery pack from the parts list.',
    "Don't use coin cells; a child could swallow one.",
    'Ask an adult to cut the slot with a craft knife.',
    'Mains power is dangerous, so we use two AA batteries.',
    'The fan blade spins faster when the gear is smaller.',
    'This matches the template.'
  ])('allows a warning or harmless words: %s', (text) => {
    expect(checkAnswer(text, 500).blocked).toBe(false);
  });

  it('takes out links, keeps link words, and cuts long answers at a sentence', () => {
    expect(
      checkAnswer('See [the guide](https://x.example) or www.example.com now.', 500).text
    ).toBe('See the guide or  now.');
    expect(checkAnswer('Visit robots.co.za for more.', 500).text).toBe('Visit  for more.');
    const long = checkAnswer('One two three. Four five six. Seven eight nine.', 30);
    expect(long).toEqual({ text: 'One two three. Four five six.', blocked: false });
    expect(checkAnswer('   ', 30).blocked).toBe(true);
  });
});

describe('soundsUnsafe', () => {
  it.each([
    'my uncle hits me when I break things',
    'I am scared at home',
    'I want to die',
    'Ngiyashaywa ekhaya'
  ])('catches: %s', (q) => {
    expect(soundsUnsafe(q)).toBe(true);
  });
  it.each(['the motor hits the wall', 'why does the gear touch the frame'])(
    'leaves alone: %s',
    (q) => {
      expect(soundsUnsafe(q)).toBe(false);
    }
  );
});
