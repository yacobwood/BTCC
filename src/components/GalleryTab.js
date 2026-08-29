import React, {useState, useCallback, useEffect} from 'react';
import {View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {fetchGallery} from '../api/client';
import {parseGalleryIndex} from '../api/parsers';
import {Analytics} from '../utils/analytics';
import CachedImage from './CachedImage';
import {CHAT_FAB_CLEARANCE} from '../utils/chatFabLayout';
import {formatPhotoCount} from '../utils/galleryPhotoCount';

// Groups the flat album list into two sections rather than one undifferentiated
// grid: "Race Weekends" (the one canonical album per round - see isCanonical's
// own comment in api/parsers.js - ordered by round, same ordering the Results
// tab itself uses) and "Other" (a season-launch shoot, TOCA Awards, a test
// day, or a non-canonical extra album for a round that already has its own
// Race Weekends tile - e.g. a "Captured Moments" set - in whatever order the
// scraper's own listing-page order gave them, since there's no reliable date
// field to re-sort by). Built as one FlatList over a manually-constructed
// {type, ...} items array (header rows + 2-wide album rows) rather than
// SectionList, matching NewsScreen.js/TrackDetailScreen.js's existing "mixed
// full-width + grid-cell rows in one list" pattern for the same reason they
// use it: SectionList handles a per-section numColumns awkwardly.
//
// Root-caused live 2026-08-28: a round can have more than one published
// album (e.g. round 2's main "2026 - Brands Hatch Indy" album plus a
// separately-published "The Captured Moments: Brands Hatch Indy" one) -
// grouping purely on "has a round" showed both as their own Race Weekends
// tile with a duplicate R2 chip, which read as cluttered/wrong rather than
// "there are two galleries for this weekend." isCanonical (computed once,
// server-side, in scrape_gallery.py's assign_canonical_albums() - not
// re-derived here) picks exactly one; every other album for that round
// renders in Other instead, same as any album with no resolved round at all.
function buildItems(albums) {
  const raceWeekends = albums.filter(a => a.round != null && a.isCanonical).sort((a, b) => a.round - b.round);
  const other = albums.filter(a => a.round == null || !a.isCanonical);
  const items = [];
  const pushRows = (list, keyPrefix) => {
    for (let i = 0; i < list.length; i += 2) {
      items.push({type: 'albumRow', key: `${keyPrefix}-${i}`, albums: list.slice(i, i + 2)});
    }
  };
  if (raceWeekends.length) {
    items.push({type: 'sectionHeader', key: 'header-race', title: 'RACE WEEKENDS'});
    pushRows(raceWeekends, 'race-row');
  }
  if (other.length) {
    items.push({type: 'sectionHeader', key: 'header-other', title: 'OTHER'});
    pushRows(other, 'other-row');
  }
  return items;
}

function AlbumTile({album, onPress}) {
  return (
    <TouchableOpacity
      style={styles.tile}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${album.title}, ${formatPhotoCount(album)}`}>
      <CachedImage uri={album.cover} style={styles.tileImage} resizeMode="cover" />
      <View style={styles.tileOverlay}>
        {/* Gated on isCanonical too, not just round != null - a non-canonical
            album (e.g. a "Captured Moments" set) still has its own round
            resolved in its data, but renders in the Other section, which
            shouldn't show a round chip at all (that's the one thing that
            visually distinguishes a Race Weekends tile from an Other one). */}
        {album.round != null && album.isCanonical && (
          <View style={styles.roundChip}>
            <Text style={styles.roundChipText}>R{album.round}</Text>
          </View>
        )}
        <Text style={styles.tileTitle} numberOfLines={1}>{album.title}</Text>
        <Text style={styles.tileCount}>{formatPhotoCount(album)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function GalleryTab({year, navigation}) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) setLoading(true);
    setError(false);
    try {
      const raw = await fetchGallery(year, forceRefresh);
      const parsed = parseGalleryIndex(raw);
      setAlbums(parsed.albums);
    } catch (e) {
      setError(true);
      Analytics.galleryIndexLoadFailed(year, e?.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    Analytics.pullToRefresh('gallery');
    setRefreshing(true);
    load(true);
  }, [load]);

  const openAlbum = useCallback((album) => {
    Analytics.galleryAlbumOpen(year, album.slug);
    navigation.navigate('GalleryAlbum', {season: year, albumSlug: album.slug});
  }, [navigation, year]);

  const renderItem = useCallback(({item}) => {
    if (item.type === 'sectionHeader') {
      return <Text style={styles.sectionHeader}>{item.title}</Text>;
    }
    return (
      <View style={styles.row}>
        {item.albums.map(album => (
          <AlbumTile key={album.slug} album={album} onPress={() => openAlbum(album)} />
        ))}
        {/* Layout spacer only, for an odd-count row's lone tile - reuses
            styles.tile's flex/aspectRatio so the grid stays aligned, but
            NOT its backgroundColor/borderRadius, which made this render as
            a visible dark box that looked like a real, blank album tile
            rather than empty space. */}
        {item.albums.length === 1 && <View style={styles.tileSpacer} />}
      </View>
    );
  }, [openAlbum]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.yellow} size="large" />
      </View>
    );
  }

  if (error && !albums.length) {
    return (
      <View style={styles.center}>
        <Icon name="broken-image" size={48} color={Colors.outline} />
        <Text style={styles.emptyText}>Couldn't load the gallery</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => { Analytics.retryClicked('gallery'); load(); }}
          accessibilityRole="button"
          accessibilityLabel="Retry">
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={buildItems(albums)}
      keyExtractor={item => item.key}
      renderItem={renderItem}
      contentContainerStyle={{padding: 16, paddingBottom: 20 + CHAT_FAB_CLEARANCE}}
      // Same tuning as NewsScreen.js's own image-heavy FlatList -
      // removeClippedSubviews={false} because CachedImage has no in-memory
      // cache of its own, so Android's default clipped-view detach would
      // flash a cover thumbnail blank on re-scroll even though its bytes are
      // already on disk.
      removeClippedSubviews={false}
      windowSize={10}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.yellow} />}
      ListEmptyComponent={<Text style={styles.emptyText}>No gallery albums for {year} yet</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 16},
  retryButton: {marginTop: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.outline, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10},
  retryText: {color: Colors.yellow, fontSize: 13, fontWeight: '700'},
  sectionHeader: {color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 12, marginBottom: 8},
  row: {flexDirection: 'row', gap: 12, marginBottom: 12},
  tile: {flex: 1, aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.card},
  tileSpacer: {flex: 1, aspectRatio: 1},
  tileImage: {...StyleSheet.absoluteFillObject},
  tileOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 8, backgroundColor: 'rgba(8,9,18,0.75)',
  },
  roundChip: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(254,189,2,0.85)',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, marginBottom: 4,
  },
  roundChipText: {color: Colors.navy, fontSize: 10, fontWeight: '900'},
  tileTitle: {color: '#fff', fontSize: 12, fontWeight: '800'},
  tileCount: {color: Colors.textSecondary, fontSize: 10, marginTop: 2},
});
