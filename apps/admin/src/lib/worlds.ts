// Content → Worlds & courses (more content spec §2.2): read a world file's review status and
// change only its status lines ("status", "reviewed_by", "build_tested_by"), keeping everything
// else byte-for-byte (ADR-0012 condition 2).
import type { StatusChange } from './kinds';

export interface WorldSummary {
  id: string;
  title: string;
  status: 'draft' | 'in_review' | 'published';
  reviewedBy: string | null;
  buildTestedBy: string | null;
  /** A course has missions and points; a launch world doesn't. */
  isCourse: boolean;
}

const STATUS_LINE = /^\s*"(status|reviewed_by|build_tested_by)":/;

export function summariseWorld(
  id: string,
  text: string,
  names: Record<string, string> = {}
): WorldSummary {
  const spec = JSON.parse(text) as Record<string, unknown>;
  const name = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  const status = spec['status'];
  return {
    id,
    title: names[`world_${id.replaceAll('-', '_')}_name`] ?? id,
    status: status === 'in_review' || status === 'published' ? status : 'draft',
    reviewedBy: name(spec['reviewed_by']),
    buildTestedBy: name(spec['build_tested_by']),
    isCourse: Array.isArray(spec['missions'])
  };
}

/** The world file with new status lines; throws if a line is missing (content files have all three). */
export function withWorldStatus(text: string, change: StatusChange): string {
  let out = text;
  const set = (key: string, value: string | null) => {
    const re = new RegExp(`^(\\s*)"${key}":.*?(,?)$`, 'm');
    if (!re.test(out)) throw new Error(`world file has no "${key}" line`);
    out = out.replace(
      re,
      (_m, indent: string, comma: string) => `${indent}"${key}": ${JSON.stringify(value)}${comma}`
    );
  };
  if (change.status !== undefined) set('status', change.status);
  if (change.reviewedBy !== undefined) set('reviewed_by', change.reviewedBy?.trim() ?? null);
  if (change.buildTestedBy !== undefined)
    set('build_tested_by', change.buildTestedBy?.trim() ?? null);
  JSON.parse(out); // still valid JSON
  return out;
}

/** True when two versions of a world file differ only in the status lines. */
export function onlyWorldStatusChanged(before: string, after: string): boolean {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length !== b.length) return false;
  return a.every(
    (line, i) => line === b[i] || (STATUS_LINE.test(line) && STATUS_LINE.test(b[i] ?? ''))
  );
}
