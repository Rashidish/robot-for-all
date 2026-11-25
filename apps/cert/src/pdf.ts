// Certificates and badge cards as PDFs (M5 FR-26 to FR-30, step 8b), drawn in this Worker only.
// The learner's name is decrypted in memory by the caller and passed in; it is never logged,
// cached or stored, and the PDF is the only place it appears (FR-24). Fonts: Noto Sans (OFL),
// subset into each PDF, so every letter of South Africa's languages prints.
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, type PDFPage, rgb } from 'pdf-lib';
import qrcode from 'qrcode-generator';
import { svgShapes } from './svg';

export interface CertificateData {
  /** The certificate name, or null for a blank line (no name, or consent b withdrawn: FR-25). */
  name: string | null;
  badgeName: string;
  badgeAbout: string;
  badgeSvg: string;
  /** "Sizwe Primary", "Sizwe Primary (not yet verified)" or "Robots For All". */
  label: string;
  date: string;
  code: string;
  /** Words in the certificate's language. */
  words: {
    title: string;
    awardedTo: string;
    forBadge: string;
    awardedByRfa: string;
    check: string;
  };
  site: string;
}

export interface Fonts {
  regular: Uint8Array;
  bold: Uint8Array;
}

const INK = rgb(0.12, 0.1, 0.08);
const ACCENT = rgb(0.54, 0.29, 0.08);
const hex = (h: string) => {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

function drawBadge(page: PDFPage, svg: string, x: number, top: number, width: number) {
  const { width: w, shapes } = svgShapes(svg);
  const scale = width / w;
  for (const s of shapes) {
    page.drawSvgPath(s.d, {
      x,
      y: top,
      scale,
      ...(s.fill ? { color: hex(s.fill), opacity: s.opacity } : {}),
      ...(s.stroke ? { borderColor: hex(s.stroke), borderWidth: s.strokeWidth * scale } : {})
    });
  }
}

function drawQr(page: PDFPage, text: string, x: number, y: number, size: number) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  const cell = size / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (q.isDark(r, c)) {
        page.drawRectangle({
          x: x + c * cell,
          y: y + (n - 1 - r) * cell,
          width: cell,
          height: cell,
          color: INK
        });
      }
    }
  }
}

/** Lines of text no wider than `width`, broken at spaces. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function centred(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  cx: number,
  y: number,
  color = INK
) {
  page.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y, size, font, color });
}

/** Largest size (down to `min`) at which `text` fits in `width`. */
const fit = (text: string, font: PDFFont, size: number, width: number, min = 12) => {
  let s = size;
  while (s > min && font.widthOfTextAtSize(text, s) > width) s -= 1;
  return s;
};

function certificatePage(
  doc: PDFDocument,
  fonts: { regular: PDFFont; bold: PDFFont },
  c: CertificateData
) {
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const cx = width / 2;
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: ACCENT,
    borderWidth: 4
  });
  page.drawRectangle({
    x: 34,
    y: 34,
    width: width - 68,
    height: height - 68,
    borderColor: ACCENT,
    borderWidth: 1
  });
  centred(page, 'Robots For All', fonts.bold, 14, cx, height - 80, ACCENT);
  centred(page, c.words.title, fonts.bold, 34, cx, height - 125);
  drawBadge(page, c.badgeSvg, cx - 75, height - 160, 150);
  let y = height - 370;
  centred(page, c.words.awardedTo, fonts.regular, 14, cx, y);
  y -= 46;
  if (c.name) {
    centred(page, c.name, fonts.bold, fit(c.name, fonts.bold, 30, width - 140), cx, y);
  } else {
    page.drawLine({
      start: { x: cx - 160, y: y - 4 },
      end: { x: cx + 160, y: y - 4 },
      thickness: 1,
      color: INK
    });
  }
  y -= 40;
  centred(page, c.words.forBadge, fonts.regular, 14, cx, y);
  y -= 34;
  centred(
    page,
    c.badgeName,
    fonts.bold,
    fit(c.badgeName, fonts.bold, 24, width - 140),
    cx,
    y,
    ACCENT
  );
  y -= 26;
  for (const line of wrap(c.badgeAbout, fonts.regular, 12, width - 180)) {
    centred(page, line, fonts.regular, 12, cx, y);
    y -= 17;
  }
  y -= 18;
  const by = c.label === 'Robots For All' ? c.words.awardedByRfa : c.label;
  centred(page, by, fonts.bold, fit(by, fonts.bold, 15, width - 140), cx, y);
  y -= 22;
  centred(page, c.date, fonts.regular, 13, cx, y);
  const url = `${c.site}/verify/#${c.code}`;
  drawQr(page, url, 60, 60, 78);
  page.drawText(c.code, { x: 152, y: 112, size: 14, font: fonts.bold, color: INK });
  for (const [i, line] of wrap(
    `${c.words.check} ${c.site.replace(/^https?:\/\//, '')}/verify/`,
    fonts.regular,
    10,
    width - 220
  ).entries()) {
    page.drawText(line, { x: 152, y: 92 - i * 13, size: 10, font: fonts.regular, color: INK });
  }
}

function cardsPage(
  doc: PDFDocument,
  fonts: { regular: PDFFont; bold: PDFFont },
  cards: CertificateData[]
) {
  const page = doc.addPage([595.28, 841.89]); // A4: four A6 cards
  const w = 595.28 / 2;
  const h = 841.89 / 2;
  cards.forEach((c, i) => {
    const x0 = (i % 2) * w;
    const y0 = (1 - Math.floor(i / 2)) * h;
    const cx = x0 + w / 2;
    page.drawRectangle({
      x: x0 + 12,
      y: y0 + 12,
      width: w - 24,
      height: h - 24,
      borderColor: ACCENT,
      borderWidth: 2,
      borderDashArray: [4, 3]
    });
    drawBadge(page, c.badgeSvg, cx - 55, y0 + h - 30, 110);
    let y = y0 + h - 190;
    centred(page, c.badgeName, fonts.bold, fit(c.badgeName, fonts.bold, 18, w - 50), cx, y, ACCENT);
    y -= 30;
    if (c.name) centred(page, c.name, fonts.bold, fit(c.name, fonts.bold, 18, w - 50), cx, y);
    else
      page.drawLine({
        start: { x: cx - 90, y: y - 3 },
        end: { x: cx + 90, y: y - 3 },
        thickness: 1,
        color: INK
      });
    y -= 24;
    const by = c.label === 'Robots For All' ? c.words.awardedByRfa : c.label;
    centred(page, by, fonts.regular, fit(by, fonts.regular, 11, w - 50, 8), cx, y);
    y -= 16;
    centred(page, c.date, fonts.regular, 11, cx, y);
    drawQr(page, `${c.site}/verify/#${c.code}`, x0 + 30, y0 + 30, 54);
    page.drawText(c.code, { x: x0 + 94, y: y0 + 52, size: 11, font: fonts.bold, color: INK });
  });
}

/** One PDF: a certificate per item (A4), or badge cards four to a page. */
export async function drawPdf(
  kind: 'certificate' | 'card',
  items: CertificateData[],
  f: Fonts
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = {
    regular: await doc.embedFont(f.regular, { subset: true }),
    bold: await doc.embedFont(f.bold, { subset: true })
  };
  doc.setTitle(
    kind === 'certificate' ? 'Robots For All certificate' : 'Robots For All badge cards'
  );
  doc.setProducer('Robots For All');
  doc.setCreator('Robots For All');
  if (kind === 'certificate') for (const c of items) certificatePage(doc, fonts, c);
  else for (let i = 0; i < items.length; i += 4) cardsPage(doc, fonts, items.slice(i, i + 4));
  return doc.save();
}
