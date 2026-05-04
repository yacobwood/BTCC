import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ImageBackground,
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
import {formatDriverName} from '../utils/driverName';
import SwipeableTabs from '../components/SwipeableTabs';

function thumbUrl(url, size = '150x150') {
  if (!url || !url.includes('btcc.net/wp-content/uploads/')) return url;
  return url.replace(/(\.[a-z]+)$/i, `-${size}$1`);
}

function DriverAvatar({number, imageUrl, size = 58}) {
  const bundled = getDriverImage(number);
  const imgStyle = {width: size, height: size * 1.6, borderRadius: 0, position: 'absolute', top: 0, left: 0, right: 0};
  const wrapStyle = {width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: Colors.surface};
  if (bundled) {
    return <View style={wrapStyle}><Image source={bundled} style={imgStyle} resizeMode="cover" /></View>;
  }
  if (imageUrl) {
    return <View style={wrapStyle}><Image source={{uri: thumbUrl(imageUrl)}} style={imgStyle} resizeMode="cover" /></View>;
  }
  return (
    <View style={[wrapStyle, {justifyContent: 'center', alignItems: 'center'}]}>
      <Icon name="person" size={size * 0.48} color={Colors.textSecondary} />
    </View>
  );
}

const TABS = ['DRIVERS', 'TEAMS'];

export default function DriversScreen({navigation}) {
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const {isFavourite} = useFavouriteDriver();

  const driversListRef = useRef(null);
  const teamsListRef = useRef(null);

  useFocusEffect(useCallback(() => {
    const t = setTimeout(() => {
      driversListRef.current?.scrollTo({y: 0, animated: false});
      teamsListRef.current?.scrollTo({y: 0, animated: false});
    }, 50);
    return () => clearTimeout(t);
  }, []));

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
    const bundled = getDriverImage(item.number);
    return (
      <TouchableOpacity
        style={[styles.driverCard, fav && styles.driverCardFav]}
        activeOpacity={0.8}
        onPress={() => { Analytics.driverClicked(item.name); navigation.navigate('DriverDetail', {driver: item}); }}
        accessibilityLabel={`${item.name}, ${item.team}, number ${item.number}`}
        accessibilityRole="button">
        <ImageBackground
          source={item.cardBgUrl ? {uri: item.cardBgUrl} : undefined}
          style={styles.driverImageArea}
          resizeMode="stretch">
          <Text style={[styles.driverNumberBg, [2,16,17,88,99].includes(item.number) && {color: '#000'}]}>{item.number}</Text>
          {bundled ? (
            <Image source={bundled} style={styles.driverPhoto} resizeMode="contain" />
          ) : item.imageUrl ? (
            <Image source={{uri: thumbUrl(item.imageUrl, '300x300')}} style={styles.driverPhoto} resizeMode="contain" />
          ) : null}
          {fav && (
            <View style={styles.favBadge}>
              <Icon name="star" size={12} color={Colors.yellow} />
            </View>
          )}
        </ImageBackground>
        <View style={styles.driverFooter}>
          <Text style={[styles.driverName, fav && {color: Colors.yellow}]} numberOfLines={1}>{formatDriverName(item.name)}</Text>
        </View>
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
          <Image source={{uri: item.cardBgThumbUrl || item.cardBgUrl}} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, {backgroundColor: Colors.surface}]} />
        )}
        {item.carImageUrl ? (
          <Image source={{uri: item.carThumbUrl || item.carImageUrl}} style={styles.teamCarImage} resizeMode="contain" />
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
      <SwipeableTabs
        tabs={TABS}
        tabRowStyle={{backgroundColor: Colors.background}}
        onTabChange={(i) => Analytics.gridTabSwitched(TABS[i].toLowerCase())}
        pages={[
          <ScrollView
            ref={driversListRef}
            contentContainerStyle={{padding: 16, paddingBottom: 20}}>
            <Text style={styles.countLabel}>{drivers.length} CONFIRMED</Text>
            <View style={styles.driversGrid}>
              {drivers.map(item => (
                <View key={String(item.number)} style={styles.driverGridItem}>
                  {renderDriver({item})}
                </View>
              ))}
            </View>
          </ScrollView>,
          <ScrollView
            ref={teamsListRef}
            contentContainerStyle={{padding: 16, paddingBottom: 20, gap: 10}}>
            <Text style={styles.countLabel}>{teams.length} TEAMS</Text>
            <View style={styles.teamsGrid}>
              {teams.map(item => renderTeam({item}))}
            </View>
          </ScrollView>,
        ]}
      />
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
  driversGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  driverGridItem: {width: (SCREEN_WIDTH - 32 - 10) / 2},
  driverCard: {borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.card},
  driverCardFav: {borderWidth: 1, borderColor: 'rgba(254,189,2,0.5)'},
  driverImageArea: {width: '100%', aspectRatio: 1, justifyContent: 'flex-end', alignItems: 'center'},
  driverPhoto: {width: '100%', height: '85%'},
  driverNumberBg: {
    position: 'absolute',
    top: -10,
    right: 5,
    fontSize: 90,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 100,
  },
  favBadge: {position: 'absolute', top: 8, right: 8},
  driverFooter: {padding: 10},
  driverName: {color: '#fff', fontSize: 13, fontWeight: '800'},
  teamCard: {width: (SCREEN_WIDTH - 32 - 10) / 2, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.card},
  teamImageArea: {width: '100%', aspectRatio: 1, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center'},
  teamCarImage: {width: '100%', height: '85%'},
  teamFooter: {padding: 10},
  teamName: {color: '#fff', fontSize: 13, fontWeight: '800'},
  divider: {height: 1, backgroundColor: 'rgba(42,45,68,0.5)', marginVertical: 12},

  teamsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
});
