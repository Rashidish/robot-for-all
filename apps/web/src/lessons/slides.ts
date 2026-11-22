// Splits a lesson's rendered HTML into one section per `##` heading, for the slides view.

export interface Section {
  heading: string;
  /** HTML inside the section, without the heading itself. */
  html: string;
}

const stripTags = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

/** Splits HTML at each <h2>. Anything before the first <h2> (e.g. comments) is dropped. */
export function splitSections(html: string): Section[] {
  const parts = html.split(/(?=<h2[\s>])/i).filter((p) => /^<h2[\s>]/i.test(p));
  return parts.map((part) => {
    const end = part.search(/<\/h2>/i);
    const headingHtml = part.slice(part.indexOf('>') + 1, end);
    return { heading: stripTags(headingHtml), html: part.slice(end + 5).trim() };
  });
}
