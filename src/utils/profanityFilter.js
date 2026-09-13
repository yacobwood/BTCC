// Common leetspeak/punctuation substitutions used to dodge a naive
// substring filter. Deliberately small and conservative - this is
// proportionate hardening against the obvious bypasses (a swapped digit,
// an inserted dot/dash/underscore, spacing a word out letter by letter),
// not an attempt at full Unicode confusable/homoglyph detection (a much
// bigger undertaking with real false-positive risk).
const LEET_MAP = {'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '@': 'a', '$': 's'};
const LEET_RE = /[01345@$]/g;

// Punctuation commonly inserted *within* a single typed word to dodge a
// substring check (e.g. "f.u.c.k", "f-u-c-k", "f_u_c_k", "f*u*c*k").
// Stripped only inside one whitespace-delimited token, never across
// tokens - see the "hidden" flag/whitespace approach in
// containsProfanity for why crossing token boundaries is unsafe.
const INTRA_WORD_PUNCT_RE = /[.\-_*]/g;

function normalizeToken(token) {
  return token.replace(INTRA_WORD_PUNCT_RE, '').replace(LEET_RE, ch => LEET_MAP[ch] || ch);
}

export function containsProfanity(text, blacklist) {
  const lower = text.toLowerCase();

  // Fast path: plain substring check - unchanged from before, so every
  // already-passing case (including deliberately-allowed substring
  // matches like "thebadwordishere") keeps its exact existing behavior.
  if (blacklist.some(w => lower.includes(w.toLowerCase()))) return true;

  const tokens = lower.split(/\s+/);

  // Per-token normalization catches a punctuated single word
  // ("f.u.c.k", "5hit", "a55") without ever touching whitespace between
  // *different* words - that's what keeps ordinary text like "call at 5,
  // hit me up" or "meet at 3pm" from being merged into a false match.
  const normalizedTokens = tokens.map(normalizeToken);

  // A word spaced out letter by letter ("f u c k") arrives as a run of
  // single-character tokens. Collapsing only runs of length-1 tokens
  // reconstructs that word while leaving ordinary short words ("at",
  // "is", "ok") - which are never length 1 - untouched, so they're never
  // merged with a neighbour.
  const mergedTokens = [];
  let run = '';
  for (const t of tokens) {
    if (t.length === 1) {
      run += t;
    } else {
      if (run) { mergedTokens.push(run); run = ''; }
      mergedTokens.push(t);
    }
  }
  if (run) mergedTokens.push(run);
  const normalizedMerged = mergedTokens.map(normalizeToken);

  const candidates = [...normalizedTokens, ...normalizedMerged];
  return blacklist.some(w => {
    const nw = w.toLowerCase();
    return candidates.some(tok => tok.includes(nw));
  });
}
