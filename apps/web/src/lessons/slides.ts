// Splits a lesson's rendered HTML into one section per `##` heading, for the slides view.

export interface Section {
  heading: string;
  /** HTML inside the section, without the heading itself. */
  html: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

/**
 * Turns heading HTML into plain text. Safe by construction: tags are removed until none are
 * left, entities are decoded in a single pass (no double decoding), and any remaining angle
 * brackets are dropped, so the result can never form a tag. It is also escaped again on output.
 */
export function headingText(html: string): string {
  let text = html;
  let previous;
  do {
    previous = text;
    text = text.replace(/<[^<>]*>/g, '');
  } while (text !== previous);
  return text
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, name: string) => ENTITIES[name] ?? '')
    .replace(/[<>]/g, '')
    .trim();
}

/** Splits HTML at each <h2>. Anything before the first <h2> (e.g. comments) is dropped. */
export function splitSections(html: string): Section[] {
  const parts = html.split(/(?=<h2[\s>])/i).filter((p) => /^<h2[\s>]/i.test(p));
  return parts.map((part) => {
    const end = part.search(/<\/h2>/i);
    const headingHtml = part.slice(part.indexOf('>') + 1, end);
    return { heading: headingText(headingHtml), html: part.slice(end + 5).trim() };
  });
}
