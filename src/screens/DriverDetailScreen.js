import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
} from 'react-native';

const BUNDLED_DRIVERS = require('../../data/drivers.json');
const BUNDLED_CALENDAR = require('../../data/calendar.json');
const CURRENT_SEASON = BUNDLED_CALENDAR.season;
import Svg, {Polyline, Line, Circle, Text as SvgText} from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {getDriverImage} from '../assets/driverImages';
import CachedImage from '../components/CachedImage';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {Analytics} from '../utils/analytics';
import {formatDriverName} from '../utils/driverName';
import {fetchResults, fetchStandings, fetchDrivers} from '../api/client';
import {attachTeamDisplayFields, parseDriverHistory} from '../api/parsers';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';

// Rewrites a data/carImages/ URL to its pre-generated small thumbnail,
// cropped tight to the visible car (<name>-thumb-crop.webp - see
// scripts/generate_car_thumb.py). Deliberately NOT the same plain -thumb
// file TeamDetailScreen.js's carImage uses - that file keeps its full
// ~40%/16% top/bottom padding on purpose, since TeamDetailScreen's sponsor
// logo overlays the top of the car cards and relies on that padding being
// blank so it doesn't clash with the car artwork. This banner has no
// overlay to protect, so it uses the cropped variant instead - carStrip's
// aspectRatio below is tuned to that crop, not the padded original.
// Android decodes an image to a bitmap sized off pixel dimensions, not file
// size, so the full-size 1536x1024 original costs 6MB of decoded memory
// even though this screen only ever shows one at a time. This screen never
// hit the multi-driver decode-pool cap that originally motivated shrinking
// these in the first place (DriversScreen's tile, back when it rendered one
// per driver on a long grid), but there's no reason to decode 15x more
// bitmap than this banner needs just because only one is on screen here.
function carThumbUrl(url) {
  if (!url) return url;
  return url.replace(/(\.[a-z0-9]+)$/i, '-thumb-crop$1');
}

function formatDob(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});
  } catch { return null; }
}

function calcAge(dateStr) {
  if (!dateStr) return null;
  const dob = new Date(dateStr);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

// Deep-link lookups read raw JSON directly (not via parseGrid()), so the found
// driver is missing cls/cardBgUrl/lightCardBg and has unshaped history entries
// (champion, not isChampion) unless run through the same helpers parseGrid()
// uses - otherwise the class chip, champion gold styling and header
// background silently disappear only for deep-linked profiles.
function shapeDeepLinkedDriver(rawDriver, rawTeams) {
  if (!rawDriver) return rawDriver;
  return attachTeamDisplayFields({...rawDriver, history: parseDriverHistory(rawDriver.history)}, rawTeams);
}

export default function DriverDetailScreen({route, navigation}) {
  const driverParam = route.params?.driver ?? null;
  const slugParam = route.params?.slug ?? null;
  const [driver, setDriver] = useState(
    driverParam ?? (slugParam
      ? shapeDeepLinkedDriver(
          BUNDLED_DRIVERS.drivers.find(d => d.name.toLowerCase().replace(/\s+/g, '-') === slugParam),
          BUNDLED_DRIVERS.teams,
        )
      : null),
  );

  // For deep-link navigation (slug only), refresh driver data from the network
  // so profile corrections in drivers.json are visible without a rebuild.
  useEffect(() => {
    if (!slugParam || driverParam) return;
    fetchDrivers().then(data => {
      const found = (data?.drivers || []).find(d => d.name.toLowerCase().replace(/\s+/g, '-') === slugParam);
      if (found) setDriver(shapeDeepLinkedDriver(found, data?.teams));
    }).catch(() => {});
  }, []);

  // Regression: this used to sit before the hooks below, so a deep-linked
  // driver (which starts null and populates async once fetchDrivers()
  // resolves) called a different number of hooks on its first render than on
  // every render after - a React rules-of-hooks violation that crashes the
  // screen. Every hook must run unconditionally on every render; only the
  // early return may depend on `driver`, and it must come after all of them.
  const {isFavourite, toggle: toggleFav} = useFavouriteDriver();
  const fav = driver ? isFavourite(driver.name) : false;
  const insets = useSafeAreaInsets();

  const [liveSeason, setLiveSeason] = useState(null);

  useEffect(() => {
    if (!driver) return;
    Analytics.screen('driver_detail:' + driver.name);
  }, [driver?.name]);

  useFocusEffect(useCallback(() => {
    if (!driver || !driver.team || (driver.history || []).some(h => h.year === CURRENT_SEASON)) return;
    fetchStandings(true).then(sData => {
      const entry = (sData.standings || []).find(
        s => formatDriverName(s.driver) === formatDriverName(driver.name),
      );
      const pts = entry ? (entry.points || 0) : 0;
      const w   = entry ? (entry.wins || 0) : 0;
      const p   = entry ? w + (entry.seconds || 0) + (entry.thirds || 0) : 0;
      fetchResults(CURRENT_SEASON).then(rData => {
        let fastestLaps = 0, poles = 0, dnfs = 0;
        for (const round of (rData.rounds || [])) {
          for (const race of (round.races || [])) {
            const e = (race.results || []).find(r => formatDriverName(r.driver) === formatDriverName(driver.name));
            if (!e) continue;
            const isRace = race.label === 'Race 1' || race.label === 'Race 2' || race.label === 'Race 3';
            if (e.pos === 0 && isRace) dnfs++;
            if (e.pole) poles++;
            if (e.fastestLap && isRace) fastestLaps++;
          }
        }
        setLiveSeason({wins: w, podiums: p, points: pts, fastestLaps, poles, dnfs});
      }).catch(() => setLiveSeason({wins: w, podiums: p, points: pts, fastestLaps: 0, poles: 0, dnfs: 0}));
    }).catch(() => setLiveSeason({wins: 0, podiums: 0, points: 0, fastestLaps: 0, poles: 0, dnfs: 0}));
  }, [driver?.name, driver?.team]));

  if (!driver) return null;

  const history = driver.history || [];
  // Whether the current season is a live season (not yet in history JSON)
  const hasCurrentSeasonInHistory = history.some(h => h.year === CURRENT_SEASON);
  const live = (!hasCurrentSeasonInHistory && liveSeason) ? liveSeason : null;

  // Career stats  -  merge the live current season on top of historical data
  const totalSeasons = history.length + (live ? 1 : 0);
  const totalWins = history.reduce((s, h) => s + h.wins, 0) + (live?.wins || 0);
  const totalPodiums = history.reduce((s, h) => s + h.podiums, 0) + (live?.podiums || 0);
  const totalPoles = history.reduce((s, h) => s + h.poles, 0) + (live?.poles || 0);
  const totalFL = history.reduce((s, h) => s + h.fastestLaps, 0) + (live?.fastestLaps || 0);
  const totalPoints = history.reduce((s, h) => s + h.points, 0) + (live?.points || 0);
  const totalDNFs = history.reduce((s, h) => s + (h.dnfs || 0), 0) + (live?.dnfs || 0);
  const championships = history.filter(h => h.isChampion).length;
  const bestPos = history.filter(h => h.pos > 0).reduce((best, h) => Math.min(best, h.pos), 999);

  const age = calcAge(driver.dateOfBirth);
  const dobFormatted = formatDob(driver.dateOfBirth);

  const bundledImg = getDriverImage(driver.number);

  const onShare = async () => {
    const slug = driver.name.toLowerCase().replace(/\s+/g, '-');
    Analytics.screen('driver_detail_share:' + driver.name);
    await Share.share({message: `${driver.name} - ${CURRENT_SEASON} BTCC\n\nbtccfanhub://drivers/${slug}`});
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{paddingBottom: 30}}>
        {/* Header */}
        <View style={styles.headerBg}>
          {driver.cardBgUrl ? (
            <CachedImage uri={driver.cardBgUrl} style={StyleSheet.absoluteFill} resizeMode="stretch" collapsable={false} />
          ) : null}
          {driver.numberImageUrl ? (
            <CachedImage uri={driver.numberImageUrl} style={styles.headerNumberImg} resizeMode="contain" />
          ) : (
            <Text style={[styles.headerNumber, driver.lightCardBg && {color: '#000'}]}>{driver.number}</Text>
          )}
          {bundledImg ? (
            <Image source={bundledImg} style={styles.headerPhoto} resizeMode="contain" accessibilityLabel={`Photo of ${driver.name}`} fadeDuration={150} />
          ) : driver.imageUrl ? (
            <CachedImage uri={driver.imageUrl} targetWidth={300} style={styles.headerPhoto} resizeMode="contain" accessibilityLabel={`Photo of ${driver.name}`} />
          ) : null}
        </View>
        <View style={styles.headerFooter}>
          <View style={{flex: 1}}>
            <Text style={styles.name}>{formatDriverName(driver.name)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => { Analytics.favouriteToggled(driver.name, !fav); toggleFav(driver.name); }}
            accessibilityLabel={`${fav ? 'Remove from' : 'Add to'} favourites`}
            accessibilityRole="button">
            <Icon name={fav ? 'star' : 'star-outline'} size={28} color={fav ? Colors.yellow : Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {/* The driver's own car, not a shared team one, since a team can
            field more than one livery (see DriversScreen's comment for the
            full story). After four header arrangements that all fought the
            header's square shape (bottom-left/bottom-right badges, then
            rotated strips on the right and left), moved out of the header
            entirely into its own full-bleed banner - shown at its natural,
            unrotated landscape orientation, so there's no rotation math or
            competing-for-space problem left to solve. */}
        {driver.carImageUrl ? (
          <View style={styles.carStrip}>
            <CachedImage
              uri={carThumbUrl(driver.carImageUrl)}
              style={styles.carStripImg}
              resizeMode="contain"
              accessibilityLabel={`${driver.name}'s car`}
            />
          </View>
        ) : null}

        <View style={styles.content}>
          {/* Key facts */}
          <View style={styles.keyFacts}>
            <View style={styles.statsRow}>
              {driver.nationality ? <StatBox label="Nationality" value={driver.nationality} /> : null}
              {driver.team ? <StatBox label="Team" value={driver.team} /> : null}
            </View>
            {(driver.car || driver.cls === 'I' || driver.cls === 'M') && (
              <View style={styles.statsRow}>
                {driver.car ? <StatBox label="Car" value={driver.car} /> : null}
                {driver.cls === 'I' ? <StatBox label="Class" value="Independents" /> : null}
                {driver.cls === 'M' ? <StatBox label="Class" value="Main Championship" /> : null}
              </View>
            )}
          </View>

          {/* Bio */}
          {driver.bio ? (
            <View style={styles.card}>
              <Text style={styles.bioText}>{driver.bio}</Text>
            </View>
          ) : null}

          {/* Personal info */}
          {(age || driver.birthplace || driver.livesIn) ? (
            <View style={styles.card}>
              {age && dobFormatted ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Age</Text>
                  <Text style={styles.infoValue}>{age}  ·  {dobFormatted}</Text>
                </View>
              ) : null}
              {age && driver.birthplace ? <View style={styles.infoDivider} /> : null}
              {driver.birthplace ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Birthplace</Text>
                  <Text style={styles.infoValue}>{driver.birthplace}</Text>
                </View>
              ) : null}
              {(age || driver.birthplace) && driver.livesIn ? <View style={styles.infoDivider} /> : null}
              {driver.livesIn ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Lives in</Text>
                  <Text style={styles.infoValue}>{driver.livesIn}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Career stats - only shown for drivers with prior seasons */}
          {history.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>BTCC CAREER</Text>
              <View style={styles.card}>
                <View style={styles.careerGrid}>
                  <CareerStat label="Wins" value={totalWins} highlight={totalWins > 0} />
                  <View style={styles.careerDivider} />
                  <CareerStat label="Podiums" value={totalPodiums} />
                  <View style={styles.careerDivider} />
                  <CareerStat label="Poles" value={totalPoles} />
                  <View style={styles.careerDivider} />
                  <CareerStat label="Fastest Laps" value={totalFL} />
                </View>
                <View style={styles.careerSeparator} />
                <View style={styles.careerGrid}>
                  <CareerStat label="Seasons" value={totalSeasons} />
                  <View style={styles.careerDivider} />
                  <CareerStat label="Points" value={totalPoints} />
                  <View style={styles.careerDivider} />
                  {championships > 0 ? (
                    <View style={styles.careerStatBox}>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                        <Icon name="emoji-events" size={16} color={Colors.yellow} />
                        <Text style={[styles.careerStatValue, {color: Colors.yellow}]}>{championships}</Text>
                      </View>
                      <Text style={styles.careerStatLabel}>{championships === 1 ? 'Title' : 'Titles'}</Text>
                    </View>
                  ) : bestPos < 999 ? (
                    <CareerStat label="Best Finish" value={`P${bestPos}`} />
                  ) : (
                    <View style={styles.careerStatBox} />
                  )}
                  <View style={styles.careerDivider} />
                  <CareerStat label="DNFs" value={totalDNFs} />
                </View>
              </View>

              <CareerTimeline history={history} />
            </>
          )}

          {/* Season history - shown for any active driver or driver with prior history */}
          {(driver.team || history.length > 0) && (
            <Text style={styles.sectionTitle}>SEASON HISTORY</Text>
          )}
          {driver.team && !history.some(h => h.year === CURRENT_SEASON) && (
            <View style={[styles.historyRow, {borderLeftWidth: 3, borderLeftColor: Colors.textSecondary}]}>
              <View style={styles.historyTopLine}>
                <View style={styles.historyYearCol}>
                  <Text style={styles.historyYear}>{CURRENT_SEASON}</Text>
                </View>
                <View style={styles.inProgressBadge}>
                  <Text style={styles.inProgressText}>IN PROGRESS</Text>
                </View>
              </View>
              <Text style={styles.historyTeam}>{driver.team}</Text>
              {driver.car ? <Text style={styles.historyCar}>{driver.car}</Text> : null}
              {liveSeason && (
                <View style={styles.historyBadges}>
                  <View style={styles.badgePts}><Text style={styles.badgePtsText}>{liveSeason.points} pts</Text></View>
                  {liveSeason.wins > 0 && <View style={styles.badgeWin}><Text style={styles.badgeWinText}>{liveSeason.wins} W</Text></View>}
                  {liveSeason.podiums > 0 && <View style={styles.badgePodium}><Text style={styles.badgePodiumText}>{liveSeason.podiums} P</Text></View>}
                  {liveSeason.fastestLaps > 0 && <View style={styles.badgeFL}><Text style={styles.badgeFLText}>{liveSeason.fastestLaps} FL</Text></View>}
                  {liveSeason.dnfs > 0 && <View style={styles.badgeDNF}><Text style={styles.badgeDNFText}>{liveSeason.dnfs} DNF</Text></View>}
                </View>
              )}
            </View>
          )}
          {[...history].sort((a, b) => b.year - a.year).map(h => {
            const posColor = h.isChampion || h.pos === 1 ? Colors.yellow
              : h.pos === 2 ? '#C0C0C0'
              : h.pos === 3 ? '#CD7F32'
              : h.pos <= 10 ? '#fff'
              : Colors.textSecondary;
            return (
              <View key={h.year} style={[
                styles.historyRow,
                h.isChampion && {borderLeftWidth: 3, borderLeftColor: Colors.yellow},
              ]}>
                <View style={styles.historyTopLine}>
                  <View style={styles.historyYearCol}>
                    <Text style={[styles.historyYear, h.isChampion && {color: Colors.yellow}]}>{h.year}</Text>
                    {h.isChampion && <Icon name="emoji-events" size={14} color={Colors.yellow} />}
                  </View>
                  <Text style={[styles.historyPos, {color: posColor}]}>P{h.pos}</Text>
                </View>
                <Text style={styles.historyTeam}>{h.team}</Text>
                {h.car ? <Text style={styles.historyCar}>{h.car}</Text> : null}
                <View style={styles.historyBadges}>
                  <View style={styles.badgePts}><Text style={styles.badgePtsText}>{h.points} pts</Text></View>
                  {h.wins > 0 && <View style={styles.badgeWin}><Text style={styles.badgeWinText}>{h.wins} W</Text></View>}
                  {h.podiums > 0 && <View style={styles.badgePodium}><Text style={styles.badgePodiumText}>{h.podiums} P</Text></View>}
                  {h.poles > 0 && <View style={styles.badgePole}><Text style={styles.badgePoleText}>{h.poles} PL</Text></View>}
                  {h.fastestLaps > 0 && <View style={styles.badgeFL}><Text style={styles.badgeFLText}>{h.fastestLaps} FL</Text></View>}
                  {h.dnfs > 0 && <View style={styles.badgeDNF}><Text style={styles.badgeDNFText}>{h.dnfs} DNF</Text></View>}
                </View>
              </View>
            );
          })}
          {history.length > 0 && (
            <View style={styles.legend}>
              <Text style={styles.legendItem}>
                <Text style={{color: Colors.yellow}}>W</Text>
                <Text style={styles.legendLabel}> Wins  </Text>
                <Text style={{color: '#C0C0C0'}}>P</Text>
                <Text style={styles.legendLabel}> Podiums  </Text>
                <Text style={{color: '#5BA3FF'}}>PL</Text>
                <Text style={styles.legendLabel}> Poles  </Text>
                <Text style={{color: '#A855F7'}}>FL</Text>
                <Text style={styles.legendLabel}> Fastest Laps  </Text>
                <Text style={{color: '#ff4444'}}>DNF</Text>
                <Text style={styles.legendLabel}> Did Not Finish</Text>
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.backBtn, {top: insets.top + 8}]}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Go back"
        accessibilityRole="button">
        <Icon name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.shareBtn, {top: insets.top + 8}]}
        onPress={onShare}
        accessibilityLabel="Share driver"
        accessibilityRole="button">
        <Icon name="share" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function CareerTimeline({history}) {
  const entries = [...history].filter(h => h.pos > 0).sort((a, b) => a.year - b.year);
  if (entries.length < 2) return null;

  const LABEL_W = 30;
  const H = 130;
  const PR = 8, PL = 6, PT = 14, PB = 18;
  // SVG width excludes the native label column
  const svgW = Dimensions.get('window').width - 32 - 16 - LABEL_W;
  const plotW = svgW - PL - PR;
  const plotH = H - PT - PB;

  const maxPos = Math.max(...entries.map(e => e.pos), 10);
  const xOf = i => PL + (i / (entries.length - 1)) * plotW;
  const yOf = pos => PT + ((pos - 1) / (maxPos - 1)) * plotH;

  const ticks = [1];
  for (let v = 5; v <= maxPos; v += 5) ticks.push(v);
  const linePoints = entries.map((h, i) => `${xOf(i)},${yOf(h.pos)}`).join(' ');

  const dotColor = h =>
    h.isChampion ? Colors.yellow :
    h.pos === 2 ? '#C0C0C0' :
    h.pos === 3 ? '#CD7F32' :
    h.pos <= 10 ? '#fff' :
    Colors.textSecondary;

  return (
    <View style={{backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 8, paddingTop: 10, paddingBottom: 6, marginBottom: 12, overflow: 'hidden', flexDirection: 'row', alignItems: 'flex-start'}}>
      {/* Y-axis labels as native Text  -  outside SVG to avoid SVG clipping */}
      <View style={{width: LABEL_W, height: H}}>
        {ticks.map(v => (
          <Text key={v} style={{position: 'absolute', top: yOf(v) - 6, right: 4, color: Colors.textSecondary, fontSize: 8, fontWeight: '600'}}>P{v}</Text>
        ))}
      </View>
      <Svg width={svgW} height={H}>
        {ticks.map(v => (
          <Line key={v} x1={PL} y1={yOf(v)} x2={svgW - PR} y2={yOf(v)} stroke={Colors.outline} strokeWidth={0.5} />
        ))}
        <Polyline points={linePoints} fill="none" stroke="rgba(139,143,168,0.35)" strokeWidth={1.5} strokeLinejoin="round" />
        {entries.map((h, i) => (
          <React.Fragment key={h.year}>
            <Circle cx={xOf(i)} cy={yOf(h.pos)} r={4} fill={dotColor(h)} />
            {h.isChampion && (
              <SvgText x={xOf(i)} y={yOf(h.pos) - 7} fill={Colors.yellow} fontSize={9} textAnchor="middle">★</SvgText>
            )}
          </React.Fragment>
        ))}
        {entries.map((h, i) => (
          <SvgText key={h.year} x={xOf(i)} y={H - 2} fill={Colors.textSecondary} fontSize={8} textAnchor="middle">
            '{String(h.year).slice(2)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

function StatBox({label, value, flexGrow = 1}) {
  return (
    <View style={[styles.statBox, {flex: flexGrow}]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CareerStat({label, value, highlight}) {
  return (
    <View style={styles.careerStatBox}>
      <Text style={[styles.careerStatValue, highlight && {color: Colors.yellow}]}>
        {value}
      </Text>
      <Text style={styles.careerStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},

  // Header
  // Back to the simple driver + number layout this had before the car ever
  // lived in this header (2026-08-21's various rotated-strip attempts all
  // eventually moved out to carStrip below instead) - centered photo,
  // number top-right, nothing else competing for the square's space.
  headerBg: {width: '100%', aspectRatio: 1, justifyContent: 'flex-end', alignItems: 'center'},
  // top lowered from -4 (by request) - was sitting right at/above the very
  // top edge of the header, crowding the status bar/back button row. First
  // pass (-4 -> 56) overshot; halved back to -4 -> 26 by request.
  headerNumber: {
    position: 'absolute',
    top: 26,
    right: 5,
    fontSize: 110,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 128,
  },
  headerPhoto: {width: '100%', height: '90%'},
  // Branded number-graphic replacement for headerNumber above (used when the
  // driver has a numberImageUrl) - same top-right footprint, sized as a % of
  // the square headerBg. top lowered from 0 to match headerNumber above, by
  // the same request - same overshoot-then-halve as headerNumber (0 -> 60,
  // then 0 -> 30).
  headerNumberImg: {position: 'absolute', top: 30, right: 0, width: '45%', height: '36%'},
  // Full-bleed banner between the name row and the stat boxes - the car at
  // its natural, unrotated landscape orientation, on its own tinted band
  // rather than squeezed into the header.
  carStrip: {
    width: '100%',
    // 3.1 matches the -thumb files' own cropped aspect ratio (median 3.08,
    // mean 3.09 across all 23 drivers, checked directly rather than
    // assumed - see generate_car_thumb.py's crop step) so `contain` fills
    // nearly all of both axes instead of being capped on one. Two earlier
    // values got this wrong: 2.6 (an arbitrary banner shape, wider than
    // any car actually was) and 1536/1024 (the *uncropped* canvas's own
    // shape, before the crop step existed - the canvas was ~40% blank
    // space above the car and ~16% below, so matching it just meant the
    // padding rode along at full size instead of being removed).
    aspectRatio: 3.1,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  // Widened from 85% (by request, "almost full width") - now that
  // carStrip's own aspect ratio matches the image, this box is what
  // actually determines the car's rendered size, so widening it here
  // works as expected.
  carStripImg: {width: '94%', height: '94%'},
  headerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  name: {color: '#fff', fontSize: 20, fontWeight: '900'},
  // Wraps the stat-tile rows so every gap in this section is the same 16px:
  // `content`'s own padding supplies the gap above the first row, `gap`
  // supplies the row-to-row gap, and marginBottom supplies the gap below -
  // `statsRow` itself carries no vertical margin, or the top row would get
  // double spacing (content padding + its own marginTop).
  keyFacts: {marginBottom: 16, gap: 16},
  statsRow: {flexDirection: 'row', gap: 8},
  statBox: {flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.outline},
  statValue: {color: Colors.yellow, fontSize: 15, fontWeight: '900', textAlign: 'center'},
  statLabel: {color: Colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: 'center'},

  // Content
  content: {padding: 16},
  card: {backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginBottom: 12},
  bioText: {color: Colors.textSecondary, fontSize: 14, lineHeight: 22},

  // Personal info
  infoRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4},
  infoLabel: {color: Colors.textSecondary, fontSize: 13},
  infoValue: {color: '#fff', fontSize: 13, fontWeight: '600'},
  infoDivider: {height: 1, backgroundColor: 'rgba(42,45,68,0.4)', marginVertical: 6},

  // Section titles
  sectionTitle: {color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 12, marginBottom: 12},

  // Career stats
  careerGrid: {flexDirection: 'row', alignItems: 'center'},
  careerDivider: {width: 1, height: 36, backgroundColor: 'rgba(42,45,68,0.6)'},
  careerSeparator: {height: 1, backgroundColor: 'rgba(42,45,68,0.6)', marginVertical: 12},
  careerStatBox: {flex: 1, alignItems: 'center', paddingVertical: 4},
  careerStatValue: {color: '#fff', fontSize: 20, fontWeight: '900'},
  careerStatLabel: {color: Colors.textSecondary, fontSize: 10, fontWeight: '700', marginTop: 2},

  // Season history
  historyRow: {
    flexDirection: 'column',
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  historyTopLine: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3},
  historyYearCol: {flexDirection: 'row', alignItems: 'center', gap: 4},
  historyYear: {color: '#fff', fontSize: 15, fontWeight: '900'},
  historyTeam: {color: '#fff', fontSize: 13, fontWeight: '600'},
  historyCar: {color: Colors.textSecondary, fontSize: 11, marginTop: 1},
  historyPos: {color: Colors.textSecondary, fontSize: 15, fontWeight: '900'},
  historyBadges: {flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center'},
  badgePts: {backgroundColor: 'rgba(0,200,83,0.12)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3},
  badgePtsText: {color: '#00C853', fontSize: 11, fontWeight: '600'},
  badgeWin: {backgroundColor: 'rgba(254,189,2,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3},
  badgeWinText: {color: Colors.yellow, fontSize: 11, fontWeight: '800'},
  badgePodium: {backgroundColor: 'rgba(192,192,192,0.12)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3},
  badgePodiumText: {color: '#C0C0C0', fontSize: 11, fontWeight: '700'},
  badgePole: {backgroundColor: 'rgba(91,163,255,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3},
  badgePoleText: {color: '#5BA3FF', fontSize: 11, fontWeight: '700'},
  badgeFL: {backgroundColor: 'rgba(168,85,247,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3},
  badgeFLText: {color: '#A855F7', fontSize: 11, fontWeight: '800'},
  badgeDNF: {backgroundColor: 'rgba(255,68,68,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3},
  badgeDNFText: {color: '#ff4444', fontSize: 11, fontWeight: '700'},

  // In progress badge
  inProgressBadge: {backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3},
  inProgressText: {color: Colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5},

  // Legend
  legend: {marginTop: 8, alignItems: 'center'},
  legendItem: {fontSize: 11, fontWeight: '700'},
  legendLabel: {color: Colors.textSecondary, fontWeight: '500'},

  // Back button
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    position: 'absolute',
    top: 50,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
