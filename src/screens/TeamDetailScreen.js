import React, {useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ImageBackground,
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

export default function TeamDetailScreen({route, navigation}) {
  const {team} = route.params;
  const insets = useSafeAreaInsets();
  const {isFavourite} = useFavouriteDriver();

  useEffect(() => { Analytics.screen('team_detail:' + team.name); }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{paddingBottom: 30}}>
        {team.carImageUrl ? (
          <ImageBackground
            source={team.cardBgUrl ? {uri: team.cardBgUrl} : undefined}
            style={[styles.carImageBg, {marginTop: insets.top + 8}]}
            resizeMode="stretch">
            <Image source={{uri: team.carImageUrl}} style={styles.carImage} resizeMode="contain" accessibilityLabel={`${team.name} car`} />
          </ImageBackground>
        ) : <View style={{height: insets.top + 8}} />}

        <View style={styles.content}>
          <Text style={styles.teamName}>{team.name}</Text>
          {team.car ? <Text style={styles.teamCar}>{team.car}</Text> : null}

          <View style={styles.statsRow}>
            {team.founded > 0 && <StatBox label="Founded" value={String(team.founded)} />}
            {team.base ? <StatBox label="Base" value={team.base} /> : null}
            <StatBox label="Cars" value={String(team.entries)} />
          </View>

          {team.bio ? (
            <View style={styles.card}>
              <Text style={styles.bioText}>{team.bio}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>DRIVERS</Text>
          <View style={styles.driversGrid}>
            {team.drivers.map(d => {
              const fav = isFavourite(d.name);
              const bundled = getDriverImage(d.number);
              const blackNumber = [2,16,17,88,99].includes(d.number);
              return (
                <TouchableOpacity
                  key={d.number}
                  style={[styles.driverCard, fav && styles.driverCardFav]}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('DriverDetail', {driver: d})}
                  accessibilityLabel={d.name}
                  accessibilityRole="button">
                  <ImageBackground
                    source={team.cardBgUrl ? {uri: team.cardBgUrl} : undefined}
                    style={styles.driverImageArea}
                    resizeMode="stretch">
                    <Text style={[styles.driverNumberBg, blackNumber && {color: '#000'}]}>{d.number}</Text>
                    {bundled ? (
                      <Image source={bundled} style={styles.driverPhoto} resizeMode="contain" />
                    ) : d.imageUrl ? (
                      <Image source={{uri: d.imageUrl.replace(/(\.[a-z]+)$/i, '-300x300$1')}} style={styles.driverPhoto} resizeMode="contain" />
                    ) : null}
                    {fav && <View style={styles.favBadge}><Icon name="star" size={12} color={Colors.yellow} /></View>}
                  </ImageBackground>
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

function StatBox({label, value}) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  carImageBg: {width: '100%', aspectRatio: 2},
  carImage: {width: '100%', flex: 1, transform: [{scale: 1.15}]},
  content: {padding: 16},
  teamName: {color: '#fff', fontSize: 24, fontWeight: '900'},
  teamCar: {color: Colors.textSecondary, fontSize: 14, marginTop: 4},
  statsRow: {flexDirection: 'row', marginTop: 16, gap: 8},
  statBox: {flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.outline},
  statValue: {color: Colors.yellow, fontSize: 13, fontWeight: '900', textAlign: 'center'},
  statLabel: {color: Colors.textSecondary, fontSize: 10, marginTop: 2, textAlign: 'center'},
  card: {backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginTop: 12},
  bioText: {color: Colors.textSecondary, fontSize: 14, lineHeight: 22},
  sectionTitle: {color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 24, marginBottom: 12},
  driversGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  driverCard: {width: (SCREEN_WIDTH - 32 - 10) / 2, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.card},
  driverCardFav: {borderWidth: 1, borderColor: 'rgba(254,189,2,0.5)'},
  driverImageArea: {width: '100%', aspectRatio: 1, justifyContent: 'flex-end', alignItems: 'center'},
  driverPhoto: {width: '100%', height: '85%'},
  driverNumberBg: {position: 'absolute', top: -10, right: 5, fontSize: 90, fontWeight: '900', color: '#fff', lineHeight: 100},
  favBadge: {position: 'absolute', top: 8, right: 8},
  driverFooter: {padding: 10},
  driverName: {color: '#fff', fontSize: 13, fontWeight: '800'},
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
