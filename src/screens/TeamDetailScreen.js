import React, {useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors} from '../theme/colors';
import {getDriverImage} from '../assets/driverImages';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {Analytics} from '../utils/analytics';
import {formatDriverName} from '../utils/driverName';
import CachedImage from '../components/CachedImage';

// Sponsor tier -> section label, in display order. A team's `sponsors` array
// (see parseGrid in api/parsers.js) tags each entry with one of these tiers;
// grouping rather than one flat list keeps a 20-30 sponsor team (e.g. NAPA
// Racing UK, Laser Tools Racing with MB Motorsport) scannable instead of a
// wall of same-weight names.
const SPONSOR_TIERS = [
  {key: 'principal', label: 'PRINCIPAL PARTNERS'},
  {key: 'associate', label: 'ASSOCIATE PARTNERS'},
  {key: 'technical', label: 'TECHNICAL PARTNERS'},
  {key: 'decal', label: 'ALSO ON THE CAR'},
];

// Rewrites a data/carImages/ URL to its pre-generated small thumbnail
// (<name>-thumb.webp - see scripts/generate_car_thumb.py). A car cutout here
// only ever renders at a couple hundred px, well under the full-size
// 1536x1024 original's decoded-bitmap cost (6MB regardless of how well the
// file itself compresses) - see DriversScreen.js's carThumbUrl for the full
// story (root-caused live: that cost is what exhausted Android's image
// decode pool on a 23-driver grid). This screen only ever shows 2-4 cars at
// once so it was never actually hitting that cap, but there's no reason to
// decode 15x more bitmap than the card needs just because the number here
// happens to be small.
function carThumbUrl(url) {
  if (!url) return url;
  return url.replace(/(\.[a-z0-9]+)$/i, '-thumb$1');
}

export default function TeamDetailScreen({route, navigation}) {
  const {team} = route.params;
  const insets = useSafeAreaInsets();
  const {isFavourite} = useFavouriteDriver();

  useEffect(() => { Analytics.screen('team_detail:' + team.name); }, []);

  // A single team.carImageUrl used to stand in for "the" team car, but a team
  // can field a different livery per driver (e.g. Steel Seal with Power Maxed
  // Racing: Dexter Patterson's car and Nick Halstead's separately-liveried
  // "Ask GVT" one) - team.drivers is already the active, non-reserve roster
  // (see parseGrid in api/parsers.js), each carrying their own resolved
  // carImageUrl, so showing one card per driver here is both more accurate
  // and needs no new data.
  const cars = (team.drivers || []).filter(d => d.carImageUrl);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{paddingBottom: 30}}>
        {(cars.length > 0 || team.logoUrl) ? (
          <View style={[styles.carImageBg, {marginTop: insets.top + 8}]}>
            {team.cardBgUrl ? (
              <CachedImage uri={team.cardBgUrl} style={StyleSheet.absoluteFill} resizeMode="stretch" collapsable={false} />
            ) : null}
            {team.logoUrl ? (
              <CachedImage
                uri={team.logoUrl}
                style={team.smallLogo ? styles.teamLogoImgSmall : styles.teamLogoImg}
                resizeMode="contain"
              />
            ) : null}
            {cars.length > 0 && (
              <View style={styles.carsRow}>
                {cars.map(d => (
                  <View key={d.number} style={styles.carCard}>
                    <CachedImage uri={carThumbUrl(d.carImageUrl)} style={styles.carImage} resizeMode="contain" accessibilityLabel={`${d.name}'s car`} />
                    <Text style={styles.carCaption} numberOfLines={1}>{formatDriverName(d.name)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : <View style={{height: insets.top + 8}} />}

        <View style={styles.content}>
          <Text style={styles.teamName}>{team.name}</Text>
          {team.car ? <Text style={styles.teamCar}>{team.car}</Text> : null}

          <View style={styles.statsRow}>
            {team.founded > 0 && <StatBox label="Founded" value={String(team.founded)} />}
            {team.base ? <StatBox label="Base" value={team.base} flexGrow={2} /> : null}
          </View>
          <View style={styles.statsRow}>
            <StatBox label="Cars" value={String(team.entries)} />
            {(team.totalRaces > 0 || team.totalWins > 0) && (
              <>
                <StatBox label="Races" value={String(team.totalRaces)} />
                <StatBox label="Wins" value={String(team.totalWins)} />
              </>
            )}
          </View>

          {team.bio ? (
            <View style={styles.card}>
              <Text style={styles.bioText}>{team.bio}</Text>
            </View>
          ) : null}

          {team.carSpecs && (
            <>
              <Text style={styles.sectionTitle}>CAR SPECS</Text>
              <View style={styles.card}>
                {Object.entries(team.carSpecs).map(([label, value], i, arr) => (
                  <View
                    key={label}
                    style={[styles.specRow, i < arr.length - 1 && styles.specRowBorder]}>
                    <Text style={styles.specLabel}>{label}</Text>
                    <Text style={styles.specValue}>{value}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>DRIVERS</Text>
          <View style={styles.driversGrid}>
            {team.drivers.map(d => {
              const fav = isFavourite(d.name);
              const bundled = getDriverImage(d.number);
              const blackNumber = team.lightCardBg;
              return (
                <TouchableOpacity
                  key={d.number}
                  style={[styles.driverCard, fav && styles.driverCardFav]}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('DriverDetail', {driver: d})}
                  accessibilityLabel={d.name}
                  accessibilityRole="button">
                  <View style={styles.driverImageArea}>
                    {team.cardBgUrl ? (
                      <CachedImage uri={team.cardBgUrl} style={StyleSheet.absoluteFill} resizeMode="stretch" collapsable={false} />
                    ) : null}
                    {d.numberImageUrl ? (
                      <CachedImage uri={d.numberImageUrl} style={styles.driverNumberImg} resizeMode="contain" />
                    ) : (
                      <Text style={[styles.driverNumberBg, blackNumber && {color: '#000'}]}>{d.number}</Text>
                    )}
                    {bundled ? (
                      <Image source={bundled} style={styles.driverPhoto} resizeMode="contain" fadeDuration={150} />
                    ) : d.imageUrl ? (
                      <CachedImage uri={d.imageUrl} targetWidth={300} style={styles.driverPhoto} resizeMode="contain" />
                    ) : null}
                    {fav && <View style={styles.favBadge}><Icon name="star" size={12} color={Colors.yellow} /></View>}
                  </View>
                  <View style={styles.driverFooter}>
                    <Text style={[styles.driverName, fav && {color: Colors.yellow}]} numberOfLines={1}>{formatDriverName(d.name)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {(team.driversChampionships > 0 || team.teamsChampionships > 0) && (
            <>
              <Text style={styles.sectionTitle}>CHAMPIONSHIPS</Text>
              <View style={styles.card}>
                <View style={styles.champRow}>
                  <Text style={styles.champLabel}>Drivers</Text>
                  <Text style={styles.champValue}>{team.driversChampionships}</Text>
                </View>
                <View style={styles.champRow}>
                  <Text style={styles.champLabel}>Teams</Text>
                  <Text style={styles.champValue}>{team.teamsChampionships}</Text>
                </View>
              </View>
            </>
          )}

          {((team.sponsors && team.sponsors.length > 0) || team.sponsorsNote) && (
            <>
              <Text style={styles.sectionTitle}>SPONSORS</Text>
              <View style={styles.card}>
                {team.sponsorsNote ? <Text style={styles.sponsorsNote}>{team.sponsorsNote}</Text> : null}
                {SPONSOR_TIERS.map(({key, label}) => {
                  const items = (team.sponsors || []).filter(s => s.tier === key);
                  if (!items.length) return null;
                  return (
                    <View key={key} style={styles.sponsorGroup}>
                      <Text style={styles.sponsorGroupLabel}>{label}</Text>
                      <View style={styles.sponsorChips}>
                        {items.map(s => (
                          <View
                            key={s.name}
                            style={[styles.sponsorChip, key === 'principal' && styles.sponsorChipPrincipal]}>
                            <Text
                              style={[styles.sponsorChipText, key === 'principal' && styles.sponsorChipTextPrincipal]}>
                              {s.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  // No fixed aspectRatio any more - a 4-car team (e.g. Team VERTU, NAPA Racing
  // UK) needs more height than a 2-car one, so this sizes to carsRow's content
  // instead; cardBgUrl's absoluteFill below still stretches to match whatever
  // that ends up being.
  carImageBg: {width: '100%', paddingTop: 10, paddingBottom: 14},
  carsRow: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingHorizontal: 10},
  // 46% rather than an even 50% so two cards plus the gap never wrap early on
  // narrower screens; wraps to a second row for a 3-4 driver team (e.g. Team
  // VERTU, NAPA Racing UK) instead of squeezing everyone into one line.
  carCard: {width: '46%', alignItems: 'center'},
  // aspectRatio (not a fixed height) so each car cutout's own 1536x1024
  // (3:2) proportions hold regardless of how many rows this wraps into - a
  // logo overlapping the top of a row is fine, same trick the old single-car
  // hero relied on: these cutouts carry transparent sky padding above the
  // car, so the corner logo still reads clearly through it.
  carImage: {width: '100%', aspectRatio: 1.5},
  carCaption: {color: Colors.textSecondary, fontSize: 11, fontWeight: '700', marginTop: 4},
  // Same top-right sponsor-logo treatment as DriversScreen/MerchScreen's team
  // tiles, sized to the same box this always had - but as an aspectRatio
  // rather than a height %, now that carImageBg's height is driven by how
  // many cars it holds (1-4) instead of a fixed 2:1 banner. A height % would
  // make the logo balloon for a 4-driver team's taller, two-row hero; the
  // box's *width* is still 100%-of-screen-relative either way, so deriving
  // height from width via aspectRatio (0.55 / 0.34 x the old 2:1 box) holds
  // it at the same visual size regardless of driver count.
  teamLogoImg: {position: 'absolute', top: 8, right: 8, width: '55%', aspectRatio: 3.24},
  // Override for team.smallLogo (currently just Steel Seal): this box is
  // proportionally *wider* than the standard one above, so a wide edge-to-edge
  // logo with no internal padding (Steel Seal's opaque jpg) becomes
  // height-constrained under `contain` and fills the box's full height
  // instead of shrinking to fit - oversized here even though the same logo
  // looks fine on the tile screens (narrower box, constrained by width
  // instead). Scoped to this one flag rather than shrinking teamLogoImg
  // itself, which would shrink every other team's hero logo too.
  teamLogoImgSmall: {position: 'absolute', top: 8, right: 8, width: '45%', aspectRatio: 3.46},
  content: {padding: 16},
  teamName: {color: '#fff', fontSize: 24, fontWeight: '900'},
  teamCar: {color: Colors.textSecondary, fontSize: 14, marginTop: 4},
  statsRow: {flexDirection: 'row', marginTop: 16, gap: 8},
  statBox: {flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.outline},
  statValue: {color: Colors.yellow, fontSize: 15, fontWeight: '900', textAlign: 'center'},
  statLabel: {color: Colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: 'center'},
  card: {backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginTop: 12},
  bioText: {color: Colors.textSecondary, fontSize: 14, lineHeight: 22},
  sectionTitle: {color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 24, marginBottom: 12},
  driversGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  driverCard: {width: (SCREEN_WIDTH - 32 - 10) / 2, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.card},
  driverCardFav: {borderWidth: 1, borderColor: 'rgba(254,189,2,0.5)'},
  driverImageArea: {width: '100%', aspectRatio: 1, justifyContent: 'flex-end', alignItems: 'center'},
  driverPhoto: {width: '100%', height: '85%'},
  driverNumberBg: {position: 'absolute', top: -10, right: 5, fontSize: 80, fontWeight: '900', color: '#fff', lineHeight: 90},
  // Branded number-graphic replacement for driverNumberBg above (used when
  // the driver has a numberImageUrl) - same footprint as DriversScreen's tile.
  driverNumberImg: {position: 'absolute', top: 0, right: 0, width: '60%', height: '48%'},
  favBadge: {position: 'absolute', top: 8, right: 8},
  driverFooter: {padding: 10},
  driverName: {color: '#fff', fontSize: 13, fontWeight: '800'},
  specRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, alignItems: 'flex-start'},
  specRowBorder: {borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outline},
  specLabel: {color: Colors.textSecondary, fontSize: 12, flex: 1},
  specValue: {color: '#fff', fontSize: 12, fontWeight: '700', flex: 1.4, textAlign: 'right'},
  champRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4},
  champLabel: {color: Colors.textSecondary, fontSize: 13},
  champValue: {color: Colors.yellow, fontSize: 14, fontWeight: '800'},
  sponsorsNote: {color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic', lineHeight: 18, marginBottom: 12},
  sponsorGroup: {marginBottom: 12},
  sponsorGroupLabel: {color: Colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6},
  sponsorChips: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  sponsorChip: {backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.outline},
  sponsorChipPrincipal: {backgroundColor: 'rgba(254,189,2,0.12)', borderColor: 'rgba(254,189,2,0.4)'},
  sponsorChipText: {color: '#fff', fontSize: 12, fontWeight: '600'},
  sponsorChipTextPrincipal: {color: Colors.yellow, fontWeight: '800'},
  backBtn: {
    position: 'absolute',
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
