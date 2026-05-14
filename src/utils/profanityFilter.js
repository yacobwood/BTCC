export function containsProfanity(text, blacklist) {
  const lower = text.toLowerCase();
  return blacklist.some(w => lower.includes(w.toLowerCase()));
}
