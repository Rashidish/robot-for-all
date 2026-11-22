// "My programs": saved in this browser only (M3 spec FR-9, §8). No accounts, nothing uploaded.
// Each entry keeps Blockly's own workspace JSON, so block positions and loose blocks come back
// exactly as the learner left them.

export const STORAGE_KEY = 'rfa-code-v1';

export interface SavedProgram {
  id: string;
  name: string;
  updated: number;
  workspace: unknown;
}

export interface ProgramStore {
  current: string | null;
  programs: Record<string, SavedProgram>;
}

const empty = (): ProgramStore => ({ current: null, programs: {} });

/** Reads the store; anything unreadable counts as empty (storage can be blocked or cleared). */
export function loadStore(storage: Pick<Storage, 'getItem'> | undefined): ProgramStore {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw) as ProgramStore;
    if (typeof data !== 'object' || data === null || typeof data.programs !== 'object')
      return empty();
    return {
      current: typeof data.current === 'string' ? data.current : null,
      programs: data.programs
    };
  } catch {
    return empty();
  }
}

/** Saves the store; returns false if the browser refused (full or blocked). */
export function saveStore(
  storage: Pick<Storage, 'setItem'> | undefined,
  store: ProgramStore
): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(store));
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function newId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Programs, newest first. */
export function listPrograms(store: ProgramStore): SavedProgram[] {
  return Object.values(store.programs).sort((a, b) => b.updated - a.updated);
}
