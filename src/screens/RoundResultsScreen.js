import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  AppState,
  Alert,
  Share,
} from 'react-native';
import SwipeableTabs from '../components/SwipeableTabs';
import {CHAT_FAB_CLEARANCE} from '../utils/chatFabLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {useUnits} from '../store/units';
import {Analytics} from '../utils/analytics';
import {formatDriverName} from '../utils/driverName';
import {fetchResults, fetchPenalties} from '../api/client';
import {parseResults, parsePenalties} from '../api/parsers';
import {maybeRequestReviewAfterResults} from '../utils/reviewPrompt';
import {maybeShowShareNudge, markShareNudgeShown} from '../utils/shareNudge';
import {shareApp} from '../utils/appShare';
import {detectBroadcaster} from '../utils/broadcaster';
import {ttbPositionMapForRace, isTtbSeasonOpener, getTtbBadge} from '../utils/ttb';

// The require() path itself must stay a static literal (Metro can't resolve a
// dynamic year here) - but every comparison below derives the current season
// from the bundle's own `season` field, so only this one line needs editing
// when a new season's results file is bundled, not every comparison site.
const BUNDLED_RESULTS = require('../../data/results2026.json');
const CURRENT_SEASON = Number(BUNDLED_RESULTS.season);
const BUNDLED_YOUTUBE_URLS = Object.fromEntries(
  (BUNDLED_RESULTS.rounds || []).map(r => [r.round, r.youtubeUrls || []])
);
const IS_UK = detectBroadcaster() === 'uk';

// Abbreviate session labels for tab display.
function shortLabel(label) {
  if (label === 'Free Practice') return 'FP';
  if (label === 'Qualifying') return 'QUAL';
  if (label === 'Qualifying Race') return 'Q RACE';
  const m = label.match(/^Race (\d)$/);
  if (m) return `R${m[1]}`;
  return label;
}

// Compute the predicted R3 grid per reg 3.4.1.b:
// - Top `reversalCount` classified R2 finishers are reversed (draw picks 6–12 inclusive)
// - Remaining classified finishers follow in R2 order
// - Non-classified (DNFs) start after the last classified, ordered by laps covered (desc)
export function buildReverseGrid(races, reversalCount) {
  const r2 = races.find(r => r.label === 'Race 2');
  if (!r2?.results?.length) return null;
  const classified = r2.results.filter(r => r.position > 0);
  const dnfs = r2.results
    .filter(r => r.position === 0)
    .sort((a, b) => (b.laps || 0) - (a.laps || 0));
  const reversed = classified.slice(0, reversalCount).reverse();
  const rest = classified.slice(reversalCount);
  return [...reversed, ...rest, ...dnfs].map((r, i) => ({...r, gridPos: i + 1, r2Pos: r.position}));
}

// Compute the predicted grid for Race 1/Race 2 straight from the previous
// session's finishing order, per reg 3.4.1.b, for use before TSL has published
// the official grid PDF. Classified finishers keep their finishing order;
// non-classified competitors follow, ordered by laps covered (descending).
export function buildStraightGrid(sourceRace) {
  if (!sourceRace?.results?.length) return null;
  const classified = sourceRace.results.filter(r => r.position > 0);
  if (!classified.length) return null;
  const dnfs = sourceRace.results
    .filter(r => r.position === 0)
    .sort((a, b) => (b.laps || 0) - (a.laps || 0));
  return [...classified, ...dnfs].map((r, i) => ({driver: r.driver, pos: i + 1}));
}

// Build a map of driver -> grid position for a given race.
// Prefers the actual TSL grid PDF data when available (covers all races incl. R3).
// Falls back to derivation from the previous session's finishing order.
export function buildGridMap(races, raceIndex) {
  const race = races[raceIndex];
  if (!race) return null;

  // Prefer actual TSL grid (populated by scraper from gqr/grd/gr2/gr3 PDFs)
  if (race.grid?.length) {
    const map = {};
    race.grid.forEach(g => { if (g.driver) map[g.driver] = g.pos; });
    return Object.keys(map).length ? map : null;
  }

  // Derive from previous session finishing order when TSL grid not yet available
  let sourceLabel;
  if (race.label === 'Qualifying Race') sourceLabel = 'Qualifying';
  else if (race.label === 'Race 1') sourceLabel = 'Qualifying Race';
  else if (race.label === 'Race 2') sourceLabel = 'Race 1';
  else return null;
  const sourceRace = races.find(r => r.label === sourceLabel);
  if (!sourceRace?.results?.length) return null;
  const map = {};
  sourceRace.results.forEach((r, i) => {
    if (r.driver && r.position > 0) map[r.driver] = i + 1;
  });
  return Object.keys(map).length ? map : null;
}

const POLL_INTERVAL_MS = 60 * 1000;

export default function RoundResultsScreen({route, navigation}) {
  const {round: initialRound, year, initialRace, origin} = route.params;
  const [round, setRound] = useState(initialRound);
  // Mirrors SwipeableTabs' own index so a share fired from e.g. the R2 tab can
  // link back to R2 specifically, not just the round overview.
  const [activeRace, setActiveRace] = useState(initialRace ?? 0);
  // Full season's rounds, kept alongside `round` so Race 1's TTB allocation
  // (reg 1.11.1.a - Championship Order before this round) can be reconstructed
  // from cumulative points across earlier rounds. Seeded from the bundled
  // snapshot so it works offline; refreshed opportunistically below.
  const [allRounds, setAllRounds] = useState(BUNDLED_RESULTS.rounds || []);
  const handleBack = () => origin === 'calendar' ? navigation.navigate('ResultsList') : navigation.goBack();

  const {isFavourite} = useFavouriteDriver();
  const {useKm} = useUnits();
  const races = round.races || [];

  // Shares whichever session tab is actually open (FP/QUAL/Q RACE/R1/R2/R3) -
  // previously this always linked to the round overview, so a link shared
  // from e.g. the R2 tab opened the recipient straight to FP instead.
  const onShareRound = async () => {
    const race = races[activeRace];
    const sessionSuffix = race ? `/${activeRace + 1}` : '';
    const sessionLabel = race ? `: ${race.label}` : '';
    Analytics.contentShared('round_result', round.round);
    try {
      await Share.share({
        message: `${round.venue} - Round ${round.round}${sessionLabel} results\n\nhttps://btcchub.vercel.app/results/${round.round}${sessionSuffix}?src=round_result`,
      });
    } catch {}
  };

  // Sync state when navigated to a different round (screen is reused in the stack)
  useEffect(() => {
    setRound(initialRound);
  }, [initialRound.round]);

  useEffect(() => {
    Analytics.screen('round_results');
    Analytics.roundResultsViewed(year, round.round);
    maybeRequestReviewAfterResults();
    // Independently gated from the review prompt above (different keys, a
    // later day-count) so the two don't compete for the same visit.
    maybeShowShareNudge().then(should => {
      if (!should) return;
      markShareNudgeShown();
      Analytics.shareNudgeShown();
      Alert.alert(
        'Enjoying BTCC Hub?',
        'Share it with a fellow fan.',
        [
          {text: 'Not now', style: 'cancel', onPress: () => Analytics.shareNudgeDismissed()},
          {text: 'Share', onPress: () => shareApp('share_nudge')},
        ],
      );
    });
  }, []);

  const refresh = useCallback(async () => {
    if (year < CURRENT_SEASON) return;
    try {
      const raw = await fetchResults(year, true);
      const parsed = parseResults(raw);
      setAllRounds(parsed);
      const fresh = parsed.find(r => r.round === round.round);
      if (fresh) setRound(fresh);
    } catch (_) {}
  }, [year, round.round]);

  useEffect(() => {
    if (year < CURRENT_SEASON) return;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => { clearInterval(interval); appSub.remove(); };
  }, [refresh, year]);

  // Judicial decisions (scrape_penalties.py, run the Monday after each round)
  // change far less often than results - fetched once per year/round rather
  // than on the same 60s poll as live results above.
  const [penalties, setPenalties] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await fetchPenalties(year);
      const parsed = parsePenalties(raw);
      const forThisRound = parsed.find(r => r.round === round.round)?.penalties || [];
      if (!cancelled) setPenalties(forThisRound);
    })();
    return () => { cancelled = true; };
  }, [year, round.round]);

  const rStart = (round.round - 1) * 3 + 1;
  const rEnd = rStart + 2;

  const makeRenderResult = (gridMap, ttbMap, race) => ({item}) => {
    const isDNF = item.position === 0 || item.time === 'DNF';
    const isDNS = isDNF && item.status === 'DNS';
    const posLabel = item.status === 'DQ' ? 'DQ' : isDNS ? 'DNS' : isDNF ? 'DNF' : item.position;
    const fav = isFavourite(item.driver);
    const posColor = item.position === 1 ? '#FFD700'
      : item.position === 2 ? '#C0C0C0'
      : item.position === 3 ? '#CD7F32'
      : '#fff';

    const gridPos = gridMap?.[item.driver];
    const delta = (gridPos != null && !isDNF) ? gridPos - item.position : null;
    // Same TOCA Turbo Boost allocation shown on the pre-race Starting Grid tab
    // (reg 1.11.1) - a fixed pre-race number, not a live "laps consumed"
    // counter (that would need per-lap deployment data this app doesn't have).
    // getTtbBadge picks laps-of-boost or secs/lap depending on race.label.
    const ttbBadge = getTtbBadge(race, ttbMap, item.driver, round.venue);

    return (
      <View style={[styles.resultRow, isDNF && styles.resultRowDNF, fav && styles.resultRowFav]} accessibilityLabel={`Position ${posLabel}, ${item.driver}, ${item.points} points`}>
        <Text style={[styles.pos, {color: isDNF ? Colors.textSecondary : posColor}]}>
          {posLabel}
        </Text>
        <View style={{flex: 1, minWidth: 0}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            {fav && <Icon name="star" size={11} color={Colors.yellow} />}
            <Text style={[styles.driverName, fav && {color: Colors.yellow}]}>
              {formatDriverName(item.driver)}
            </Text>
            {item.fastestLap && <Badge text="FL" color="#A855F7" />}
            {item.leadLap && <Badge text="L" color={Colors.yellow} />}
            {item.pole && <Badge text="P" color={Colors.yellow} />}
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <Text style={styles.teamName} numberOfLines={1}>{item.team}</Text>
            {delta !== null && delta !== 0 && (
              <View style={styles.deltaRow}>
                <Icon
                  name={delta > 0 ? 'arrow-upward' : 'arrow-downward'}
                  size={10}
                  color={delta > 0 ? '#4ADE80' : '#F87171'}
                />
                <Text style={[styles.deltaText, {color: delta > 0 ? '#4ADE80' : '#F87171'}]}>
                  {Math.abs(delta)}
                </Text>
              </View>
            )}
            {ttbBadge && (
              <View style={styles.ttbBadge} accessibilityLabel={ttbBadge.a11y}>
                <Icon name="flash-on" size={10} color={Colors.yellow} />
                <Text style={styles.ttbBadgeText}>{ttbBadge.label}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.rightCol}>
          <Text style={[styles.timeText, item.position === 1 && {color: Colors.yellow}]}>
            {item.time
              ? (item.position === 1 ? item.time : (item.gap ? `+${item.gap.replace(/^\+/, '')}` : item.time))
              : item.bestLap || ''}
          </Text>
          {!item.time && item.gap && item.position > 1 ? (
            <Text style={styles.detailText}>+{item.gap}</Text>
          ) : null}
          {item.avgLapSpeed ? (
            <Text style={styles.detailText}>
              Avg {useKm ? `${parseFloat(item.avgLapSpeed).toFixed(2)} km/h` : `${(parseFloat(item.avgLapSpeed) / 1.60934).toFixed(2)} mph`}
            </Text>
          ) : null}
          {(item.points || 0) > 0
            ? <Text style={styles.pointsText}>+{item.points} pts</Text>
            : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{flex: 1, marginLeft: 12}}>
          <Text style={styles.headerTitle}>{round.venue}</Text>
          <Text style={styles.headerSub}>Rounds {rStart}–{rEnd} · {round.date}</Text>
        </View>
        <TouchableOpacity onPress={onShareRound} style={{padding: 4}} accessibilityLabel="Share round result" accessibilityRole="button">
          <Icon name="share" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <SwipeableTabs
        tabs={races.map(r => shortLabel(r.label))}
        initialPage={initialRace ?? 0}
        onTabChange={setActiveRace}
        lazy={true}
        pages={races.map((race, i) => {
          const gridMap = buildGridMap(races, i);
          // Resolved once per race tab and reused by the post-race results
          // list below - ttbPositionMapForRace() covers Race 1/2/3 (laps) and
          // Qualifying/Qualifying Race (secs/lap), returning null for Free
          // Practice or any other label, so this is a cheap no-op there.
          const ttbMap = year === CURRENT_SEASON ? ttbPositionMapForRace(race, races, allRounds, round.round) : null;
          const isR3 = race?.label === 'Race 3';
          const isQual = race.label === 'Qualifying';
          const hasResults = race?.results?.length > 0;
          if (!hasResults) {
            if (race.grid?.length) {
              return (
                <StartingGridTab
                  key={i}
                  race={race}
                  races={races}
                  isFavourite={isFavourite}
                  venue={round.venue}
                  roundNumber={round.round}
                  allRounds={allRounds}
                  showTtb={year === CURRENT_SEASON}
                />
              );
            }
            if (isR3) {
              return <ReverseGridTab key={i} races={races} isFavourite={isFavourite} />;
            }
            if (isQual) {
              const fp = races.find(r => r.label === 'Free Practice');
              if (fp?.results?.length) {
                return <QualGroupsTab key={i} races={races} isFavourite={isFavourite} />;
              }
            }
            if (race.label === 'Race 1' || race.label === 'Race 2') {
              const sourceLabel = race.label === 'Race 1' ? 'Qualifying Race' : 'Race 1';
              const predictedGrid = buildStraightGrid(races.find(r => r.label === sourceLabel));
              if (predictedGrid) {
                return (
                  <StartingGridTab
                    key={i}
                    race={{...race, grid: predictedGrid}}
                    races={races}
                    isFavourite={isFavourite}
                    predicted
                    sourceLabel={sourceLabel}
                    venue={round.venue}
                    roundNumber={round.round}
                    allRounds={allRounds}
                    showTtb={year === CURRENT_SEASON}
                  />
                );
              }
            }
          }

          if (!race?.results?.length) {
            return <EmptyState icon="schedule" title="Nothing to see here. Literally." subtitle="Hang tight, results will appear when they're ready" />;
          }

          return (
            <View style={{flex: 1}}>
              {race?.date && race.date !== round.date && (
                <Text style={styles.raceDateLabel}>{race.date}</Text>
              )}
              <FlatList
                data={race.results}
                keyExtractor={(_, idx) => String(idx)}
                renderItem={makeRenderResult(gridMap, ttbMap, race)}
                contentContainerStyle={{padding: 16, paddingBottom: 20 + CHAT_FAB_CLEARANCE}}
                ListHeaderComponent={(() => {
                  const urls = round.youtubeUrls?.length ? round.youtubeUrls : (year === CURRENT_SEASON ? (BUNDLED_YOUTUBE_URLS[round.round] || []) : []);
                  const raceUrlMap = {'Free Practice': urls[0], 'Qualifying': urls[1], 'Qualifying Race': urls[2], 'Race 1': urls[3], 'Race 2': urls[4], 'Race 3': urls[5]};
                  const url = IS_UK ? raceUrlMap[race?.label] : null;
                  if (!url) return null;
                  return (
                    <TouchableOpacity
                      style={styles.youtubeBtn}
                      activeOpacity={0.8}
                      onPress={() => Linking.openURL(url)}
                      accessibilityLabel="Watch full race on YouTube"
                      accessibilityRole="button">
                      <Icon name="play-circle-filled" size={16} color="#FF0000" style={{marginRight: 8}} />
                      <Text style={styles.youtubeBtnText}>Watch Full Race</Text>
                      <Icon name="open-in-new" size={14} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })()}
                ListFooterComponent={
                  <JudicialDecisionsCard
                    penalties={penalties.filter(p => p.session === race.label)}
                    roundNumber={round.round}
                    session={race.label}
                  />
                }
              />
            </View>
          );
        })}
      />
    </View>
  );
}

// One row per BARC judicial decision naming a BTCC driver in this session
// (tools/scraper/scrape_penalties.py). oneLiner is pre-built by the scraper -
// it's already "Driver (No. N): sanction - what happened" - this just adds
// the link out to BARC's own PDF. Renders nothing when there's nothing to
// show, so it costs no space on the (typical) incident-free session tab.
function JudicialDecisionsCard({penalties, roundNumber, session}) {
  useEffect(() => {
    if (penalties.length) Analytics.penaltiesShown(roundNumber, session, penalties.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber, session, penalties.length]);

  if (!penalties.length) return null;

  const openDecision = (p) => {
    if (!p.pdfUrl) return;
    Linking.openURL(p.pdfUrl)
      .then(() => Analytics.penaltyDocumentOpened(roundNumber, session))
      .catch((e) => Analytics.penaltyDocumentOpenFailed(roundNumber, session, e?.message));
  };

  return (
    <View style={styles.penaltyCard}>
      <View style={styles.penaltyCardHeader}>
        <Icon name="gavel" size={14} color={Colors.yellow} />
        <Text style={styles.penaltyCardTitle}>
          Judicial Decision{penalties.length > 1 ? 's' : ''} ({penalties.length})
        </Text>
      </View>
      {penalties.map((p, i) => {
        // facts/offence/decision are the PDF's own labelled fields, verbatim -
        // shown as-is rather than collapsed into oneLiner's condensed summary
        // (which stays as the fallback for a document the scraper couldn't
        // split into that level of detail - see confidence: "minimal").
        const hasDetail = p.facts || p.offence || p.decision;
        return (
          <View key={i} style={styles.penaltyRow}>
            <Text style={styles.penaltyDriverLine}>
              {p.driver}{p.carNo ? ` (No. ${p.carNo})` : ''}
            </Text>
            {hasDetail ? (
              <>
                {p.facts && <PenaltyField label="Facts" value={p.facts} />}
                {p.offence && <PenaltyField label="Offence" value={p.offence} />}
                {p.decision && <PenaltyField label="Decision" value={p.decision} />}
              </>
            ) : (
              <Text style={styles.penaltyOneLiner}>{p.oneLiner}</Text>
            )}
            {p.pdfUrl && (
              <TouchableOpacity
                onPress={() => openDecision(p)}
                accessibilityRole="button"
                accessibilityLabel={`View judicial decision document for ${p.driver}`}>
                <Text style={styles.penaltyLink}>View decision →</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

function PenaltyField({label, value}) {
  return (
    <View style={styles.penaltyField}>
      <Text style={styles.penaltyFieldLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.penaltyFieldValue}>{value}</Text>
    </View>
  );
}

const REVERSAL_MIN = 6;
const REVERSAL_MAX = 12;

const GRID_CARD_HEIGHT = 52;
const GRID_GAP = 6;

export function detectReversalCount(races, gridDrivers) {
  const r2 = races?.find(r => r.label === 'Race 2');
  if (!r2?.results?.length) return null;
  const r2Order = [...r2.results].filter(d => d.position > 0).sort((a, b) => a.position - b.position).map(d => d.driver);
  for (let n = 12; n >= 6; n--) {
    const reversed = r2Order.slice(0, n).reverse();
    if (reversed.length === n && reversed.every((driver, i) => gridDrivers[i] === driver)) return n;
  }
  return null;
}

function StartingGridTab({race, races, isFavourite, predicted, sourceLabel, venue, roundNumber, allRounds, showTtb}) {
  const sorted = [...race.grid].sort((a, b) => a.pos - b.pos);
  const isR3 = race.label === 'Race 3';
  // Use explicit draw number if set (covers TSL grid PDF amendments caught after the window);
  // fall back to inferring from grid vs R2 order.
  const reversalCount = isR3
    ? (race.reverseGridDraw ?? detectReversalCount(races, sorted.map(g => g.driver)))
    : null;
  const teamMap = {};
  races.forEach(r => (r.results || []).forEach(d => { if (d.driver && d.team) teamMap[d.driver] = d.team; }));
  // TOCA Turbo Boost allocation (reg 1.11.1) - null when the position source
  // isn't available at all (e.g. an archive season, or Race 2 before Race 1
  // has results). At the season opener every driver gets the max TTB tier
  // (see ttb.js header comment) rather than no badge. Race 1/2/3 get a laps
  // scale; Qualifying/Qualifying Race get a secs/lap scale - see getTtbBadge.
  const ttbMap = showTtb ? ttbPositionMapForRace(race, races, allRounds, roundNumber) : null;
  const ttbSeasonOpener = showTtb && ttbMap && isTtbSeasonOpener(race, allRounds, roundNumber);
  const isQualifyingType = race.label === 'Qualifying' || race.label === 'Qualifying Race';
  const leftItems = sorted.filter(g => g.pos % 2 === 1);
  const rightItems = sorted.filter(g => g.pos % 2 === 0);
  const rightOffset = (GRID_CARD_HEIGHT + GRID_GAP) / 2;
  return (
    <View style={{flex: 1}}>
      <View style={styles.reverseHeader}>
        <Text style={styles.reverseTitle}>{predicted ? 'Predicted Starting Grid' : 'Official Starting Grid'}</Text>
        {predicted && <Text style={styles.reverseSubtitle}>Based on {sourceLabel} finishing order</Text>}
        {ttbMap && (
          <Text style={styles.reverseSubtitle}>
            {ttbSeasonOpener
              ? '⚡ Season opener - every driver gets max TOCA Turbo Boost'
              : isQualifyingType
                ? '⚡ Seconds of TOCA Turbo Boost available per lap'
                : '⚡ Laps of TOCA Turbo Boost available this race'}
          </Text>
        )}
      </View>
      <ScrollView contentContainerStyle={{paddingTop: 12, paddingHorizontal: 16, paddingBottom: 20 + CHAT_FAB_CLEARANCE}}>
        <View style={{flexDirection: 'row', gap: GRID_GAP}}>
          <View style={{flex: 1, gap: GRID_GAP}}>
            {leftItems.map(item => (
              <GridSlot key={item.pos} item={item} isFavourite={isFavourite} reversed={reversalCount != null && item.pos <= reversalCount} team={teamMap[item.driver] || ''} ttbBadge={getTtbBadge(race, ttbMap, item.driver, venue)} />
            ))}
          </View>
          <View style={{flex: 1, gap: GRID_GAP, marginTop: rightOffset}}>
            {rightItems.map(item => (
              <GridSlot key={item.pos} item={item} isFavourite={isFavourite} reversed={reversalCount != null && item.pos <= reversalCount} team={teamMap[item.driver] || ''} ttbBadge={getTtbBadge(race, ttbMap, item.driver, venue)} />
            ))}
          </View>
        </View>
        {reversalCount && (
          <View style={[styles.reversalBadge, {alignSelf: 'center', marginTop: 20}]}>
            <Icon name="shuffle" size={11} color={Colors.yellow} />
            <Text style={styles.reversalBadgeText}>Top {reversalCount} reversed (draw: {reversalCount})</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function EmptyState({icon, title, subtitle}) {
  return (
    <View style={styles.emptyState}>
      <Icon name={icon} size={48} color="#fff" style={styles.emptyStateIcon} />
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateSubtitle}>{subtitle}</Text>
    </View>
  );
}

function QualGroupsTab({races, isFavourite}) {
  const fp = races.find(r => r.label === 'Free Practice');
  if (!fp?.results?.length) {
    return <EmptyState icon="schedule" title="Nothing to see here. Literally." subtitle="Hang tight, results will appear when they're ready" />;
  }
  const classified = [...fp.results]
    .filter(r => r.position > 0)
    .sort((a, b) => a.position - b.position);
  const q1 = classified.filter(r => r.position % 2 === 1);
  const q2 = classified.filter(r => r.position % 2 === 0);
  return (
    <View style={{flex: 1}}>
      <View style={styles.reverseHeader}>
        <Text style={styles.reverseTitle}>Qualifying Groups</Text>
        <Text style={styles.reverseSubtitle}>Odd FP finishers → Q1 · Even FP finishers → Q2</Text>
      </View>
      <ScrollView contentContainerStyle={{paddingHorizontal: 16, paddingBottom: 20 + CHAT_FAB_CLEARANCE}}>
        <View style={{flexDirection: 'row', gap: GRID_GAP}}>
          <View style={{flex: 1, gap: GRID_GAP}}>
            <Text style={styles.qualGroupLabel}>Q1</Text>
            {q1.map(item => (
              <GridSlot key={item.position} item={{pos: item.position, driver: item.driver}} isFavourite={isFavourite} reversed={false} team={item.team || ''} />
            ))}
          </View>
          <View style={{flex: 1, gap: GRID_GAP}}>
            <Text style={styles.qualGroupLabel}>Q2</Text>
            {q2.map(item => (
              <GridSlot key={item.position} item={{pos: item.position, driver: item.driver}} isFavourite={isFavourite} reversed={false} team={item.team || ''} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function GridSlot({item, isFavourite, reversed, team, ttbBadge}) {
  if (!item) return null;
  const fav = isFavourite(item.driver);
  return (
    <View style={[styles.gridSlot, fav && styles.resultRowFav]}>
      <Text style={styles.gridPos}>{item.pos}</Text>
      <View style={{flex: 1, minWidth: 0}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
          {fav && <Icon name="star" size={10} color={Colors.yellow} />}
          <Text style={[styles.gridDriver, fav && {color: Colors.yellow}]} numberOfLines={1}>
            {formatDriverName(item.driver)}
          </Text>
        </View>
        {team ? <Text style={styles.gridCar} numberOfLines={1}>{team}</Text> : null}
      </View>
      {ttbBadge && (
        <View style={styles.ttbBadge} accessibilityLabel={ttbBadge.a11y}>
          <Icon name="flash-on" size={10} color={Colors.yellow} />
          <Text style={styles.ttbBadgeText}>{ttbBadge.label}</Text>
        </View>
      )}
      {reversed && <Icon name="shuffle" size={10} color={Colors.textSecondary} />}
    </View>
  );
}

function ReverseGridTab({races, isFavourite}) {
  const [reversalCount, setReversalCount] = useState(8);
  const grid = buildReverseGrid(races, reversalCount);

  if (!grid) {
    return <EmptyState icon="schedule" title="Nothing to see here. Literally." subtitle="Hang tight, results will appear when they're ready" />;
  }

  return (
    <View style={{flex: 1}}>
      <View style={styles.reverseHeader}>
        <Text style={styles.reverseTitle}>Predicted R3 Grid</Text>
        <Text style={styles.reverseSubtitle}>Draw picks 6–12 at random after R2  -  explore each scenario</Text>
        <View style={styles.reversalToggle}>
          <Text style={styles.reversalLabel}>Reverse top</Text>
          <TouchableOpacity
            style={[styles.stepperBtn, reversalCount <= REVERSAL_MIN && styles.stepperBtnDisabled]}
            onPress={() => setReversalCount(c => Math.max(REVERSAL_MIN, c - 1))}
            disabled={reversalCount <= REVERSAL_MIN}
            accessibilityRole="button"
            accessibilityLabel="Decrease reversal count">
            <Icon name="remove" size={16} color={reversalCount <= REVERSAL_MIN ? Colors.textSecondary : '#fff'} />
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{reversalCount}</Text>
          <TouchableOpacity
            style={[styles.stepperBtn, reversalCount >= REVERSAL_MAX && styles.stepperBtnDisabled]}
            onPress={() => setReversalCount(c => Math.min(REVERSAL_MAX, c + 1))}
            disabled={reversalCount >= REVERSAL_MAX}
            accessibilityRole="button"
            accessibilityLabel="Increase reversal count">
            <Icon name="add" size={16} color={reversalCount >= REVERSAL_MAX ? Colors.textSecondary : '#fff'} />
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={grid}
        keyExtractor={(_, i) => String(i)}
        renderItem={({item, index}) => {
          const fav = isFavourite(item.driver);
          const isReversed = index < reversalCount && item.r2Pos > 0;
          return (
            <View style={[styles.resultRow, fav && styles.resultRowFav, isReversed && styles.reverseRow, fav && isReversed && styles.reverseRowFav]}>
              <Text style={[styles.pos, {color: '#fff'}]}>{item.gridPos}</Text>
              <View style={{flex: 1}}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  {fav && <Icon name="star" size={11} color={Colors.yellow} />}
                  <Text style={[styles.driverName, fav && {color: Colors.yellow}]}>
                    {formatDriverName(item.driver)}
                  </Text>
                  {isReversed && <Badge text="REV" color={Colors.yellow} />}
                </View>
                <Text style={styles.teamName}>{item.team}</Text>
              </View>
              {item.r2Pos > 0 && (
                <Text style={styles.r2PosText}>P{item.r2Pos} in R2</Text>
              )}
            </View>
          );
        }}
        contentContainerStyle={{padding: 16, paddingBottom: 20 + CHAT_FAB_CLEARANCE}}
      />
    </View>
  );
}

function Badge({text, color}) {
  return (
    <View style={[styles.badge, {backgroundColor: `${color}22`}]}>
      <Text style={[styles.badgeText, {color}]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900'},
  headerSub: {color: Colors.textSecondary, fontSize: 12, marginTop: 2},
  raceTabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  raceTab: {flex: 1, paddingVertical: 10, alignItems: 'center'},
  raceTabText: {color: Colors.textSecondary, fontSize: 12, fontWeight: '700'},
  raceTabTextActive: {color: Colors.yellow},
  raceDateLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  resultRowDNF: {opacity: 0.5},
  resultRowFav: {borderWidth: 1, borderColor: 'rgba(254,189,2,0.5)'},
  pos: {fontSize: 18, fontWeight: '900', width: 36, textAlign: 'center', marginRight: 8},
  driverName: {color: '#fff', fontSize: 14, fontWeight: '700'},
  teamName: {color: Colors.textSecondary, fontSize: 11, flexShrink: 1},
  deltaRow: {flexDirection: 'row', alignItems: 'center', gap: 1},
  deltaText: {fontSize: 10, fontWeight: '800'},
  deltaFlat: {color: Colors.textSecondary, fontSize: 10, fontWeight: '700'},
  rightCol: {alignItems: 'flex-end', marginLeft: 8},
  timeText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  detailText: {color: Colors.textSecondary, fontSize: 10, marginTop: 1},
  badges: {flexDirection: 'row', gap: 4, marginTop: 3},
  badge: {borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1},
  badgeText: {fontSize: 10, fontWeight: '800'},
  pointsText: {color: Colors.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 2},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40},
  emptyState: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10},
  emptyStateIcon: {opacity: 0.25, marginBottom: 4},
  emptyStateTitle: {color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center'},
  emptyStateSubtitle: {color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18},
  reverseHeader: {padding: 16, paddingBottom: 12},
  reverseTitle: {color: '#fff', fontSize: 15, fontWeight: '800'},
  reverseSubtitle: {color: Colors.textSecondary, fontSize: 11, marginTop: 2, marginBottom: 10},
  reversalToggle: {flexDirection: 'row', alignItems: 'center', gap: 8},
  reversalLabel: {color: Colors.textSecondary, fontSize: 12, fontWeight: '600'},
  stepperBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnDisabled: {opacity: 0.4},
  stepperValue: {color: '#fff', fontSize: 16, fontWeight: '800', minWidth: 24, textAlign: 'center'},
  reverseRow: {borderLeftWidth: 3, borderLeftColor: `${Colors.yellow}60`},
  reverseRowFav: {borderLeftWidth: 3, borderLeftColor: Colors.yellow},
  r2PosText: {color: Colors.textSecondary, fontSize: 11, fontWeight: '600'},
  gridSlot: {
    height: GRID_CARD_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: 8, paddingHorizontal: 10,
  },
  gridSlotReversed: {borderWidth: 1, borderColor: `${Colors.yellow}50`},
  reversalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
    alignSelf: 'flex-start', backgroundColor: `${Colors.yellow}18`,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  reversalBadgeText: {color: Colors.yellow, fontSize: 11, fontWeight: '600'},
  ttbBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: `${Colors.yellow}18`, borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  ttbBadgeText: {color: Colors.yellow, fontSize: 10, fontWeight: '700'},
  qualGroupLabel: {color: Colors.yellow, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginBottom: 2},
  gridPos: {color: '#fff', fontSize: 16, fontWeight: '900', width: 24, textAlign: 'center'},
  gridDriver: {color: '#fff', fontSize: 12, fontWeight: '700'},
  gridCar: {color: Colors.textSecondary, fontSize: 11},
  youtubeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.25)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  youtubeBtnText: {flex: 1, color: '#fff', fontSize: 13, fontWeight: '700'},
  penaltyCard: {
    backgroundColor: `${Colors.yellow}0D`,
    borderWidth: 1,
    borderColor: `${Colors.yellow}33`,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  penaltyCardHeader: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8},
  penaltyCardTitle: {color: Colors.yellow, fontSize: 12, fontWeight: '800', letterSpacing: 0.5},
  penaltyRow: {
    borderTopWidth: 1,
    borderTopColor: `${Colors.yellow}1F`,
    paddingTop: 8,
    marginTop: 8,
  },
  penaltyDriverLine: {color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 6},
  penaltyOneLiner: {color: '#fff', fontSize: 12.5, lineHeight: 18},
  penaltyField: {marginTop: 6},
  penaltyFieldLabel: {color: Colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1},
  penaltyFieldValue: {color: '#fff', fontSize: 12.5, lineHeight: 18, marginTop: 2},
  penaltyLink: {color: Colors.yellow, fontSize: 12, fontWeight: '700', marginTop: 10},
});
