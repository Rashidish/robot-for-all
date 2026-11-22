// Block colours (M3 spec §5): MakeCode for micro:bit's colours, made slightly darker only where
// white block text would fall below WCAG AA (4.5:1). Owner decision 2026-11-22.
export const CATEGORY_COLOURS = {
  basic: '#0073E2', // MakeCode #1E90FF
  input: '#CF00CF', // MakeCode #D400D4
  loops: '#008600', // MakeCode #00AA00
  logic: '#008182', // MakeCode #00A4A6
  variables: '#DC143C',
  math: '#9400D3',
  pins: '#B22222',
  led: '#5C2D91',
  motors: '#B35400' // ours; MakeCode has no motor blocks in its core set
} as const;

export type Category = keyof typeof CATEGORY_COLOURS;

/** WCAG contrast ratio between a colour and white. */
export function contrastWithWhite(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05);
}
