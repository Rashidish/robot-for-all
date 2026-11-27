// The answer check (spec §6, FR-11, FR-13, FR-16): every answer and every Common question passes
// it before anyone sees it. A sentence that mentions something we never advise is allowed only
// when it warns against it ("never use mains", "an adult must cut this"); otherwise the whole
// answer is replaced by the safe message. Links are taken out; long answers are cut at a sentence.

interface Rule {
  name: string;
  pattern: RegExp;
  /** Allowed in a sentence that says an adult must do or help with it (blades, hot glue). */
  adultOk?: boolean;
}

// A warning comes just before the term ("never use mains", "don't use coin cells") or says it is
// dangerous just after ("mains is dangerous").
const NEG_BEFORE =
  /\b(never|don't|do not|not|no|avoid|stay away from|keep away from|ungalokothi|musa|ungasebenzisi)\b[^.!?]{0,40}$/i;
const DANGER_AFTER = /^[^.!?]{0,60}\b(dangerous|unsafe|not safe|not allowed|can kill|can burn)\b/i;
const ADULT = /\b(adult|grown-up|teacher|parent|umuntu omdala|uthisha|umzali)\b/i;

const RULES: Rule[] = [
  {
    name: 'mains',
    pattern:
      /\b(mains|wall (?:plug|socket|outlet)|plug (?:it )?into the wall|power point|220 ?v|230 ?v|240 ?v|eskom supply|extension cord|ugesi wasendlini)\b/i
  },
  {
    name: 'coin cell',
    pattern: /\b(coin cells?|button cells?|button batter(?:y|ies)|cr ?20\d\d|lr ?44)\b/i
  },
  {
    name: 'lithium',
    pattern:
      /\b(open|cut|pierce|puncture|heat|charge|recharge|modify|take apart)\b[^.!?]{0,40}\b(lithium|li-?ion|lipo|18650)\b|\b(lithium|li-?ion|lipo|18650)\b[^.!?]{0,40}\b(open|cut|pierce|puncture|heat|charge|recharge|modify|take apart)\b/i
  },
  {
    name: 'fire or chemicals',
    pattern:
      /\b(lighter|box of matches|light a match|candle|open flame|burn it|bleach|battery acid|petrol|paraffin|methylated spirits?)\b/i
  },
  {
    name: 'blades',
    pattern:
      /\b(craft knife|box cutter|razor blade|scalpel|stanley knife|utility knife|hot glue|soldering iron|knife)\b/i,
    adultOk: true
  }
];

function breaks(rule: Rule, sentence: string): boolean {
  const m = rule.pattern.exec(sentence);
  if (!m) return false;
  const before = sentence.slice(0, m.index);
  const after = sentence.slice(m.index);
  if (NEG_BEFORE.test(before) || DANGER_AFTER.test(after)) return false;
  if (rule.adultOk && ADULT.test(sentence)) return false;
  return true;
}

const LINK =
  /\[([^\]]+)\]\((?:[^)]+)\)|\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|org|net|co\.za|org\.za|io|ly|gov\.za)(?:\/\S*)?/gi;

export interface Checked {
  text: string;
  /** The answer broke a rule and was replaced (counted as "blocked"). */
  blocked: boolean;
  rule?: string;
}

const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim());

/** Checks an answer; maxChars cuts it at the last full sentence that fits. */
export function checkAnswer(text: string, maxChars: number): Checked {
  const clean = text.replace(LINK, (_m, label: string | undefined) => label ?? '').trim();
  for (const sentence of sentences(clean)) {
    for (const rule of RULES) {
      if (breaks(rule, sentence)) {
        return { text: '', blocked: true, rule: rule.name };
      }
    }
  }
  if (!clean) return { text: '', blocked: true, rule: 'empty' };
  if (clean.length <= maxChars) return { text: clean, blocked: false };
  let out = '';
  for (const s of sentences(clean)) {
    if ((out + ' ' + s).trim().length > maxChars) break;
    out = (out + ' ' + s).trim();
  }
  return { text: out || clean.slice(0, maxChars), blocked: false };
}

// A child's question that sounds like they may be hurt, scared or unsafe (spec §7.2). Answered at
// once with the trusted-adult and Childline message; the AI is not asked.
const DISTRESS =
  /\b(hurts? me|hit(?:s|ting)? me|beat(?:s|ing)? me|touch(?:es|ed|ing)? me|abus\w*|scared (?:at|of going) home|afraid (?:at|of going) home|kill myself|hurt myself|want to die|no one loves me|nobody loves me|runaway|run away from home|bully(?:ing)? me|ngiyashaywa|ngesaba ekhaya)\b/i;

export const soundsUnsafe = (question: string): boolean => DISTRESS.test(question);
