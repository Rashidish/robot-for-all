// Junior pictures (spec FR-1): inline SVG paths on a 24×24 grid, no words, so they work in every
// language and add almost nothing to download. "×N" blocks show the number only.
import type { Block } from '../../../../packages/sim/src/junior';

export const BLOCK_ICON: Record<Exclude<Block, 'x2' | 'x3' | 'x4' | 'x5'>, string> = {
  // Like classroom floor robots: forward is "up", because turns turn the robot itself.
  forward: 'M12 2.5l7.5 8.5h-5v10.5h-5V11h-5z',
  back: 'M12 21.5l-7.5-8.5h5V2.5h5V13h5z',
  left: 'M9.5 3L3 8.5l6.5 5.5v-3.6c4.6 0 7.6 2 8.6 7.1.5-6.4-3.2-10.6-8.6-11.1z',
  right: 'M14.5 3L21 8.5 14.5 14v-3.6c-4.6 0-7.6 2-8.6 7.1-.5-6.4 3.2-10.6 8.6-11.1z',
  wait: 'M6 2.5h12v2.5l-4.5 7 4.5 7v2.5H6V19l4.5-7L6 5z',
  beep: 'M12 2.5a6.5 6.5 0 0 0-6.5 6.5v4.5L3.5 17h17l-2-3.5V9A6.5 6.5 0 0 0 12 2.5zM9.5 18.5a2.5 2.5 0 0 0 5 0z',
  light: 'M12 21l-8.2-8.2a5.2 5.2 0 0 1 8.2-6.3 5.2 5.2 0 0 1 8.2 6.3z',
  stop: 'M5.5 5.5h13v13h-13z'
};
export const START_ICON = 'M5 2.5v19h2.5v-7.5h11l-3-4.25 3-4.25h-11V2.5z';
export const CLEAR_ICON = 'M7 4V2.5h10V4h4.5v2.5h-19V4zM4.5 8h15l-1.2 13.5H5.7z';
export const UNDO_ICON =
  'M8.5 5H21v14H8.5L2 12zM11.6 8.6l-1.4 1.4 2 2-2 2 1.4 1.4 2-2 2 2 1.4-1.4-2-2 2-2-1.4-1.4-2 2z';
export const BIG_ICON =
  'M3 3h7v2.5H5.5V10H3zM14 3h7v7h-2.5V5.5H14zM3 14h2.5v4.5H10V21H3zM18.5 14H21v7h-7v-2.5h4.5z';
export const PLAY_ICON = 'M7 4l13 8-13 8z';
export const SPEAK_ICON = 'M3 9h4l5-4.5v15L7 15H3zM15.5 8.5a5 5 0 0 1 0 7M17.5 5.5a9 9 0 0 1 0 13';
export const STAR_ICON =
  'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
export const ROCK_ICON = 'M4 17l2.5-7 5-3.5 5 2 3.5 5.5L18 18.5H6z';

/** What the robot is and where it is going, per mission theme. */
export const THEME: Record<
  'rhino-water' | 'bee-flower' | 'bus-school',
  { robot: string; robotColour: string; target: string; targetColour: string }
> = {
  'rhino-water': {
    // A rhino from the side, horn forward (the robot turns to face its heading).
    robot:
      'M3 15.5c0-3.6 3-6 7-6h4.5l2.5-2.5 1 2.2 3 .8-1 3.5-1.5.8V17h-2.5v-2.5h-6V17H7.5v-2.5L5 15.5z',
    robotColour: '#5b6b7a',
    target: 'M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z',
    targetColour: '#1f78c8'
  },
  'bee-flower': {
    robot: 'M12 6.5a5.5 5 0 1 0 0 10 5.5 5 0 1 0 0-10zM9 7.5 6 3.5M15 7.5l3-4M9 11.5h6M9 14h6',
    robotColour: '#b8860b',
    target:
      'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM12 2.5a3 3 0 0 1 0 6 3 3 0 0 1 0-6zM12 15.5a3 3 0 0 1 0 6 3 3 0 0 1 0-6zM2.5 12a3 3 0 0 1 6 0 3 3 0 0 1-6 0zM15.5 12a3 3 0 0 1 6 0 3 3 0 0 1-6 0z',
    targetColour: '#c2185b'
  },
  'bus-school': {
    robot:
      'M4 5.5h16v11H4zM6 8h5v3.5H6zM13 8h5v3.5h-5zM7.5 16.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 1 0 0-3.6zM16.5 16.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 1 0 0-3.6z',
    robotColour: '#d9730d',
    target: 'M12 2.5l9 7H3zM5 10.5h14v10H5zM10 14h4v6.5h-4z',
    targetColour: '#7a3fc2'
  }
};

/** Block colours: one colour per kind of block, the same in the arrow cards (step 2). */
export const BLOCK_COLOUR: Record<string, string> = {
  start: '#2e7d32',
  forward: '#1c5fb8',
  back: '#1c5fb8',
  left: '#6a35b0',
  right: '#6a35b0',
  repeat: '#b85c00',
  wait: '#5d6b75',
  beep: '#ad1457',
  light: '#ad1457',
  stop: '#c62828'
};
export const colourOf = (b: Block | 'start'): string =>
  BLOCK_COLOUR[b.startsWith('x') ? 'repeat' : b] ?? '#333';
