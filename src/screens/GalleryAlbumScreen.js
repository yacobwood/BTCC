import React, {useState, useEffect, useCallback, useRef} from 'react';
import {View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet, Dimensions} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {fetchGalleryAlbum} from '../api/client';
import {parseGalleryAlbum} from '../api/parsers';
import {Analytics} from '../utils/analytics';
import {shareContent} from '../utils/appShare';
import CachedImage from '../components/CachedImage';
import PhotoLightbox from '../components/PhotoLightbox';
import {CHAT_FAB_CLEARANCE} from '../utils/chatFabLayout';
import {formatPhotoCount} from '../utils/galleryPhotoCount';

const NUM_COLUMNS = 3;
const GRID_PADDING = 12;
const GRID_GAP = 4;
// Every tile is a fixed-size square (aspectRatio: 1, flex: 1/NUM_COLUMNS), so
// its on-screen height is fully computable up front from the screen width
// alone - no need to wait for a real photo to load and measure itself.
const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const ROW_HEIGHT = TILE_SIZE + GRID_GAP; // includes the tile's own marginBottom

// Root-caused live 2026-08-28: without this, FlatList has no way to know the
// grid's true total height up front for an album this large (Donington
// Park has 170 photos, ~57 rows) - it has to progressively measure rows as
// each render batch (maxToRenderPerBatch=12) mounts while scrolling. That
// makes ListFooterComponent's position unstable: the "Photos: btcc.net"
// credit appears to settle at the end, then more photos get inserted below
// it as the next batch renders, pushing it down again - reported live as
// "3 loading stages" with no indication more was still coming. Providing
// getItemLayout tells FlatList every row's exact position from the very
// first frame, so there's nothing left to progressively discover - the
// footer lands in its final, correct position immediately, regardless of
// how many photos the album has.
//
// `index` here is ALREADY a row index, not a flat photo index - confirmed
// directly against the installed react-native source
// (Libraries/Lists/FlatList.js's _getItemCount: `numColumns > 1 ?
// Math.ceil(data.length / numColumns) : data.length`), not assumed. When
// numColumns > 1, FlatList tells VirtualizedList there are only
// ceil(photoCount / NUM_COLUMNS) "items" (rows) in total, and getItemLayout
// is called with that same row-level index - FlatList passes it straight
// through to VirtualizedList unmodified (see FlatList.render(): getItemLayout
// is never destructured out of restProps before spreading onto
// <VirtualizedList>). An earlier version of this function divided by
// NUM_COLUMNS a SECOND time here, silently shrinking every row's computed
// offset - harmless for the first couple of rows, increasingly wrong the
// further down a long list you go. Root-caused live 2026-08-28: this is
// exactly what caused visible content to "jump" scrolling to the bottom of
// a 170-photo album - FlatList's scroll-position math (based on the
// too-small offsets this function was returning) had to reconcile against
// the real rendered layout once enough of it had actually been measured.
export function getItemLayout(data, index) {
  return {length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index};
}

export default function GalleryAlbumScreen({route, navigation}) {
  const {season, albumSlug, photoIndex: deepLinkedPhotoIndex} = route.params;
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  // Guards the deep-link auto-open below to firing at most once - without
  // it, a pull-to-refresh (which re-sets `album`) would re-open the lightbox
  // every time, overriding whatever the user had since navigated to.
  const consumedDeepLinkRef = useRef(false);

  const load = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) setLoading(true);
    setError(false);
    try {
      const raw = await fetchGalleryAlbum(season, albumSlug, forceRefresh);
      const parsed = parseGalleryAlbum(raw);
      if (parsed) {
        setAlbum(parsed);
      } else {
        setError(true);
        Analytics.galleryAlbumLoadFailed(season, albumSlug, 'not_found');
      }
    } catch (e) {
      setError(true);
      Analytics.galleryAlbumLoadFailed(season, albumSlug, e?.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, [season, albumSlug]);

  useEffect(() => {
    Analytics.screen('gallery_album');
    Analytics.galleryAlbumViewed(season, albumSlug);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(() => {
    Analytics.pullToRefresh('gallery_album');
    setRefreshing(true);
    load(true);
  }, [load]);

  const openPhoto = useCallback((index) => {
    setLightboxIndex(index);
    Analytics.galleryPhotoView(season, albumSlug, index);
  }, [season, albumSlug]);

  // Deep link from a shared photo (see linking.config in AppNavigator.js:
  // gallery/:season/:albumSlug/:photoIndex?) - once the album's real photo
  // count is known, land the recipient straight on that photo instead of
  // the grid they'd otherwise have to search through. photoIndex arrives as
  // a string (URL segments always are); an out-of-range or malformed value
  // is silently ignored rather than guessed at, same "fail loud/do nothing
  // over guessing wrong" convention as the gallery scraper's own matching.
  useEffect(() => {
    if (consumedDeepLinkRef.current || deepLinkedPhotoIndex == null || !album?.photos?.length) return;
    consumedDeepLinkRef.current = true;
    const idx = parseInt(deepLinkedPhotoIndex, 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < album.photos.length) {
      openPhoto(idx);
    }
  }, [album, deepLinkedPhotoIndex, openPhoto]);

  const handleSharePhoto = useCallback((index) => {
    if (!album) return;
    shareContent(
      'gallery_photo',
      `${albumSlug}:${index}`,
      `${album.title} - BTCC Hub\n\nhttps://btcchub.vercel.app/gallery/${season}/${albumSlug}/${index}?src=gallery_photo`,
    );
  }, [album, season, albumSlug]);

  const closeLightbox = useCallback(() => {
    Analytics.galleryLightboxClosed(season, albumSlug, lightboxIndex ?? 0);
    setLightboxIndex(null);
  }, [season, albumSlug, lightboxIndex]);

  const onLightboxIndexChange = useCallback((index) => {
    setLightboxIndex(index);
    Analytics.galleryPhotoView(season, albumSlug, index);
  }, [season, albumSlug]);

  const renderPhoto = useCallback(({item, index}) => (
    <TouchableOpacity
      style={styles.thumb}
      activeOpacity={0.8}
      onPress={() => openPhoto(index)}
      accessibilityRole="button"
      accessibilityLabel={`Photo ${index + 1} of ${album?.photos.length}`}>
      <CachedImage uri={item.thumbUrl} style={styles.thumbImage} resizeMode="cover" />
    </TouchableOpacity>
  ), [openPhoto, album]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{flex: 1, marginLeft: 12}}>
          <Text style={styles.headerTitle} numberOfLines={1}>{album?.title || albumSlug}</Text>
          {!!album && (
            <Text style={styles.headerSub}>{formatPhotoCount(album)}</Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.yellow} size="large" />
        </View>
      ) : error && !album ? (
        <View style={styles.center}>
          <Icon name="broken-image" size={48} color={Colors.outline} />
          <Text style={styles.emptyText}>Couldn't load this album</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { Analytics.retryClicked('gallery_album'); load(); }}
            accessibilityRole="button"
            accessibilityLabel="Retry">
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={album?.photos || []}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item, i) => `${item.thumbUrl}-${i}`}
          renderItem={renderPhoto}
          getItemLayout={getItemLayout}
          contentContainerStyle={{padding: GRID_PADDING, paddingBottom: 20 + CHAT_FAB_CLEARANCE}}
          columnWrapperStyle={{gap: GRID_GAP}}
          // Same reasoning as GalleryTab.js/NewsScreen.js's own FlatList - this
          // is the screen where "many photos" actually shows up in one place,
          // so this tuning matters most here of anywhere in the feature.
          removeClippedSubviews={false}
          windowSize={10}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.yellow} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No photos in this album yet</Text>}
          ListFooterComponent={<Text style={styles.credit}>Photos: btcc.net</Text>}
        />
      )}

      <PhotoLightbox
        visible={lightboxIndex !== null}
        photos={album?.photos || []}
        initialIndex={lightboxIndex ?? 0}
        onClose={closeLightbox}
        onIndexChange={onLightboxIndexChange}
        onShare={handleSharePhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900'},
  headerSub: {color: Colors.textSecondary, fontSize: 12, marginTop: 2},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 16},
  retryButton: {marginTop: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.outline, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10},
  retryText: {color: Colors.yellow, fontSize: 13, fontWeight: '700'},
  // Explicit width/height (not flex+aspectRatio) so this can never compute a
  // size that drifts from TILE_SIZE/ROW_HEIGHT above, which getItemLayout
  // relies on being exactly correct - a mismatch there would misalign or
  // overlap rows rather than just fail to help.
  thumb: {width: TILE_SIZE, height: TILE_SIZE, marginBottom: GRID_GAP, borderRadius: 6, overflow: 'hidden', backgroundColor: Colors.card},
  thumbImage: {...StyleSheet.absoluteFillObject},
  credit: {color: Colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 12},
});
