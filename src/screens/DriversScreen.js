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
  Animated,
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
import {CHAT_FAB_CLEARANCE} from '../utils/chatFabLayout';

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

// Each numberImages/*.png/webp is its own hand-designed graphic with its own
// aspect ratio - a single-digit number's file is far narrower than a
// 3-digit one's. Squeezing all of them into one fixed width+height box let
// `contain` fit each differently: a file narrower than the box (most
// single/double-digit numbers) filled the box's full height and touched the
// tile's top edge; a file wider than the box (most 2-3 digit numbers) got
// letterboxed vertically instead, leaving a gap above it - "some numbers
// touching top, some not" (2026-08-22, reported live, confirmed by checking
// every file's actual aspect ratio rather than guessing). Sizing off the
// loaded image's own measured aspect ratio instead - fixed height, width
// computed to match - means every number fills the same height and sits
// flush at the same top-right corner no matter how wide or narrow its own
// graphic is. Local state is safe here since drivers.map() below keys each
// card by driver number rather than recycling instances across items.
function NumberBadge({uri}) {
  const [ratio, setRatio] = useState(1.5); // reasonable placeholder until onLoad measures the real one
  return (
    <CachedImage
      uri={uri}
      resizeMode="contain"
      onLoad={e => {
        const {width, height} = e.nativeEvent?.source || {};
        if (width && height) setRatio(width / height);
      }}
      style={[styles.driverNumberImg, {aspectRatio: ratio}]}
    />
  );
}

// Press feedback is a dark scrim painted OVER the whole card, not a whole-tile
// opacity fade. TouchableOpacity's own fade drops the entire subtree's alpha
// via per-layer paint compositing on Android (no offscreen buffer by
// default), which briefly lets the opaque number graphic underneath show
// through the driver photo above it - reported live as "the number can
// quickly be seen through his face" (2026-08-24). A scrim that only ever gets
// MORE opaque on top of an unchanged, still-fully-opaque photo+number stack
// can't produce that artifact - nothing beneath it ever has its own alpha
// touched. activeOpacity={1} disables TouchableOpacity's built-in fade
// entirely; onPressIn/onPressOut drive the scrim instead.
function DriverCardInner({item, onPress, fav}) {
  const bundled = getDriverImage(item.number);
  const pressAnim = useRef(new Animated.Value(0)).current;
  const handlePressIn = () => Animated.timing(pressAnim, {toValue: 1, duration: 100, useNativeDriver: true}).start();
  const handlePressOut = () => Animated.timing(pressAnim, {toValue: 0, duration: 100, useNativeDriver: true}).start();
  return (
    <TouchableOpacity
      style={[styles.driverCard, fav && styles.driverCardFav]}
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
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
          <NumberBadge uri={item.numberImageUrl} />
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
      </View>
      <View style={styles.driverFooter}>
        <Text style={[styles.driverName, fav && {color: Colors.yellow}]} numberOfLines={1}>{formatDriverName(item.name)}</Text>
      </View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pressScrim, {opacity: pressAnim}]} />
    </TouchableOpacity>
  );
}

// Only re-render when item data or fav status changes - onPress is intentionally excluded
// from the comparison because it's recreated on every parent render.
const DriverCard = React.memo(DriverCardInner, (prev, next) => prev.item === next.item && prev.fav === next.fav);

// Isolated so DriversScreen doesn't subscribe to favouriteDriver context.
// When a fav toggles, only this component re-renders — PagerView receives no
// new children and no native view recreations happen on Android.
function DriverGridSection({title, drivers, isFavourite, navigation, hideWhenEmpty = false}) {
  if (hideWhenEmpty && !drivers.length) return null;
  return (
    <>
      <Text style={styles.countLabel}>{title}</Text>
      <View style={styles.driversGrid}>
        {drivers.map(item => (
          <View key={String(item.number)} style={styles.driverGridItem}>
            <DriverCard
              item={item}
              fav={isFavourite(item.name)}
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
    <ScrollView ref={listRef} contentContainerStyle={{padding: 16, paddingBottom: 20 + CHAT_FAB_CLEARANCE}}>
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
            contentContainerStyle={{padding: 16, paddingBottom: 20 + CHAT_FAB_CLEARANCE, gap: 10}}>
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
  // Back to centered (by request) - the car badge that once justified
  // left-aligning the photo (to keep the bottom-right corner clear for it)
  // is gone from this tile entirely now, so there's nothing left it needs
  // to stay clear of. Matches DriverDetailScreen's header, reverted the
  // same way for the same reason.
  driverImageArea: {width: '100%', aspectRatio: 1, justifyContent: 'flex-end', alignItems: 'center'},
  // 100% -> 90% (by request, "slightly smaller") - still centered via
  // driverImageArea's alignItems above, just with a bit of breathing room
  // on both axes instead of touching every edge of the tile.
  driverPhoto: {width: '90%', height: '90%'},
  // Shrunk further and given top/right padding (by request, "smaller
  // numbers, padding top and right") - fontSize 60 -> 46, lineHeight
  // 68 -> 52 proportionally, top/right 0/5 -> 14/14. Kept in lockstep with
  // driverNumberImg's top/right below - these two are the plain-text and
  // branded-graphic renderings of the exact same thing, and diverging their
  // positioning is exactly what caused the "some numbers touching top,
  // some not" bug fixed earlier the same day.
  driverNumberBg: {
    position: 'absolute',
    top: 14,
    right: 14,
    fontSize: 46,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 52,
  },
  // Branded number-graphic replacement for driverNumberBg above - same
  // top/right padding as it (by request, see that comment), height a % of
  // the square driverImageArea so it scales consistently at any tile size
  // (shrunk further, 36% -> 28%, by the same request). No width here - see
  // NumberBadge above for why (2026-08-22): width is set per-instance via
  // aspectRatio, computed from the loaded image's own real proportions,
  // since a fixed width let `contain` letterbox each number's file
  // differently depending on how its own aspect ratio compared to the box's.
  driverNumberImg: {position: 'absolute', top: 14, right: 14, height: '28%'},
  favBadge: {position: 'absolute', top: 8, right: 8},
  driverFooter: {padding: 10},
  driverName: {color: '#fff', fontSize: 13, fontWeight: '800'},
  // Press feedback overlay - see the comment on DriverCardInner for why this
  // replaced a whole-card opacity fade. Painted as the card's last child so
  // it sits above everything else; driverCard's own overflow:'hidden' clips
  // it to the card's rounded corners.
  pressScrim: {backgroundColor: 'rgba(0,0,0,0.25)'},
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
