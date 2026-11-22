// Prepares the micro:bit Foundation's MicroPython simulator (MIT) for our strict CSP
// (ADR-0006). Run by scripts/build-simulator.sh; never edits upstream files by hand.
//
//   node scripts/vendor-simulator.mjs svg <microbit-drawing.svg>
//     Turns style="..." attributes into SVG presentation attributes (inline styles are
//     blocked by our CSP). Fails if it meets a style it can't convert.
//
//   node scripts/vendor-simulator.mjs finish <simulator src dir> <output dir> <version>
//     Copies the files we serve, moving simulator.html's inline <style> and style="" into
//     simulator.css.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [mode, ...args] = process.argv.slice(2);
const PRESENTATION = new Set(['fill', 'stroke', 'stroke-width', 'opacity']);

if (mode === 'svg') {
  const [file] = args;
  const svg = readFileSync(file, 'utf8');
  const out = svg.replace(/\sstyle="([^"]*)"/g, (_, css) => {
    const attrs = [];
    for (const declaration of css.split(';')) {
      if (!declaration.trim()) continue;
      const [name, ...rest] = declaration.split(':');
      const prop = name.trim();
      const value = rest.join(':').trim();
      if (prop === 'mix-blend-mode' && value === 'normal') continue; // the default
      if (!PRESENTATION.has(prop)) throw new Error(`Can't convert style "${prop}: ${value}"`);
      attrs.push(`${prop}="${value}"`);
    }
    return attrs.length ? ` ${attrs.join(' ')}` : '';
  });
  if (/\sstyle="/.test(out) || /<style/.test(out))
    throw new Error('Inline styles remain in the SVG');
  writeFileSync(file, out);
  console.log(`SVG styles converted: ${file}`);
} else if (mode === 'finish') {
  const [src, outDir, version] = args;
  mkdirSync(join(outDir, 'build'), { recursive: true });
  let html = readFileSync(join(src, 'simulator.html'), 'utf8');
  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  html = html.replace(/\s*<style>[\s\S]*?<\/style>/g, '');
  html = html.replace(
    '<div class="play-button-container" style="display: flex">',
    '<div class="play-button-container rfa-flex">'
  );
  if (/\sstyle=|<style|<script(?![^>]*\ssrc=)/i.test(html))
    throw new Error('simulator.html still has inline code');
  html = html.replace('</head>', '    <link rel="stylesheet" href="simulator.css" />\n  </head>');
  writeFileSync(join(outDir, 'simulator.html'), html);
  writeFileSync(
    join(outDir, 'simulator.css'),
    `/* Moved out of simulator.html for our Content-Security-Policy. */\n${styles.join('\n')}\n.rfa-flex {\n  display: flex;\n}\n`
  );
  for (const file of ['simulator.js', 'firmware.js', 'firmware.wasm']) {
    copyFileSync(join(src, 'build', file), join(outDir, 'build', file));
  }
  copyFileSync(join(src, '..', 'LICENSE'), join(outDir, 'LICENSE'));
  writeFileSync(join(outDir, 'VERSION'), `${version}\n`);
  console.log(`Simulator ${version} ready in ${outDir}`);
} else {
  console.error('Usage: vendor-simulator.mjs svg <file> | finish <src> <out> <version>');
  process.exit(1);
}
