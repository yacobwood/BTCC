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

export default function TeamDetailScreen({route, navigation}) {
  const {team} = route.params;
  const insets = useSafeAreaInsets();
  const {isFavourite} = useFavouriteDriver();

  useEffect(() => { Analytics.screen('team_detail:' + team.name); }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{paddingBottom: 30}}>
        {team.carImageUrl ? (
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
            <CachedImage uri={team.carImageUrl} style={styles.carImage} resizeMode="contain" accessibilityLabel={`${team.name} car`} />
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
  carImageBg: {width: '100%', aspectRatio: 2},
  carImage: {width: '100%', flex: 1, transform: [{scale: 1.15}]},
  // Same top-right sponsor-logo treatment as DriversScreen/MerchScreen's team
  // tiles - the % box works out to a similar absolute size here despite this
  // hero being a wide 2:1 banner rather than a square tile (hero is roughly
  // 2x the tile's width, offsetting its halved aspect ratio).
  teamLogoImg: {position: 'absolute', top: 8, right: 8, width: '55%', height: '34%'},
  // Override for team.smallLogo (currently just Steel Seal): this hero's 2:1
  // aspect makes its box proportionally *wider* than the tile's square box,
  // so a wide edge-to-edge logo with no internal padding (Steel Seal's opaque
  // jpg) becomes height-constrained under `contain` and fills the box's full
  // height instead of shrinking to fit - oversized here even though the same
  // logo looks fine on the tile screens (narrower box, constrained by width
  // instead). Scoped to this one flag rather than shrinking teamLogoImg
  // itself, which would shrink every other team's hero logo too.
  teamLogoImgSmall: {position: 'absolute', top: 8, right: 8, width: '45%', height: '26%'},
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
