// Pure helper for onChatMention (functions/index.js) - resolves which chat
// participants are @mentioned in a message's text, by name-matching against
// the live /chat/authorNames map. Extracted into its own file (same pattern
// as newsCheck.js / sessionAlerts.js) so it can be unit tested without
// pulling in index.js's unconditional initializeApp() call at module load
// time.
//
// Matching is plain-text, not regex-built-from-name, deliberately: display
// names can contain punctuation and spaces (up to 30 chars per
// database.rules.json) that would need escaping to use safely inside a
// RegExp, and names are not guaranteed unique across authorIds for
// anonymous users who never claimed a username (see project_chat.md
// memory) - two people can legitimately share a display name. On a
// collision every matching authorId is notified rather than none, since a
// missed mention defeats the point of the feature more than an occasional
// extra ping to a namesake does.
//
// At each "@" in the text, the longest registered name that fits wins -
// this stops "@Jo Smith" from also separately matching a shorter "Jo"
// registered by someone else - and a match only counts when followed by a
// non-name character or end of string, so "@Steven" never matches a
// registered "Steve". Names tied for that longest length (genuine
// duplicate display names) are all matched.
function resolveMentionedAuthorIds(text, authorNames, senderId) {
  if (!text || !text.includes('@')) return [];

  const lowerText = text.toLowerCase();
  const candidates = Object.entries(authorNames || {})
    .filter(([authorId, name]) => authorId !== senderId && name)
    .map(([authorId, name]) => [authorId, name.toLowerCase()])
    .sort((a, b) => b[1].length - a[1].length);

  const matched = new Set();
  let i = 0;
  while (i < lowerText.length) {
    if (lowerText[i] !== '@') { i++; continue; }

    let bestLen = -1;
    for (const [authorId, lowerName] of candidates) {
      if (bestLen !== -1 && lowerName.length < bestLen) break; // sorted desc - no more ties possible
      const end = i + 1 + lowerName.length;
      if (lowerText.slice(i + 1, end) !== lowerName) continue;
      const after = lowerText[end];
      if (after !== undefined && /[a-z0-9]/i.test(after)) continue; // e.g. "Steve" inside "Steven"
      matched.add(authorId);
      bestLen = lowerName.length;
    }
    i += bestLen === -1 ? 1 : 1 + bestLen;
  }
  return Array.from(matched);
}

module.exports = {resolveMentionedAuthorIds};
