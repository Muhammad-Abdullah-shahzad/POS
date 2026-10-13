/**
 * Smart product search: finds products from the words typed, in any order,
 * forgiving a small typo, best matches first.
 *
 *   "1 1/2 grey 40d" finds `1 1/2" Bend 90d, 45d (Grey) Popular`: each word
 *   is matched on its own, and 40d is one keystroke from 45d. Products that
 *   match most of the words (`1 1/2" Bend Long Radius (Grey)`) follow it.
 *
 * Sizes stay exact. `1 1/2` and `1-1/2` are one size, so searching 1/2 never
 * lists 1-1/2" items, and sizes are never typos of each other (1/2 and 1/4,
 * 25mm and 20mm).
 * A product may miss one typed word in three, but never a typed size.
 *
 * Rules, per typed word, against the words of the product's name:
 *   - the same word, or the start of one ("elb" finds Elbow);
 *   - one keystroke off, for words of 4+ characters, or 3 with a digit (40d);
 *   - only when nothing at all matches that way: the word inside another
 *     ("x24" inside 1/2x24), or the whole query anywhere in the name.
 * Products matching more of the typed words come first. A barcode or SKU
 * that is the query comes before everything; one starting with it counts as a
 * full match.
 *
 * Pure and dependency-free: the server (server/services/smartSearch.ts) and the
 * desktop till (electron/src/search/smartSearch.ts) run this same file, and a
 * server test fails if the two copies differ.
 */

export interface Searchable {
  name?: unknown;
  barcode?: unknown;
  sku?: unknown;
}

/** Points for how a typed word matched a word of the name. */
const EXACT = 3;
const STARTS = 2;
const NEAR = 1;
const INSIDE = 1;
/** Sizes lead product names ("25mm Clamp Duraflow"), so matching the name's first word counts extra. */
const LEADS = 2;
/** Words found in the order typed. */
const IN_ORDER = 0.5;

const LETTER = /\p{L}/u;
const DIGIT = /\d/;

/** A size or plain number (1/2, 1-1/2, 25, 25mm): a product without it is a different size, not a near match. */
const isSize = (word: string) => /^\d[\d./-]*(mm|cm|m|ft|in|inch)?$/.test(word);

/** Lower case words, punctuation dropped, a whole number and a fraction joined into one size. */
export function searchWords(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}/.-]+/gu, ' ')
      // 1 1/2, 1-1/2 (and 1 1/ while typing) are all the size "1-1/2".
      .replace(/(^|\s)(\d+)[\s-]+(\d+\/\d*)/g, '$1$2-$3')
      .split(/\s+/)
      .map((word) => word.replace(/^[./-]+|[.-]+$/g, ''))
      .filter(Boolean)
  );
}

/** Whether one edit (insert, delete, replace, or swap two neighbours) or none turns `a` into `b`. Linear time. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) {
    if (i === a.length || a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Whether at most `max` edits turn `a` into `b`; stops as soon as that is impossible. */
function withinEdits(a: string, b: string, max: number): boolean {
  if (max <= 1) return withinOneEdit(a, b);
  if (Math.abs(a.length - b.length) > max) return false;
  let before = new Array<number>(b.length + 1);
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      let cost = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cost = Math.min(cost, before[j - 2] + 1);
      current[j] = cost;
      best = Math.min(best, cost);
    }
    if (best > max) return false;
    before = previous;
    previous = current;
  }
  return previous[b.length] <= max;
}

/** Words that may be typos: 4+ characters, or 3 with a digit (40d); never a size (25mm is not 20mm). */
const mayBeTypo = (typed: string) =>
  (typed.length >= 4 || (typed.length === 3 && DIGIT.test(typed))) && !typed.includes('/') && LETTER.test(typed) && !isSize(typed);

/** Whether a typed word (one that `mayBeTypo`) is a typo of a name word, which must be as long: "bend" is not "end". */
function isNear(typed: string, word: string): boolean {
  if (!mayBeTypo(word)) return false;

  const allowed = typed.length >= 8 ? 2 : 1;
  if (withinEdits(typed, word, allowed)) return true;
  // A typo in a word still being typed: "durfl" for Duraflow.
  if (typed.length < 4) return false;
  return [typed.length - 1, typed.length, typed.length + 1].some(
    (length) => length >= 3 && length < word.length && withinEdits(typed, word.slice(0, length), allowed)
  );
}

function wordPoints(typed: string, typo: boolean, word: string, allowInside: boolean): number {
  if (word === typed) return EXACT;
  if (word.startsWith(typed)) return STARTS;
  if (typo && isNear(typed, word)) return NEAR;
  if (allowInside && typed.length >= 2 && word.includes(typed)) return INSIDE;
  return 0;
}

/** Typed words a product may miss and still be listed: one in three. Never a size. */
const wordsNeeded = (typed: number) => typed - Math.floor(typed / 3);

/** Each name's words, worked out once: the same catalogue is searched on every keystroke. */
const wordsOfName = new Map<string, string[]>();
const WORDS_CACHED = 50_000;

function nameWords(name: string): string[] {
  let words = wordsOfName.get(name);
  if (!words) {
    if (wordsOfName.size >= WORDS_CACHED) wordsOfName.clear();
    words = searchWords(name);
    wordsOfName.set(name, words);
  }
  return words;
}

interface Scored<T> {
  item: T;
  /** 1 when the barcode or SKU is exactly the query: listed first. */
  codeExact: number;
  /** Typed words the product matched: products matching more come first. */
  matched: number;
  /** How well each typed word matched (0 if it did not). */
  perWord: number[];
  /** Points beyond the words: order, the size up front, the barcode. */
  bonus: number;
  /** perWord weighted by how rare each word is, plus bonus: set when ranking. */
  points: number;
  words: number;
  name: string;
}

function score<T extends Searchable>(
  item: T,
  typedWords: string[],
  typoAllowed: boolean[],
  code: string,
  allowInside: boolean
): Scored<T> | null {
  const name = String(item.name ?? '');
  const words = nameWords(name);
  const used = new Set<number>();
  const perWord = typedWords.map(() => 0);
  let bonus = 0;
  let matched = 0;
  let lastIndex = -1;
  let missedSize = false;

  typedWords.forEach((typed, position) => {
    const typo = typoAllowed[position];
    let best = 0;
    let bestIndex = -1;
    words.forEach((word, index) => {
      if (used.has(index)) return;
      const found = wordPoints(typed, typo, word, allowInside);
      if (found > best) {
        best = found;
        bestIndex = index;
      }
    });
    if (bestIndex < 0) {
      if (isSize(typed)) missedSize = true;
      return;
    }

    used.add(bestIndex);
    matched += 1;
    perWord[position] = best;
    if (bestIndex > lastIndex) bonus += IN_ORDER;
    lastIndex = bestIndex;
  });
  if (used.has(0)) bonus += LEADS;

  let found = !missedSize && matched >= wordsNeeded(typedWords.length);
  if (!found) {
    matched = 0;
    perWord.fill(0);
    bonus = 0;
    // The last resort: the query as typed, anywhere in the name.
    if (allowInside && name.toLowerCase().includes(code)) {
      found = true;
      matched = typedWords.length;
      bonus = INSIDE;
    }
  }

  // A barcode or SKU starting with the query (or, as a last resort, containing it) counts as a full match.
  const codes = [item.barcode, item.sku].map((value) => String(value ?? '').toLowerCase()).filter(Boolean);
  const codeExact = codes.some((value) => value === code) ? 1 : 0;
  const codePoints = codeExact
    ? EXACT
    : codes.some((value) => value.startsWith(code))
      ? STARTS
      : allowInside && code.length >= 2 && codes.some((value) => value.includes(code))
        ? INSIDE
        : 0;
  if (codePoints > 0) {
    if (!found) matched = typedWords.length;
    found = true;
    bonus += codePoints;
  }

  return found ? { item, codeExact, matched, perWord, bonus, points: 0, words: words.length, name } : null;
}

/** Numbers in names sort by value, so 3" comes before 24". */
const naturalOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function rank<T extends Searchable>(items: readonly T[], typedWords: string[], code: string, allowInside: boolean): T[] {
  const typoAllowed = typedWords.map(mayBeTypo);
  const found = items
    .map((item) => score(item, typedWords, typoAllowed, code, allowInside))
    .filter((entry): entry is Scored<T> => entry !== null);

  // A rare word says more than a common one: "tee" picks a product, "popular" (a brand on hundreds) barely does.
  const weights = typedWords.map((_, position) => {
    const having = found.filter((entry) => entry.perWord[position] > 0).length;
    return 1 + Math.log((found.length + 1) / (having + 1));
  });
  for (const entry of found) {
    entry.points = entry.bonus + entry.perWord.reduce((sum, points, position) => sum + points * weights[position], 0);
  }

  return found
    .sort(
      (a, b) =>
        b.codeExact - a.codeExact ||
        b.matched - a.matched ||
        b.points - a.points ||
        a.words - b.words ||
        naturalOrder.compare(a.name, b.name)
    )
    .map((entry) => entry.item);
}

/** The products matching `query`, best first. Matches inside words only count when nothing else matches. */
export function rankProducts<T extends Searchable>(items: readonly T[], query: string): T[] {
  const code = query.trim().toLowerCase();
  if (!code) return [];

  const typedWords = searchWords(query);
  const found = rank(items, typedWords, code, false);
  return found.length > 0 ? found : rank(items, typedWords, code, true);
}
