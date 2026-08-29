// Returns the number of days elapsed since `thenMs` (a stored Date.now()
// timestamp), as of `nowMs` (defaults to now). Used by reviewPrompt.js,
// shareNudge.js and inactivityBanner.js, which each gate a re-engagement
// prompt on "has enough time passed since X" - only this one line of
// arithmetic was duplicated identically across all three; the surrounding
// shape (seed-once-then-wait vs. always-restamp, one-shot vs. repeatable)
// differs enough between them that it wasn't worth forcing into one
// generic gate function.
export function daysSince(thenMs, nowMs = Date.now()) {
  return (nowMs - thenMs) / (1000 * 60 * 60 * 24);
}
