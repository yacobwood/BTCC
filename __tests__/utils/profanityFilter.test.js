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
});
