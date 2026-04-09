import React, {useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors} from '../theme/colors';
import {getDriverImage} from '../assets/driverImages';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {Analytics} from '../utils/analytics';

export default function TeamDetailScreen({route, navigation}) {
  const {team} = route.params;
  const insets = useSafeAreaInsets();
  const {isFavourite} = useFavouriteDriver();

  useEffect(() => { Analytics.screen('team_detail:' + team.name); }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{paddingBottom: 30}}>
        {team.carImageUrl ? (
          <Image source={{uri: team.carImageUrl}} style={[styles.carImage, {marginTop: insets.top + 50}]} resizeMode="contain" accessibilityLabel={`${team.name} car`} />
        ) : <View style={{height: insets.top + 50}} />}

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
          {team.drivers.map(d => {
            const fav = isFavourite(d.name);
            return (
              <TouchableOpacity
                key={d.number}
                style={[styles.driverRow, fav && styles.driverRowFav]}
                onPress={() => navigation.navigate('DriverDetail', {driver: d})}
                accessibilityLabel={d.name}
                accessibilityRole="button">
                <View style={styles.driverAvatar}>
                  {(() => {
                    const bundled = getDriverImage(d.number);
                    if (bundled) return <Image source={bundled} style={styles.driverAvatarImg} />;
                    if (d.imageUrl) return <Image source={{uri: d.imageUrl}} style={styles.driverAvatarImg} />;
                    return <Icon name="person" size={20} color={Colors.textSecondary} />;
                  })()}
                </View>
                <View style={{flex: 1}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                    {fav && <Icon name="star" size={12} color={Colors.yellow} />}
                    <Text style={[styles.driverName, fav && {color: Colors.yellow}]}>
                      #{d.number} {d.name}
                    </Text>
                  </View>
                  <Text style={styles.driverNat}>{d.nationality}</Text>
                </View>
                <Icon name="chevron-right" size={20} color={fav ? Colors.yellow : Colors.textSecondary} />
              </TouchableOpacity>
            );
          })}

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
  carImage: {width: '100%', height: 200},
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
  driverRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  driverRowFav: {
    borderWidth: 1,
    borderColor: 'rgba(254,189,2,0.5)',
  },
  driverAvatar: {width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden'},
  driverAvatarImg: {width: 40, height: 64, position: 'absolute', top: 0},
  driverName: {color: '#fff', fontSize: 14, fontWeight: '700'},
  driverNat: {color: Colors.textSecondary, fontSize: 12},
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
