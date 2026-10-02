// 2026 BTCC team livery colours, keyed by the exact team string as it
// appears in results2026.json's `race.results[].team` / `race.grid[].team`
// (confirmed against the real 2026 field - 9 teams). Researched against
// official team reveal photos/articles, not guessed - see the per-team
// note for each one's actual confidence.
//
// Three teams (LKQ Euro Car Parts with Power Maxed Racing, WSR, Steel Seal
// with Power Maxed Racing) are genuinely white-bodied cars in real life -
// plotted as literal white they'd be indistinguishable from each other on
// a chart, so those three use a secondary livery colour instead. Likewise,
// the app's chart surface is dark, so literal black (CPRL's and Restart
// Racing's real body colour) would be invisible rather than just "a
// colour" - both use a secondary livery colour too, per explicit user
// preference (no literal black at all, not only to avoid a CPRL/Restart
// clash). Those accent values are a best-effort colour pick from a
// *descriptive* source (e.g. "green/teal pinstripe"), not a hex-confirmed
// swatch - worth eyeballing live and adjusting, unlike the primary-body
// entries below which are directly confirmed against photos.
export const TEAM_COLORS = {
  // CPRL's current (post Aug-2026 rebrand) body colour is black, unusable
  // here (see above) - per explicit user instruction, uses its earlier
  // "Plato Racing" purple instead, rather than falling back to the
  // categorical palette. Exact hex is this author's own pick for "a rich
  // Plato purple", not sourced from a confirmed swatch - worth checking
  // live against the real thing.
  'CPRL': '#7B2D8E',
  'NAPA Racing UK': '#FFC72C', // corrected 2026-10-02 (live user call): reads as yellow, not blue - blue/yellow Ford Focus, yellow is the dominant/ID colour
  'Laser Tools Racing with MB Motorsport': '#0F3FBF', // confirmed: blue Toyota Corolla
  'Speedworks Corolla Racing': '#D7282B', // estimate: red/white/black tri-colour, red as ID colour
  'Team VERTU': '#159A8C', // confirmed: teal/turquoise Hyundai i30N

  // Accent-colour substitutes (see note above) - not the car's actual body colour
  'LKQ Euro Car Parts with Power Maxed Racing': '#2C3E6B', // body is white; navy approximates its blue/black graphics
  'WSR': '#2E8B57', // body is white; sea-green approximates its green/teal pinstripe
  'Restart Racing': '#00B4D8', // body is black (unusable on a dark chart); cyan approximates its diagonal flash accent
  // 'Steel Seal with Power Maxed Racing' deliberately has no entry - no
  // distinct livery photo at all (inferred only from its sister LKQ Power
  // Maxed Racing entry), and no earlier-livery instruction like CPRL's -
  // falls back to the ordinary categorical palette rather than guessing.
};
