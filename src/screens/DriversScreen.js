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
import {formatDriverName} from '../utils/driverName';
import SwipeableTabs from '../components/SwipeableTabs';
import CachedImage from '../components/CachedImage';

function thumbUrl(url, size = '150x150') {
  if (!url || !url.includes('btcc.net/wp-content/uploads/')) return url;
  return url.replace(/(\.[a-z]+)$/i, `-${size}$1`);
}

function DriverAvatar({number, imageUrl, size = 58}) {
  const bundled = getDriverImage(number);
  const imgStyle = {width: size, height: size * 1.6, borderRadius: 0, position: 'absolute', top: 0, left: 0, right: 0};
  const wrapStyle = {width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: Colors.surface};
  if (bundled) {
    return <View style={wrapStyle}><Image source={bundled} style={imgStyle} resizeMode="cover" fadeDuration={0} /></View>;
  }
  if (imageUrl) {
    return <View style={wrapStyle}><Image source={{uri: thumbUrl(imageUrl)}} style={imgStyle} resizeMode="cover" fadeDuration={0} /></View>;
  }
  return (
    <View style={[wrapStyle, {justifyContent: 'center', alignItems: 'center'}]}>
      <Icon name="person" size={size * 0.48} color={Colors.textSecondary} />
    </View>
  );
}

const TABS = ['DRIVERS', 'TEAMS'];

// The grid below is a plain ScrollView + .map(), not a virtualized list - every
// tile mounts (and fires its network images) at once regardless of scroll
// position, so "list position" is really "request-queue position" once there
// are more concurrent image requests than the device's HTTP client will open
// connections for at once. Adding the car badge (below) made that burst ~50%
// bigger (2 network images/tile -> 3), which showed up live as cars towards
// the bottom of the list losing the race for a connection slot and exhausting
// CachedImage's retry budget before it ever cleared.
//
// A first pass at staggering (60ms/position, 1.2s cap) wasn't enough margin -
// confirmed live: driver photos and card backgrounds (declared earlier in each
// tile's JSX, so first in the request queue every time) kept loading fine even
// deep in the list, but the car badge specifically kept showing CachedImage's
// permanent fallback icon past roughly the 18th tile. Car badges are always
// queued behind the *entire* photo/background burst (~46 requests, declared
// before any badge in every tile), not just behind badges ahead of them - so
// the tail needs enough delay to actually clear that whole front-of-queue
// backlog, not just a modest offset from its neighbours. Widened to give that
// real headroom instead of guessing again from a still-too-small number.
const CAR_BADGE_STAGGER_MS = 150;
const CAR_BADGE_MAX_DELAY_MS = 3000;

function DriverCardInner({item, onPress, fav, index = 0}) {
  const bundled = getDriverImage(item.number);
  // No point scheduling a delay (or even a timer at all - a driver with no
  // car image on record, e.g. a reserve, never renders the badge either way)
  // unless there's actually a badge coming.
  const hasCarBadge = Boolean(item.carImageUrl);
  const [carBadgeReady, setCarBadgeReady] = useState(!hasCarBadge || index === 0);
  useEffect(() => {
    if (!hasCarBadge || carBadgeReady) return;
    const delay = Math.min(index * CAR_BADGE_STAGGER_MS, CAR_BADGE_MAX_DELAY_MS);
    const t = setTimeout(() => setCarBadgeReady(true), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <TouchableOpacity
      style={[styles.driverCard, fav && styles.driverCardFav]}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityLabel={`${item.name}, ${item.team}, number ${item.number}`}
      accessibilityRole="button">
      <View style={styles.driverImageArea}>
        {item.cardBgUrl ? (
          <CachedImage
            uri={item.cardBgUrl}
            style={StyleSheet.absoluteFill}
            resizeMode="stretch"
            fallback={<View style={[StyleSheet.absoluteFill, {backgroundColor: Colors.surface}]} />}
            collapsable={false}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, {backgroundColor: Colors.surface}]} />
        )}
        {item.numberImageUrl ? (
          <CachedImage uri={item.numberImageUrl} style={styles.driverNumberImg} resizeMode="contain" />
        ) : (
          <Text style={[styles.driverNumberBg, item.lightCardBg && {color: '#000'}]}>{item.number}</Text>
        )}
        {bundled ? (
          <Image source={bundled} style={styles.driverPhoto} resizeMode="contain" fadeDuration={150} />
        ) : item.imageUrl ? (
          <CachedImage uri={item.imageUrl} targetWidth={300} style={styles.driverPhoto} resizeMode="contain" />
        ) : null}
        {fav && (
          <View style={styles.favBadge}>
            <Icon name="star" size={12} color={Colors.yellow} />
          </View>
        )}
        {/* Now that a team's cars can carry different sponsor liveries (e.g.
            Steel Seal with Power Maxed Racing fields both Dexter Patterson's
            car and Nick Halstead's separately-liveried "Ask GVT" one), the
            driver's OWN car - not a shared team image - has to live on their
            tile. Bottom-left keeps it clear of the top-right number/logo
            badge and the top-right favBadge above. */}
        {item.carImageUrl && carBadgeReady ? (
          <CachedImage uri={item.carImageUrl} style={styles.driverCarImg} resizeMode="contain" accessibilityLabel={`${item.name}'s car`} />
        ) : null}
      </View>
      <View style={styles.driverFooter}>
        <Text style={[styles.driverName, fav && {color: Colors.yellow}]} numberOfLines={1}>{formatDriverName(item.name)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Only re-render when item data, fav status or list position changes - onPress
// is intentionally excluded from the comparison because it's recreated on
// every parent render.
const DriverCard = React.memo(DriverCardInner, (prev, next) =>
  prev.item === next.item && prev.fav === next.fav && prev.index === next.index);

// Isolated so DriversScreen doesn't subscribe to favouriteDriver context.
// When a fav toggles, only this component re-renders — PagerView receives no
// new children and no native view recreations happen on Android.
function DriverGridSection({title, drivers, isFavourite, navigation, hideWhenEmpty = false}) {
  if (hideWhenEmpty && !drivers.length) return null;
  return (
    <>
      <Text style={styles.countLabel}>{title}</Text>
      <View style={styles.driversGrid}>
        {drivers.map((item, index) => (
          <View key={String(item.number)} style={styles.driverGridItem}>
            <DriverCard
              item={item}
              fav={isFavourite(item.name)}
              index={index}
              onPress={() => { Analytics.driverClicked(item.name); navigation.navigate('DriverDetail', {driver: item}); }}
            />
          </View>
        ))}
      </View>
    </>
  );
}

const DriversGrid = React.memo(function DriversGrid({drivers, listRef, navigation}) {
  const {isFavourite} = useFavouriteDriver();
  // currentlyRacing !== false (not simply "=== true"): absent/undefined must
  // default to "currently racing" so data that hasn't been through parseGrid()
  // isn't silently miscategorized as a past driver. reserveOnly drivers are
  // excluded from both lists below - a one-off stand-in (e.g. Senna Proctor
  // covering a single round) never held a grid seat, so unlike a departed
  // full-season driver they get no tile at all, in either section.
  const activeDrivers = drivers.filter(d => d.currentlyRacing !== false && !d.reserveOnly);
  // Kept visible rather than removed outright when a driver leaves their seat
  // mid-season (e.g. moves to a reserve/development role) - still raced this
  // year, just not part of the active grid right now.
  const pastDrivers = drivers.filter(d => d.currentlyRacing === false && !d.reserveOnly);
  return (
    <ScrollView ref={listRef} contentContainerStyle={{padding: 16, paddingBottom: 20}}>
      <DriverGridSection
        title={`${activeDrivers.length} CONFIRMED`}
        drivers={activeDrivers}
        isFavourite={isFavourite}
        navigation={navigation}
      />
      {pastDrivers.length > 0 && (
        <View style={{marginTop: 24}}>
          <DriverGridSection
            title="NOT CURRENTLY RACING · RACED IN 2026"
            drivers={pastDrivers}
            isFavourite={isFavourite}
            navigation={navigation}
          />
        </View>
      )}
    </ScrollView>
  );
});

export default function DriversScreen({navigation}) {
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);
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
          <CachedImage uri={item.cardBgThumbUrl || item.cardBgUrl} style={StyleSheet.absoluteFill} resizeMode="stretch" collapsable={false} />
        ) : (
          <View style={[StyleSheet.absoluteFill, {backgroundColor: Colors.surface}]} />
        )}
        {/* A shared team tile can no longer show one car as "the" team car -
            some teams field a different livery per driver (see driverCarImg
            above), so a single cutout here would just be misleading about
            which car it is. The logo is the one thing every entry shares,
            so it takes over the whole tile instead of a small top-right badge. */}
        {item.logoUrl ? (
          <CachedImage uri={item.logoUrl} style={styles.teamLogoImgLarge} resizeMode="contain" />
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
          <DriversGrid drivers={drivers} listRef={driversListRef} navigation={navigation} />,
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
  driverCard: {borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.card, borderWidth: 1, borderColor: 'transparent'},
  driverCardFav: {borderColor: 'rgba(254,189,2,0.5)'},
  driverImageArea: {width: '100%', aspectRatio: 1, justifyContent: 'flex-end', alignItems: 'center'},
  driverPhoto: {width: '100%', height: '85%'},
  driverNumberBg: {
    position: 'absolute',
    top: -10,
    right: 5,
    fontSize: 80,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 90,
  },
  // Branded number-graphic replacement for driverNumberBg above (used when
  // the driver has a numberImageUrl) - same top-right footprint, sized as a
  // % of the square driverImageArea so it scales consistently at any tile size.
  driverNumberImg: {position: 'absolute', top: 0, right: 0, width: '60%', height: '48%'},
  favBadge: {position: 'absolute', top: 8, right: 8},
  // Driver's own car cutout, badge-sized into the bottom-left corner - deliberately
  // small/secondary to the driver photo, and confined to a quadrant so it never
  // collides with the top-right number badge/favBadge above.
  driverCarImg: {position: 'absolute', bottom: 4, left: 4, width: '46%', height: '30%'},
  driverFooter: {padding: 10},
  driverName: {color: '#fff', fontSize: 13, fontWeight: '800'},
  teamCard: {width: (SCREEN_WIDTH - 32 - 10) / 2, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.card},
  // centered (not flex-end like driverImageArea) now that the logo, not a
  // bottom-anchored car cutout, is the tile's one big graphic.
  teamImageArea: {width: '100%', aspectRatio: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center'},
  // Large and centered - each team can field more than one livery now (see
  // driverCarImg above), so the tile no longer tries to show "the" team car;
  // the logo is the one thing every one of its cars/drivers shares.
  teamLogoImgLarge: {width: '70%', height: '70%'},
  teamFooter: {padding: 10},
  teamName: {color: '#fff', fontSize: 13, fontWeight: '800'},
  divider: {height: 1, backgroundColor: 'rgba(42,45,68,0.5)', marginVertical: 12},

  teamsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
});
