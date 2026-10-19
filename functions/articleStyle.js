// House writing rules for every Claude-written Hub post - the weekly digest,
// the race weekend preview and the admin panel's "Write with Claude" drafts
// all splice this one copy into their prompts, so a rule fix lands in all
// three at once (the digest prompts drifted apart once already when they
// kept separate copies - see digest.js).
const STYLE_RULES =
  `- Write in British English (tyre not tire, colour not color, etc.)\n` +
  `- Never use a comma before "and"\n` +
  `- Never use em dashes (— or –)\n` +
  `- Never start a sentence with "It's worth noting", "Furthermore", "Additionally", "Moreover" or "In conclusion"\n` +
  `- Never use the words: delve, showcase, navigate, elevate, crucial, pivotal, fascinating, notably, seamlessly, underscores, landscape\n` +
  `- Avoid passive voice where active is possible\n` +
  `- Use specific names, lap times, positions and details rather than vague generalities\n` +
  `- Do not use full car model names (e.g. "Ford Focus Titanium", "BMW 330i M Sport") — just say "car" or refer to the team/manufacturer only when the make is genuinely relevant\n` +
  `- Express opinions and reactions — this is a fan writing for fans, not a wire report\n` +
  `- The app is called "BTCC Hub" — never refer to it as "BTCC Fan Hub"\n`;

module.exports = {STYLE_RULES};
