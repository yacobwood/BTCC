import {containsProfanity} from '../../src/utils/profanityFilter';

describe('containsProfanity', () => {
  // ── Clean text ────────────────────────────────────────────────────────────────

  it('returns false for clean text with a non-empty blacklist', () => {
    expect(containsProfanity('Great race today!', ['badword', 'slur'])).toBe(false);
  });

  it('returns false for empty blacklist', () => {
    expect(containsProfanity('absolutely anything', [])).toBe(false);
  });

  it('returns false for empty text with a non-empty blacklist', () => {
    expect(containsProfanity('', ['badword'])).toBe(false);
  });

  it('returns false for empty text and empty blacklist', () => {
    expect(containsProfanity('', [])).toBe(false);
  });

  // ── Exact word match ──────────────────────────────────────────────────────────

  it('returns true for exact word match', () => {
    expect(containsProfanity('badword', ['badword'])).toBe(true);
  });

  it('returns true when blacklisted word appears at the start of text', () => {
    expect(containsProfanity('badword is here', ['badword'])).toBe(true);
  });

  it('returns true when blacklisted word appears at the end of text', () => {
    expect(containsProfanity('this is a badword', ['badword'])).toBe(true);
  });

  it('returns true when blacklisted word appears in the middle of text', () => {
    expect(containsProfanity('this badword here', ['badword'])).toBe(true);
  });

  // ── Substring match ───────────────────────────────────────────────────────────

  it('returns true when blacklisted word is embedded in a longer word', () => {
    // containsProfanity uses includes(), so it matches substrings
    expect(containsProfanity('thebadwordishere', ['badword'])).toBe(true);
  });

  it('returns true for partial word match at word boundary', () => {
    expect(containsProfanity('superbadword', ['badword'])).toBe(true);
  });

  // ── Case insensitivity ────────────────────────────────────────────────────────

  it('returns true when text is uppercase and blacklist is lowercase', () => {
    expect(containsProfanity('BADWORD', ['badword'])).toBe(true);
  });

  it('returns true when text is mixed case and blacklist is lowercase', () => {
    expect(containsProfanity('BadWord', ['badword'])).toBe(true);
  });

  it('returns true when blacklist word is uppercase and text is lowercase', () => {
    expect(containsProfanity('badword', ['BADWORD'])).toBe(true);
  });

  it('is case-insensitive for both text and blacklist in mixed scenarios', () => {
    expect(containsProfanity('This is a BaDwOrD message', ['badword'])).toBe(true);
  });

  // ── Multiple blacklist words ───────────────────────────────────────────────────

  it('returns true when any one of multiple blacklist words matches', () => {
    expect(containsProfanity('this is clean except slur', ['badword', 'slur', 'another'])).toBe(true);
  });

  it('returns true when the first blacklist word matches', () => {
    expect(containsProfanity('badword is here', ['badword', 'slur'])).toBe(true);
  });

  it('returns true when the last blacklist word matches', () => {
    expect(containsProfanity('text with slur at end', ['badword', 'slur'])).toBe(true);
  });

  it('returns false when text is clean against all words in a large blacklist', () => {
    const blacklist = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    expect(containsProfanity('clean and pleasant message', blacklist)).toBe(false);
  });

  // ── Real-world blacklist words matching app defaults ──────────────────────────

  it('returns true for "fuck" (default blacklist word)', () => {
    expect(containsProfanity('what the fuck', ['fuck', 'shit', 'damn'])).toBe(true);
  });

  it('returns true for "shit" (default blacklist word)', () => {
    expect(containsProfanity('oh shit', ['fuck', 'shit', 'damn'])).toBe(true);
  });

  it('returns true for "damn" (default blacklist word)', () => {
    expect(containsProfanity('damn this race', ['fuck', 'shit', 'damn'])).toBe(true);
  });

  it('returns false for text with no match against app default blacklist', () => {
    expect(containsProfanity('What an exciting race weekend!', ['fuck', 'shit', 'damn'])).toBe(false);
  });

  // ── Obfuscation hardening ─────────────────────────────────────────────────────
  // A single inserted space, a punctuation mark, or a leetspeak substitution used
  // to defeat a plain substring check must now be caught.

  it('catches a spaced-out blacklisted word ("f u c k")', () => {
    expect(containsProfanity('f u c k off', ['fuck'])).toBe(true);
  });

  it('catches a dot-punctuated blacklisted word ("f.u.c.k")', () => {
    expect(containsProfanity('f.u.c.k', ['fuck'])).toBe(true);
  });

  it('catches a hyphen-punctuated blacklisted word ("f-u-c-k")', () => {
    expect(containsProfanity('f-u-c-k', ['fuck'])).toBe(true);
  });

  it('catches an underscore-punctuated blacklisted word ("f_u_c_k")', () => {
    expect(containsProfanity('f_u_c_k', ['fuck'])).toBe(true);
  });

  it('catches an asterisk-punctuated blacklisted word ("f*u*c*k")', () => {
    expect(containsProfanity('f*u*c*k', ['fuck'])).toBe(true);
  });

  it('catches a leetspeak substitution ("5hit" for "shit")', () => {
    expect(containsProfanity('what 5hit is this', ['shit'])).toBe(true);
  });

  it('catches a leetspeak substitution ("a55" for "ass")', () => {
    expect(containsProfanity('you a55', ['ass'])).toBe(true);
  });

  it('catches combined spacing + leetspeak ("5 h 1 t")', () => {
    // Exercises both hardenings on the same token: the merge step
    // reconstructs "5h1t" from the spaced-out single-character run, then
    // normalizeToken's leet substitution turns it into "shit".
    expect(containsProfanity('what 5 h 1 t is this', ['shit'])).toBe(true);
  });

  // ── No over-aggressive false positives ───────────────────────────────────────
  // Ordinary chat text that happens to contain digits/punctuation as part of
  // normal words must still pass through clean - the obfuscation handling above
  // must never merge separate, unrelated words together.

  it('does not flag ordinary text with incidental digits ("at 3pm")', () => {
    expect(containsProfanity("let's meet at 3pm for practice", ['fuck', 'shit', 'damn', 'ass'])).toBe(false);
  });

  it('merging a benign run of single-letter tokens does not false-positive against an unrelated blacklist', () => {
    // "a b c" genuinely does get concatenated into "abc" by the run-merge
    // step (that's the intended mechanism, not a bug) - this just confirms
    // that concatenation alone isn't enough to flag anything unless the
    // result actually matches a blacklisted word.
    expect(containsProfanity('learning my a b c already', ['fuck', 'shit', 'damn', 'ass'])).toBe(false);
  });

  it('does not merge unrelated words across a number into a false match ("at 5, hit me up")', () => {
    expect(containsProfanity('call me at 5, hit me up after', ['shit'])).toBe(false);
  });
});
