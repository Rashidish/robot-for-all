// JSON as the repository's formatter (Prettier) writes it, so files the back office rewrites pass
// CI's format check: two-space indent, objects one key per line, and lists of plain values (text,
// numbers, true/false, null) on one line when they fit in 100 characters.

const WIDTH = 100;

function render(value: unknown, indent: string, prefixLength: number): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every((v) => v === null || typeof v !== 'object')) {
      const one = `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
      if (prefixLength + one.length + 1 <= WIDTH) return one;
    }
    return `[\n${value.map((v) => inner + render(v, inner, inner.length)).join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  return `{\n${entries
    .map(([k, v]) => {
      const head = `${inner}${JSON.stringify(k)}: `;
      return head + render(v, inner, head.length);
    })
    .join(',\n')}\n${indent}}`;
}

export const prettyJson = (value: unknown): string => `${render(value, '', 0)}\n`;
