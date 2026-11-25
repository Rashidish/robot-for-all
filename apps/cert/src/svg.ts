// Badge pictures into PDFs (M5 step 8b), with no image library: our badge SVGs use only a small
// set of shapes (checked when the site is built), turned here into SVG path data that pdf-lib
// draws as vectors, sharp at any print size.
//   <g fill stroke stroke-width fill-opacity>, <path d>, <circle cx cy r>,
//   <rect x y width height transform="rotate(a cx cy)">; colours as #rrggbb or "none".

export interface Shape {
  d: string;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
}

type Attrs = Record<string, string>;
const attrsOf = (tag: string): Attrs =>
  Object.fromEntries(
    [...tag.matchAll(/([a-z-]+)="([^"]*)"/g)].map((m) => [m[1] ?? '', m[2] ?? ''])
  );
const num = (v: string | undefined, d = 0) => (v === undefined ? d : Number(v));

function rectPath(a: Attrs): string {
  const x = num(a['x']);
  const y = num(a['y']);
  const w = num(a['width']);
  const h = num(a['height']);
  let pts: [number, number][] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h]
  ];
  const rot = /rotate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+))?\s*\)/.exec(
    a['transform'] ?? ''
  );
  if (rot) {
    const t = (Number(rot[1]) * Math.PI) / 180;
    const cx = Number(rot[2] ?? 0);
    const cy = Number(rot[3] ?? 0);
    pts = pts.map(([px, py]) => [
      cx + (px - cx) * Math.cos(t) - (py - cy) * Math.sin(t),
      cy + (px - cx) * Math.sin(t) + (py - cy) * Math.cos(t)
    ]);
  }
  return `M${pts.map(([px, py]) => `${px.toFixed(2)} ${py.toFixed(2)}`).join(' L')} Z`;
}

const circlePath = (a: Attrs) => {
  const cx = num(a['cx']);
  const cy = num(a['cy']);
  const r = num(a['r']);
  return `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
};

/** The shapes of a badge SVG, in drawing order, plus its viewBox size. */
export function svgShapes(svg: string): { width: number; height: number; shapes: Shape[] } {
  const view = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const shapes: Shape[] = [];
  const stack: Attrs[] = [{}];
  for (const m of svg.matchAll(/<(\/?)(g|path|circle|rect)\b([^>]*?)(\/?)>/g)) {
    const [, closing, name, rest = '', selfClosing] = m;
    if (closing) {
      if (name === 'g') stack.pop();
      continue;
    }
    const own = attrsOf(rest);
    const inherited = { ...stack[stack.length - 1], ...own };
    if (name === 'g') {
      if (!selfClosing) stack.push(inherited);
      continue;
    }
    const d =
      name === 'path' ? (own['d'] ?? '') : name === 'circle' ? circlePath(own) : rectPath(own);
    const fill = inherited['fill'] ?? '#000000';
    const stroke = inherited['stroke'] ?? null;
    shapes.push({
      d,
      fill: fill === 'none' ? null : fill,
      stroke: stroke === 'none' ? null : stroke,
      strokeWidth: num(inherited['stroke-width'], 1),
      opacity: num(inherited['fill-opacity'], 1)
    });
  }
  return { width: num(view?.[1], 200), height: num(view?.[2], 200), shapes };
}

/** True when the SVG uses only what svgShapes can draw (the site's build checks every badge). */
export function drawableSvg(svg: string): boolean {
  const tags = [...svg.matchAll(/<([a-zA-Z]+)\b/g)].map((m) => m[1]);
  return tags.every((t) => ['svg', 'g', 'path', 'circle', 'rect'].includes(t ?? ''));
}
