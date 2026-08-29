import React, {useEffect, useRef, useState} from 'react';
import {Modal, View, Text, TouchableWithoutFeedback, TouchableOpacity, Animated, StyleSheet, Dimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PagerView from 'react-native-pager-view';
import CachedImage from './CachedImage';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

// Full-screen swipe-between-photos viewer. No pinch-zoom (deliberately
// deferred - see project plan) - swipe left/right, tap anywhere to dismiss.
//
// offscreenPageLimit is set small (1) rather than copying SwipeableTabs'
// offscreenPageLimit={pages.length - 1} ("keep every page mounted") - that's
// safe there because it renders a handful of tab pages, not photos. A
// gallery album can be arbitrarily large (see the "goes back to 2010,
// unbounded per-album photo count" decision), so mounting every photo at
// once here would recreate the exact Android decode-memory-pool problem
// this whole feature was designed around (see src/assets/driverImages.js's
// header comment) - only the current photo plus its immediate neighbour(s)
// should ever be mounted/decoded regardless of album size.
const OFFSCREEN_PAGE_LIMIT = 1;

// How long the "swipe to browse / tap to close" hint stays fully visible
// before fading out, and how long the fade itself takes.
const HINT_VISIBLE_MS = 2500;
const HINT_FADE_MS = 400;

export default function PhotoLightbox({visible, photos, initialIndex = 0, onClose, onIndexChange, onShare}) {
  const pagerRef = useRef(null);
  const insets = useSafeAreaInsets();

  // Tracked locally (seeded from initialIndex, kept in sync via
  // onPageSelected below) so the "N of total" counter can render without
  // relying on the parent screen threading its own lightboxIndex state back
  // in as a prop - keeps this component self-contained, same as it already
  // is for everything else it needs.
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const hintOpacity = useRef(new Animated.Value(0)).current;

  // PagerView has no controlled "page" prop - re-seek to initialIndex
  // whenever the lightbox is (re)opened, since the same instance can be
  // reused for a different tap (e.g. Modal stays mounted, only `visible`
  // and `initialIndex` change) without remounting.
  useEffect(() => {
    if (!visible) return;
    pagerRef.current?.setPageWithoutAnimation(initialIndex);
    setCurrentIndex(initialIndex);

    // Re-show and re-fade the gesture hint on every open rather than
    // tracking "has the user already seen this" persistently (e.g.
    // AsyncStorage) - the gestures genuinely have no other visual affordance
    // otherwise (tap-anywhere-to-dismiss, swipe-anywhere-to-browse), so a
    // short reminder each time is worth more than one-time-only tracking.
    hintOpacity.setValue(1);
    const timer = setTimeout(() => {
      Animated.timing(hintOpacity, {toValue: 0, duration: HINT_FADE_MS, useNativeDriver: true}).start();
    }, HINT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible, initialIndex, hintOpacity]);

  const handlePageSelected = (e) => {
    const position = e.nativeEvent.position;
    setCurrentIndex(position);
    onIndexChange?.(position);
  };

  if (!visible || !photos?.length) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={initialIndex}
          offscreenPageLimit={OFFSCREEN_PAGE_LIMIT}
          onPageSelected={handlePageSelected}>
          {photos.map((photo, i) => (
            <TouchableWithoutFeedback key={String(i)} onPress={onClose} accessibilityLabel="Dismiss photo" accessibilityRole="button">
              <View style={styles.page}>
                <CachedImage
                  uri={photo.viewUrl || photo.thumbUrl}
                  style={styles.image}
                  resizeMode="contain"
                />
              </View>
            </TouchableWithoutFeedback>
          ))}
        </PagerView>

        {/* Persistent top bar: a real close button (the tap-anywhere-on-photo
            dismiss gesture has no visual affordance of its own), the
            "N of total" position counter, and an optional share button -
            grouped together on the right rather than adding a third
            top-level split, since space-between only ever anchors two
            things to opposite ends. pointerEvents="box-none" so the
            transparent space around the controls still lets swipe/tap-to-
            dismiss reach the pager underneath. */}
        <View style={[styles.topBar, {paddingTop: insets.top + 8}]} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close gallery">
            <Icon name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.rightControls}>
            <View style={styles.counterPill}>
              <Text style={styles.counterText}>{currentIndex + 1} of {photos.length}</Text>
            </View>
            {/* onShare is optional - PhotoLightbox stays a generic, reusable
                pager (see header comment re: eventually powering
                PhotoCarousel too) and never builds its own share message/URL;
                it only ever hands the parent screen the current index. */}
            {!!onShare && (
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => onShare(currentIndex)}
                accessibilityRole="button"
                accessibilityLabel="Share photo">
                <Icon name="share" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Brief, auto-fading reminder of the two available gestures -
            swipe to move between photos, tap the photo to close. */}
        <Animated.View
          style={[styles.hintPill, {bottom: insets.bottom + 32, opacity: hintOpacity}]}
          pointerEvents="none">
          <Icon name="swipe" size={16} color="#fff" />
          <Text style={styles.hintText}>Swipe to browse · Tap photo to close</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  pager: {flex: 1},
  page: {width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center'},
  image: {width: SCREEN_WIDTH, height: SCREEN_HEIGHT},
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16,
  },
  closeButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
  },
  rightControls: {flexDirection: 'row', alignItems: 'center', gap: 8},
  counterPill: {
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  shareButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
  },
  counterText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  hintPill: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  hintText: {color: '#fff', fontSize: 12, fontWeight: '600'},
});
