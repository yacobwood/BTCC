const {resolveMentionedAuthorIds} = require('../../functions/chatMentions');

describe('resolveMentionedAuthorIds', () => {
  it('returns empty array when text has no "@" at all', () => {
    const ids = resolveMentionedAuthorIds('hello everyone', {u1: 'Steve'}, 'u2');
    expect(ids).toEqual([]);
  });

  it('returns empty array when authorNames is empty', () => {
    const ids = resolveMentionedAuthorIds('@Steve hi', {}, 'u2');
    expect(ids).toEqual([]);
  });

  it('matches a simple single-word mention', () => {
    const ids = resolveMentionedAuthorIds('@Steve are you at the race?', {u1: 'Steve'}, 'u2');
    expect(ids).toEqual(['u1']);
  });

  it('matches case-insensitively', () => {
    const ids = resolveMentionedAuthorIds('@steve hello', {u1: 'Steve'}, 'u2');
    expect(ids).toEqual(['u1']);
  });

  it('matches a multi-word display name', () => {
    const ids = resolveMentionedAuthorIds('@Jo Smith did you see that overtake', {u1: 'Jo Smith'}, 'u2');
    expect(ids).toEqual(['u1']);
  });

  it('does not match a name that is a substring of a longer word ("Steven" vs "Steve")', () => {
    const ids = resolveMentionedAuthorIds('@Steven nice drive', {u1: 'Steve'}, 'u2');
    expect(ids).toEqual([]);
  });

  it('matches at end of string with no trailing boundary character', () => {
    const ids = resolveMentionedAuthorIds('nice one @Steve', {u1: 'Steve'}, 'u2');
    expect(ids).toEqual(['u1']);
  });

  it('matches when followed by punctuation', () => {
    const ids = resolveMentionedAuthorIds('@Steve! great lap', {u1: 'Steve'}, 'u2');
    expect(ids).toEqual(['u1']);
  });

  it('excludes the sender - no self-notify', () => {
    const ids = resolveMentionedAuthorIds('@Steve talking to myself', {u1: 'Steve'}, 'u1');
    expect(ids).toEqual([]);
  });

  it('resolves multiple distinct mentions in one message', () => {
    const ids = resolveMentionedAuthorIds('@Steve and @Jane, check this out', {u1: 'Steve', u2: 'Jane'}, 'u3');
    expect(ids.sort()).toEqual(['u1', 'u2']);
  });

  it('prefers the longest matching name over a shorter overlapping one ("Jo Smith" over "Jo")', () => {
    const ids = resolveMentionedAuthorIds('@Jo Smith nice one', {u1: 'Jo', u2: 'Jo Smith'}, 'u3');
    expect(ids).toEqual(['u2']);
  });

  it('does not also match the shorter name once the longer one has matched', () => {
    // Regression: independently scanning each candidate would match both
    // "Jo" and "Jo Smith" for the same "@Jo Smith" - only the longest should win.
    const ids = resolveMentionedAuthorIds('@Jo Smith', {u1: 'Jo', u2: 'Jo Smith'}, 'u3');
    expect(ids).not.toContain('u1');
  });

  it('notifies every authorId tied for the longest match on a genuine duplicate name', () => {
    const ids = resolveMentionedAuthorIds('@Steve hello', {u1: 'Steve', u2: 'Steve'}, 'u3');
    expect(ids.sort()).toEqual(['u1', 'u2']);
  });

  it('ignores a bare "@" with no matching name after it', () => {
    const ids = resolveMentionedAuthorIds('email me at @ if you want', {u1: 'Steve'}, 'u2');
    expect(ids).toEqual([]);
  });

  it('returns an empty array for null/undefined text', () => {
    expect(resolveMentionedAuthorIds(null, {u1: 'Steve'}, 'u2')).toEqual([]);
    expect(resolveMentionedAuthorIds(undefined, {u1: 'Steve'}, 'u2')).toEqual([]);
  });

  it('handles a falsy/missing authorNames map gracefully', () => {
    expect(resolveMentionedAuthorIds('@Steve hi', null, 'u2')).toEqual([]);
    expect(resolveMentionedAuthorIds('@Steve hi', undefined, 'u2')).toEqual([]);
  });

  it('does not match a mention appearing only inside another word with no boundary', () => {
    const ids = resolveMentionedAuthorIds('joe@example.com is my email', {u1: 'example.com'}, 'u2');
    // "@example.com" is followed by nothing but preceded by "joe" - still a valid match
    // since only the character AFTER the name is checked, matching current reply-prefill behaviour.
    expect(ids).toEqual(['u1']);
  });
});
