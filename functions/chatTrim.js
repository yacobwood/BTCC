// Pure helper for trimChat (functions/index.js) - decides which chat
// messages to delete. Extracted into its own file (same pattern as
// chatMentions.js / newsCheck.js / sessionAlerts.js) so the two rules can be
// unit tested without pulling in index.js's unconditional initializeApp()
// call at module load time, and without needing a live "now" - Date.now()
// is passed in rather than read internally.
//
// Two independent caps apply together: a message is kept only if it is
// both newer than MAX_AGE_MS old AND among the newest MAX_MESSAGES overall.
// `entries` must be ordered oldest-first (matches RTDB's
// orderByChild('timestamp') query order) so "the oldest of what's left"
// after the age cut is a simple slice from the front.
const MAX_MESSAGES = 200;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function selectMessagesToTrim(entries, now) {
  const cutoff = now - MAX_AGE_MS;
  const toDelete = new Set();

  for (const {key, timestamp} of entries) {
    if (timestamp < cutoff) toDelete.add(key);
  }

  const remaining = entries.filter(e => !toDelete.has(e.key));
  if (remaining.length > MAX_MESSAGES) {
    remaining.slice(0, remaining.length - MAX_MESSAGES).forEach(e => toDelete.add(e.key));
  }

  return Array.from(toDelete);
}

module.exports = {selectMessagesToTrim, MAX_MESSAGES, MAX_AGE_MS};
