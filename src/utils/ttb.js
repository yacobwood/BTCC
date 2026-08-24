// TOCA Turbo Boost (TTB) allocation - BTCC Sporting Regulation 1.11.1.
//
// Reg 1.11.1.a: TTB applies in Qualifying AND every Race, but "will have
// different operating methods" between them - two distinct metrics, both a
// sliding scale by position (P1 gets the least, P8-or-lower gets the most,
// so the system narrows the field rather than compounding an advantage):
//   - Races: LAPS of boost available for the whole race, split by circuit
//     type (reg 1.11.1.b: "B circuits" - Brands Hatch Indy, Knockhill,
//     Silverstone - get more laps than "A circuits", everywhere else).
//   - Qualifying AND the Qualifying Race: SECONDS per lap of boost available
//     - one shared scale, no circuit split. Notable trap: despite being a
//     race-format, points-scoring session, the Qualifying Race uses this
//     seconds scale, not the Races laps scale.
// Position source differs by race, but not in the way the two metrics might
// suggest - Qualifying and the Qualifying Race share Race 1's source, not
// each other's:
//   Race 1, Qualifying, Qualifying Race -> Championship Order (points total
//     before this round) - reg 1.11.1.b: "For Qualifying: ... reduced based
//     on Championship Order")
//   Race 2 -> Race 1 finishing order (same meeting)
//   Race 3 -> Race 2 finishing order (same meeting)
//
// Known gaps NOT modelled here - both are explicitly left to Administrator
// discretion by the regs, so there's no formula to derive them from data:
//   - Late Entry TTB for cars registered after 13 Mar 2026, or missing one or
//     more meetings (reg 1.11.1.c.i)
//   - Substitute-driver TTB carryover from the departing driver (1.11.1.c.ii)
// Also not modelled: guest-driver results are supposed to be disregarded when
// numbering Race 2/3 position (reg 1.11.1.a), but guest entries aren't flagged
// anywhere in the results data, so they're counted as a normal finisher.
// Also not modelled: reg 1.11.1.b's "Deployment Minimum Car Speed (KPH)"
// column (140kph at P1 down to 105kph at P8+) - a speed-gating condition on
// top of whichever allocation above applies. Left out because the table's own
// header for that column ("Qualifying & Race", singular "Race") is genuinely
// ambiguous about which sessions it covers, and there's no live speed-trace
// data in this app to apply it against even if the scope were resolved.
//
// Round 1 has no prior Championship Order to rank by, and the regs don't
// define a fallback for that gap for Race 1 (every other "no order yet" case
// in these regs is handed to Co-ordinator discretion, not a computed rule).
// Per user confirmation (2026-08-19, observed rather than a quoted regulation
// - see memory/project_ttb_boost_allocation.md): every driver gets the
// maximum TTB tier (the same P8+ row already used to cap the scale) at the
// season opener. ttbPositionMap applies that fallback for Race 1 whenever
// championshipOrderBeforeRound comes back empty.
//
// Qualifying's reduction is explicitly stated to apply only "from the second
// Championship meeting" (reg 1.11.1.b), so Round 1's Qualifying/Qualifying
// Race has the identical gap, just regulation-confirmed rather than inferred.
// What happens instead at Round 1 still isn't stated either way - by analogy
// with the same user-confirmed Race 1 convention, isSeasonOpenerQualifying /
// ttbQualifyingPositionMap apply the same max-tier-for-everyone fallback.
// This is the same kind of inference as the Race 1 case, not a quoted rule.

const TTB_RACE_SCALE = [
  {aLaps: 1, bLaps: 4},   // P1
  {aLaps: 2, bLaps: 5},   // P2
  {aLaps: 3, bLaps: 6},   // P3
  {aLaps: 4, bLaps: 7},   // P4
  {aLaps: 5, bLaps: 8},   // P5
  {aLaps: 6, bLaps: 10},  // P6
  {aLaps: 8, bLaps: 12},  // P7
  {aLaps: 10, bLaps: 14}, // P8+
];

// Named explicitly in reg 1.11.1.b; every other venue is an "A circuit".
const B_CIRCUITS = new Set(['Brands Hatch Indy', 'Knockhill', 'Silverstone']);

export function isBCircuit(venue) {
  return B_CIRCUITS.has(venue);
}

// Laps of TTB available for a given Championship/Race Position at a venue.
export function getTtbLaps(position, venue) {
  if (!position || position < 1) return null;
  const row = TTB_RACE_SCALE[Math.min(position, TTB_RACE_SCALE.length) - 1];
  return isBCircuit(venue) ? row.bLaps : row.aLaps;
}

// Standard competition ranking: ties share a rank, the next distinct value
// skips ahead by the number tied (e.g. two drivers tied at rank 2 -> the next
// distinct driver is rank 4). Reg 1.11.1.b: "Should two or more drivers be
// tied on points, those drivers shall be awarded equal Championship TTB
// allocation."
function rankByValueDesc(entries) {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const ranks = {};
  let rank = 0;
  let seen = 0;
  let lastValue = null;
  sorted.forEach(({key, value}) => {
    seen += 1;
    if (value !== lastValue) {
      rank = seen;
      lastValue = value;
    }
    ranks[key] = rank;
  });
  return ranks;
}

// Race 1's TTB position: Championship Order before this round, i.e. cumulative
// points from every earlier round of the season. Returns {} for round 1 (no
// earlier round exists) - callers should treat an empty map as "not available".
//
// `rosterDrivers` (optional) is this round's own grid - anyone on it with no
// results in any earlier round (e.g. a mid-season replacement making their
// season debut, such as Daniel Lloyd stepping in for James Dorlin) has no
// points to sum and would otherwise be silently missing from the returned
// map, dropping their TTB badge entirely. They're folded in tied on zero
// points instead, per reg 1.11.1.b's tie rule already applied below. Skipped
// when `points` is still empty (the true season opener), which has its own
// max-tier-for-everyone fallback in ttbPositionMap.
export function championshipOrderBeforeRound(allRounds, roundNumber, rosterDrivers) {
  const points = {};
  (allRounds || [])
    .filter(r => r.round < roundNumber)
    .forEach(r => (r.races || []).forEach(race =>
      (race.results || []).forEach(res => {
        if (!res.driver) return;
        points[res.driver] = (points[res.driver] || 0) + (res.points || 0);
      })
    ));
  if (rosterDrivers && Object.keys(points).length) {
    rosterDrivers.forEach(driver => {
      if (driver && !(driver in points)) points[driver] = 0;
    });
  }
  const entries = Object.entries(points).map(([key, value]) => ({key, value}));
  return rankByValueDesc(entries);
}

// Race 2/3's TTB position: finishing order in the previous race of the SAME
// round. Non-classified results (DNF/DQ/DNS) are placed after classified
// finishers, ordered by laps covered descending - the same convention already
// used for grid derivation elsewhere in this app (see buildStraightGrid /
// buildReverseGrid in RoundResultsScreen.js).
export function finishingOrderMap(sourceRace) {
  if (!sourceRace?.results?.length) return null;
  const classified = sourceRace.results.filter(r => r.position > 0).sort((a, b) => a.position - b.position);
  const nonClassified = sourceRace.results.filter(r => r.position === 0).sort((a, b) => (b.laps || 0) - (a.laps || 0));
  const map = {};
  [...classified, ...nonClassified].forEach((r, i) => { if (r.driver) map[r.driver] = i + 1; });
  return map;
}

// True when `race` is a season-opening Race 1 with no prior round to derive
// a Championship Order from - the case where every driver gets the max TTB
// tier (see the file header comment for the source of that convention).
export function isSeasonOpenerRace1(race, allRounds, roundNumber) {
  if (race.label !== 'Race 1') return false;
  return Object.keys(championshipOrderBeforeRound(allRounds, roundNumber)).length === 0;
}

// Resolve the TTB position map (driver -> Championship/Race Position) for a
// given race within a round, ready to feed into getTtbLaps() per driver.
//   race:      the race to compute TTB positions for (Race 1/2/3)
//   races:     this round's own races array (Race 2/3 same-meeting lookups)
//   allRounds: full season's rounds (Race 1's cumulative-points lookup)
//   roundNumber: this round's number
// Returns null when the position source isn't available at all (e.g. Race 2
// before Race 1 has results, or a race other than Race 1/2/3). At the season
// opener, every driver in `race.grid` is assigned the max TTB tier rather
// than returning null - see isSeasonOpenerRace1.
export function ttbPositionMap(race, races, allRounds, roundNumber) {
  if (race.label === 'Race 1') {
    const gridDrivers = (race.grid || []).map(g => g.driver).filter(Boolean);
    const map = championshipOrderBeforeRound(allRounds, roundNumber, gridDrivers);
    if (Object.keys(map).length) return map;
    if (!race.grid?.length) return null;
    const maxTierMap = {};
    race.grid.forEach(g => { if (g.driver) maxTierMap[g.driver] = TTB_RACE_SCALE.length; });
    return maxTierMap;
  }
  if (race.label === 'Race 2') return finishingOrderMap((races || []).find(r => r.label === 'Race 1'));
  if (race.label === 'Race 3') return finishingOrderMap((races || []).find(r => r.label === 'Race 2'));
  return null;
}

// ── Qualifying / Qualifying Race: seconds-per-lap scale (reg 1.11.1.b) ──────
//
// A separate TTB metric from the Races laps scale above - no circuit split,
// and shared identically by Qualifying and the Qualifying Race (both rank by
// Championship Order, not by each other's finishing order).
const TTB_QUALIFYING_SCALE = [1, 3, 5, 7, 9, 11, 15, 20]; // P1..P8+, secs/lap

// Seconds per lap of TTB available for a given Championship Position in
// Qualifying or the Qualifying Race (reg 1.11.1.b). No isBCircuit() split -
// this column of the regs' table doesn't vary by circuit type.
export function getTtbSeconds(position) {
  if (!position || position < 1) return null;
  return TTB_QUALIFYING_SCALE[Math.min(position, TTB_QUALIFYING_SCALE.length) - 1];
}

// True when `race` is Qualifying or the Qualifying Race at a round with no
// Championship Order to rank by yet - see the file header for why this
// mirrors isSeasonOpenerRace1's fallback by analogy rather than a quoted rule.
export function isSeasonOpenerQualifying(race, allRounds, roundNumber) {
  if (race.label !== 'Qualifying' && race.label !== 'Qualifying Race') return false;
  return Object.keys(championshipOrderBeforeRound(allRounds, roundNumber)).length === 0;
}

// Resolve the TTB position map (driver -> Championship Position) for
// Qualifying or the Qualifying Race. Both share Race 1's Championship-Order
// position source (not the previous-session finishing order Race 2/3 use).
//   race:        the race to compute TTB positions for (Qualifying/Qualifying Race)
//   allRounds:   full season's rounds (cumulative-points lookup)
//   roundNumber: this round's number
// `rosterDrivers` is read from race.grid for the Qualifying Race (mirroring
// Race 1 - it has a real starting grid) and from race.results for Qualifying
// itself (a flying-lap session has no grid concept). Covers the same
// mid-season-debut gap as championshipOrderBeforeRound documents above.
// Returns null for any other race label, or when there's no grid/results yet
// to build a roster from at the season opener.
export function ttbQualifyingPositionMap(race, allRounds, roundNumber) {
  if (race.label !== 'Qualifying' && race.label !== 'Qualifying Race') return null;
  const rosterDrivers = (race.label === 'Qualifying Race'
    ? (race.grid || []).map(g => g.driver)
    : (race.results || []).map(r => r.driver)
  ).filter(Boolean);
  const map = championshipOrderBeforeRound(allRounds, roundNumber, rosterDrivers);
  if (Object.keys(map).length) return map;
  if (!rosterDrivers.length) return null;
  const maxTierMap = {};
  rosterDrivers.forEach(driver => { maxTierMap[driver] = TTB_QUALIFYING_SCALE.length; });
  return maxTierMap;
}

// ── Dispatchers: pick the right metric/position-source for any race label ──

// Same as ttbPositionMap, but also covers Qualifying/Qualifying Race - the
// single entry point RoundResultsScreen uses regardless of which of reg
// 1.11.1's two position sources actually applies to this race's label.
export function ttbPositionMapForRace(race, races, allRounds, roundNumber) {
  if (race.label === 'Qualifying' || race.label === 'Qualifying Race') {
    return ttbQualifyingPositionMap(race, allRounds, roundNumber);
  }
  return ttbPositionMap(race, races, allRounds, roundNumber);
}

// Same as isSeasonOpenerRace1, but also covers Qualifying/Qualifying Race.
export function isTtbSeasonOpener(race, allRounds, roundNumber) {
  if (race.label === 'Qualifying' || race.label === 'Qualifying Race') {
    return isSeasonOpenerQualifying(race, allRounds, roundNumber);
  }
  return isSeasonOpenerRace1(race, allRounds, roundNumber);
}

// Resolves a driver's TTB badge display for any TTB-eligible race label,
// dispatching to whichever of reg 1.11.1's two metrics applies - laps of
// boost for a whole Race, or seconds of boost per lap for Qualifying/the
// Qualifying Race - so callers don't need to know which one it is. Returns
// null when `ttbMap` itself is unavailable or this driver has no position in
// it (e.g. didn't take part in the source session).
export function getTtbBadge(race, ttbMap, driver, venue) {
  if (!ttbMap) return null;
  const position = ttbMap[driver];
  if (race.label === 'Qualifying' || race.label === 'Qualifying Race') {
    const secs = getTtbSeconds(position);
    return secs == null ? null : {value: secs, label: `${secs}s`, a11y: `${secs} seconds of TOCA Turbo Boost per lap`};
  }
  const laps = getTtbLaps(position, venue);
  return laps == null ? null : {value: laps, label: String(laps), a11y: `${laps} laps of TOCA Turbo Boost`};
}
