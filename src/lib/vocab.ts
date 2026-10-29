/**
 * Corrects speech-to-text output using a user-supplied list of names and terms.
 * A spoken phrase is replaced with a term only when it is a close spelling match,
 * so ordinary words are left alone.
 */

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Similarity from 0 to 1; 1 means identical once case and punctuation are ignored. */
export function similarity(a: string, b: string) {
  const x = clean(a), y = clean(b);
  if (!x || !y) return 0;
  return 1 - distance(x, y) / Math.max(x.length, y.length);
}

/** Terms are entered one per line or separated by commas. */
export function parseVocabulary(raw: string): string[] {
  return Array.from(new Set(raw.split(/[\n,]/).map((t) => t.trim()).filter((t) => clean(t).length >= 3)));
}

const MIN_SIMILARITY = 0.6;

/** A rough sound key: spellings that sound alike ("Kaufmann", "Coffman") share one key. */
export function soundKey(s: string) {
  const x = clean(s)
    .replace(/ph/g, "f")
    .replace(/gh/g, "")
    .replace(/ck/g, "c")
    .replace(/k/g, "c")
    .replace(/q/g, "c")
    .replace(/(.)\1+/g, "$1");
  return x.slice(0, 1) + x.slice(1).replace(/[aeiouyhw]/g, "");
}

function sounds(a: string, b: string) {
  return clean(a).length >= 5 && soundKey(a) === soundKey(b);
}

export function applyVocabulary(text: string, raw: string): string {
  const terms = parseVocabulary(raw);
  if (!terms.length || !text.trim()) return text;
  const tokens = text.split(/\s+/).filter(Boolean);
  for (const term of terms) {
    const n = term.split(/\s+/).length;
    for (let i = 0; i + n <= tokens.length; i++) {
      const phrase = tokens.slice(i, i + n).join(" ");
      if (phrase === term) continue;
      // Plurals and word endings ("Deadlocks" for "Deadlock") are already correct.
      const a = clean(phrase), b = clean(term);
      if (a !== b && Math.abs(a.length - b.length) <= 2 && (a.startsWith(b) || b.startsWith(a))) continue;
      if (similarity(phrase, term) < MIN_SIMILARITY && !sounds(phrase, term)) continue;
      // Keep punctuation that followed the last spoken word, e.g. "Coffman," stays "Coffman,".
      const trailing = (tokens[i + n - 1].match(/[^a-zA-Z0-9]+$/) || [""])[0];
      tokens.splice(i, n, term + trailing);
    }
  }
  return tokens.join(" ");
}
