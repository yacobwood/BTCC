import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {fetchDrivers} from '../api/client';
import {parseGrid} from '../api/parsers';
import {getDriverImage} from '../assets/driverImages';
import {useFocusEffect} from '@react-navigation/native';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {Analytics} from '../utils/analytics';

function DriverAvatar({number, imageUrl, size = 58}) {
  const bundled = getDriverImage(number);
  const imgStyle = {width: size, height: size * 1.6, borderRadius: 0, position: 'absolute', top: 0, left: 0, right: 0};
  const wrapStyle = {width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: Colors.surface};
  if (bundled) {
    return <View style={wrapStyle}><Image source={bundled} style={imgStyle} resizeMode="cover" /></View>;
  }
  if (imageUrl) {
    return <View style={wrapStyle}><Image source={{uri: imageUrl}} style={imgStyle} resizeMode="cover" /></View>;
  }
  return (
    <View style={[wrapStyle, {justifyContent: 'center', alignItems: 'center'}]}>
      <Icon name="person" size={size * 0.48} color={Colors.textSecondary} />
    </View>
  );
}

const TABS = ['DRIVERS', 'TEAMS'];
const TAB_WIDTH = SCREEN_WIDTH / TABS.length;

export default function DriversScreen({navigation}) {
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const {isFavourite, toggle: toggleFav} = useFavouriteDriver();

  const driversListRef = useRef(null);
  const teamsListRef = useRef(null);

  useFocusEffect(useCallback(() => {
    const t = setTimeout(() => {
      driversListRef.current?.scrollTo({y: 0, animated: false});
      teamsListRef.current?.scrollTo({y: 0, animated: false});
    }, 50);
    return () => clearTimeout(t);
  }, []));

  const goToTab = (i) => {
    setTab(i);
    Analytics.gridTabSwitched(TABS[i].toLowerCase());
  };

  const load = useCallback(async () => {
    try {
      const raw = await fetchDrivers();
      setGrid(parseGrid(raw));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { Analytics.screen('drivers'); }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.yellow} size="large" />
      </View>
    );
  }

  const drivers = grid?.drivers || [];
  const teams = grid?.teams || [];

  const renderDriver = ({item}) => {
    const fav = isFavourite(item.name);
    return (
      <TouchableOpacity
        style={[styles.driverCard, fav && styles.driverCardFav]}
        activeOpacity={0.8}
        onPress={() => { Analytics.driverClicked(item.name); navigation.navigate('DriverDetail', {driver: item}); }}
        accessibilityLabel={`${item.name}, ${item.team}, number ${item.number}`}
        accessibilityRole="button">
        <View style={styles.avatarWrap}>
          <DriverAvatar number={item.number} imageUrl={item.imageUrl} size={58} />
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>{item.number}</Text>
          </View>
        </View>
        <View style={styles.driverInfo}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            {fav && <Icon name="star" size={13} color={Colors.yellow} />}
            <Text style={[styles.driverName, fav && {color: Colors.yellow}]}>{item.name}</Text>
          </View>
          {item.team ? <Text style={styles.driverTeam}>{item.team}</Text> : null}
          {item.car ? (
            <View style={styles.carBadge}>
              <Text style={styles.carText}>{item.car}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          style={{padding: 8}}
          onPress={() => { Analytics.favouriteToggled(item.name, !isFavourite(item.name)); if (!isFavourite(item.name)) Analytics.setFavouriteDriverProperty(item.name); toggleFav(item.name); }}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          accessibilityLabel={`${fav ? 'Remove' : 'Add'} ${item.name} as favourite`}
          accessibilityRole="button">
          <Icon
            name={fav ? 'star' : 'star-outline'}
            size={22}
            color={fav ? Colors.yellow : Colors.textSecondary}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderTeam = ({item}) => (
    <TouchableOpacity
      key={item.name}
      style={styles.teamCard}
      activeOpacity={0.8}
      onPress={() => { Analytics.teamClicked(item.name); navigation.navigate('TeamDetail', {team: item}); }}
      accessibilityLabel={item.name}
      accessibilityRole="button">
      <View style={styles.teamImageArea}>
        {item.cardBgUrl ? (
          <Image source={{uri: item.cardBgUrl}} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, {backgroundColor: Colors.surface}]} />
        )}
        {item.carImageUrl ? (
          <Image source={{uri: item.carImageUrl}} style={styles.teamCarImage} resizeMode="contain" />
        ) : null}
      </View>
      <View style={styles.teamFooter}>
        <Text style={styles.teamName}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>2026 GRID</Text>
      </View>
      <View style={styles.tabRow}>
        {TABS.map((label, i) => (
          <TouchableOpacity
            key={i}
            style={styles.tab}
            onPress={() => goToTab(i)}
            accessibilityRole="tab"
            accessibilityLabel={`${label} tab`}>
            <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: TAB_WIDTH,
          height: 2,
          backgroundColor: Colors.yellow,
          transform: [{translateX: TAB_WIDTH * tab}],
        }} />
      </View>
      <View style={{flex: 1}}>
        <ScrollView
          ref={driversListRef}
          style={[StyleSheet.absoluteFill, {zIndex: tab === 0 ? 1 : 0, backgroundColor: Colors.background}]}
          pointerEvents={tab === 0 ? 'auto' : 'none'}
          contentContainerStyle={{padding: 16, paddingBottom: 20}}>
          <Text style={styles.countLabel}>{drivers.length} CONFIRMED</Text>
          {drivers.map((item, i) => (
            <View key={String(item.number)}>
              {i > 0 && <View style={{height: 8}} />}
              {renderDriver({item})}
            </View>
          ))}
        </ScrollView>
        <ScrollView
          ref={teamsListRef}
          style={[StyleSheet.absoluteFill, {zIndex: tab === 1 ? 1 : 0, backgroundColor: Colors.background}]}
          pointerEvents={tab === 1 ? 'auto' : 'none'}
          contentContainerStyle={{padding: 16, paddingBottom: 20, gap: 10}}>
          <Text style={styles.countLabel}>{teams.length} TEAMS</Text>
          <View style={styles.teamsGrid}>
            {teams.map(item => renderTeam({item}))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  center: {flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center'},
  header: {paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: Colors.background},
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1},
  tabRow: {flexDirection: 'row', backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.outline},
  tab: {flex: 1, paddingVertical: 12, alignItems: 'center'},
  tabText: {color: Colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1},
  tabTextActive: {color: Colors.yellow},
  countLabel: {color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 8},
  driverCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  driverCardFav: {
    borderWidth: 1,
    borderColor: 'rgba(254,189,2,0.5)',
  },
  avatarWrap: {position: 'relative'},
  avatar: {width: 58, height: 58, borderRadius: 29},
  avatarPlaceholder: {backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center'},
  numberBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.navy,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  numberText: {color: '#fff', fontSize: 10, fontWeight: '900'},
  driverInfo: {flex: 1, marginLeft: 12},
  driverName: {color: '#fff', fontSize: 16, fontWeight: '700'},
  driverTeam: {color: Colors.textSecondary, fontSize: 13},
  carBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.outline,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  carText: {color: Colors.textSecondary, fontSize: 11, fontWeight: '600'},
  teamCard: {width: (SCREEN_WIDTH - 32 - 10) / 2, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.card},
  teamImageArea: {width: '100%', aspectRatio: 1, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center'},
  teamCarImage: {width: '100%', height: '85%'},
  teamFooter: {padding: 10},
  teamName: {color: '#fff', fontSize: 13, fontWeight: '800'},
  divider: {height: 1, backgroundColor: 'rgba(42,45,68,0.5)', marginVertical: 12},

  teamsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
});
