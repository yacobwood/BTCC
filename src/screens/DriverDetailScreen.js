import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {getDriverImage} from '../assets/driverImages';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {Analytics} from '../utils/analytics';
import {fetchResults} from '../api/client';

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

export default function DriverDetailScreen({route, navigation}) {
  const {driver} = route.params;
  const {isFavourite, toggle: toggleFav} = useFavouriteDriver();
  const fav = isFavourite(driver.name);

  const [season2026, setSeason2026] = useState(null);

  useEffect(() => { Analytics.screen('driver_detail:' + driver.name); }, []);

  useEffect(() => {
    if (!driver.team || (driver.history || []).some(h => h.year === 2026)) return;
    fetchResults(2026).then(data => {
      let wins = 0, podiums = 0, points = 0, fastestLaps = 0;
      for (const round of (data.rounds || [])) {
        for (const race of (round.races || [])) {
          const results = race.results || [];
          const entry = results.find(r => r.driver === driver.name);
          if (!entry) continue;
          if (entry.pos === 1) wins++;
          if (entry.pos <= 3) podiums++;
          points += entry.points || 0;
          // Fastest lap: driver with shortest bestLap time in the race
          const times = results.map(r => r.bestLap).filter(Boolean);
          if (times.length > 0) {
            const fastest = times.slice().sort()[0];
            if (entry.bestLap === fastest) fastestLaps++;
          }
        }
      }
      setSeason2026({wins, podiums, points, fastestLaps});
    }).catch(() => {});
  }, [driver.name, driver.team]);

  const history = driver.history || [];

  // Career stats
  const totalSeasons = history.length;
  const totalWins = history.reduce((s, h) => s + h.wins, 0);
  const totalPodiums = history.reduce((s, h) => s + h.podiums, 0);
  const totalPoles = history.reduce((s, h) => s + h.poles, 0);
  const totalFL = history.reduce((s, h) => s + h.fastestLaps, 0);
  const totalPoints = history.reduce((s, h) => s + h.points, 0);
  const championships = history.filter(h => h.isChampion).length;
  const bestPos = history.filter(h => h.pos > 0).reduce((best, h) => Math.min(best, h.pos), 999);

  const age = calcAge(driver.dateOfBirth);
  const dobFormatted = formatDob(driver.dateOfBirth);

  const bundledImg = getDriverImage(driver.number);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{paddingBottom: 30}}>
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarWrap}>
              {bundledImg ? (
                <Image source={bundledImg} style={styles.avatarImg} resizeMode="cover" accessibilityLabel={`Photo of ${driver.name}`} />
              ) : driver.imageUrl ? (
                <Image source={{uri: driver.imageUrl}} style={styles.avatarImg} resizeMode="cover" accessibilityLabel={`Photo of ${driver.name}`} />
              ) : (
                <Icon name="person" size={48} color={Colors.textSecondary} />
              )}
            </View>
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{driver.number}</Text>
            </View>
          </View>

          <Text style={styles.name}>{driver.name}</Text>

          <TouchableOpacity onPress={() => { Analytics.favouriteToggled(driver.name, !fav); toggleFav(driver.name); }} style={{marginTop: 4}} accessibilityLabel={`${fav ? 'Remove from' : 'Add to'} favourites`} accessibilityRole="button">
            <Icon
              name={fav ? 'star' : 'star-outline'}
              size={28}
              color={fav ? Colors.yellow : Colors.textSecondary}
            />
          </TouchableOpacity>

          <View style={styles.chipsRow}>
            <Chip text={driver.nationality} />
            {driver.team ? <Chip text={driver.team} /> : null}
            {driver.car ? <Chip text={driver.car} /> : null}
          </View>
        </View>

        <View style={styles.content}>
          {/* Bio */}
          {driver.bio ? (
            <View style={styles.card}>
              <Text style={styles.bioText}>{driver.bio}</Text>
            </View>
          ) : null}

          {/* Personal info */}
          {(age || driver.birthplace) ? (
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
            </View>
          ) : null}

          {/* Career stats */}
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
                  {bestPos < 999
                    ? <CareerStat label="Best Finish" value={`P${bestPos}`} />
                    : <View style={styles.careerStatBox} />}
                  {championships > 0 && <>
                    <View style={styles.careerDivider} />
                    <View style={styles.careerStatBox}>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                        <Icon name="emoji-events" size={16} color={Colors.yellow} />
                        <Text style={[styles.careerStatValue, {color: Colors.yellow}]}>{championships}</Text>
                      </View>
                      <Text style={styles.careerStatLabel}>{championships === 1 ? 'Title' : 'Titles'}</Text>
                    </View>
                  </>}
                </View>
              </View>

              {/* Season history */}
              <Text style={styles.sectionTitle}>SEASON HISTORY</Text>
              {driver.team && !history.some(h => h.year === 2026) && (
                <View style={[styles.historyRow, {borderLeftWidth: 3, borderLeftColor: Colors.textSecondary}]}>
                  <View style={styles.historyTopLine}>
                    <View style={styles.historyYearCol}>
                      <Text style={styles.historyYear}>2026</Text>
                    </View>
                    <View style={styles.inProgressBadge}>
                      <Text style={styles.inProgressText}>IN PROGRESS</Text>
                    </View>
                  </View>
                  <Text style={styles.historyTeam}>{driver.team}</Text>
                  {driver.car ? <Text style={styles.historyCar}>{driver.car}</Text> : null}
                  {season2026 && season2026.points > 0 && (
                    <View style={styles.historyBadges}>
                      <View style={styles.badgePts}><Text style={styles.badgePtsText}>{season2026.points} pts</Text></View>
                      {season2026.wins > 0 && <View style={styles.badgeWin}><Text style={styles.badgeWinText}>{season2026.wins} W</Text></View>}
                      {season2026.podiums > 0 && <View style={styles.badgePodium}><Text style={styles.badgePodiumText}>{season2026.podiums} P</Text></View>}
                      {season2026.fastestLaps > 0 && <View style={styles.badgeFL}><Text style={styles.badgeFLText}>{season2026.fastestLaps} FL</Text></View>}
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
                    </View>
                  </View>
                );
              })}
              <View style={styles.legend}>
                <Text style={styles.legendItem}>
                  <Text style={{color: Colors.yellow}}>W</Text>
                  <Text style={styles.legendLabel}> Wins  </Text>
                  <Text style={{color: '#C0C0C0'}}>P</Text>
                  <Text style={styles.legendLabel}> Podiums  </Text>
                  <Text style={{color: '#5BA3FF'}}>PL</Text>
                  <Text style={styles.legendLabel}> Poles  </Text>
                  <Text style={{color: '#A855F7'}}>FL</Text>
                  <Text style={styles.legendLabel}> Fastest Laps</Text>
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Go back"
        accessibilityRole="button">
        <Icon name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function Chip({text}) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
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
  headerSection: {alignItems: 'center', paddingTop: 80, paddingBottom: 16},
  avatarContainer: {
    width: 100,
    height: 100,
  },
  avatarWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: {width: 100, height: 160, position: 'absolute', top: 0},
  numberBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: Colors.background,
    minWidth: 24,
    alignItems: 'center',
  },
  numberText: {color: '#fff', fontSize: 11, fontWeight: '900'},
  name: {color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 12},
  chipsRow: {flexDirection: 'row', marginTop: 8, gap: 8, flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 16},
  chip: {backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4},
  chipText: {color: Colors.textSecondary, fontSize: 12, fontWeight: '600'},

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
});
