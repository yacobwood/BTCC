import React, {useRef, useCallback, useState} from 'react';
import {View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions} from 'react-native';
import PagerView from 'react-native-pager-view';
import {Colors} from '../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Defers rendering until the page has been active at least once.
function LazyPage({active, children}) {
  const rendered = useRef(false);
  if (active) rendered.current = true;
  return <View style={{flex: 1}}>{rendered.current ? children : null}</View>;
}

export default function SwipeableTabs({
  tabs,
  pages,
  initialPage = 0,
  onTabChange,
  tabRowStyle,
  lazy = false,
}) {
  const pagerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const tabW = SCREEN_WIDTH / tabs.length;
  const indicatorX = useRef(new Animated.Value(initialPage * tabW)).current;
  // Prevents onPageScroll from fighting the spring animation during tap navigation.
  const programmatic = useRef(false);

  const goToTab = useCallback((i) => {
    programmatic.current = true;
    pagerRef.current?.setPageWithoutAnimation(i);
    Animated.spring(indicatorX, {
      toValue: i * tabW,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start(({finished}) => {
      // Only reset when this spring ran to completion. If a second tap interrupted
      // it, finished=false — leave the flag true so the new spring's callback handles it.
      if (finished) programmatic.current = false;
    });
    setCurrentPage(i);
    onTabChange?.(i);
  }, [indicatorX, tabW, onTabChange]);

  const onPageScroll = useCallback(({nativeEvent: {position, offset}}) => {
    if (!programmatic.current) {
      indicatorX.setValue((position + offset) * tabW);
    }
  }, [indicatorX, tabW]);

  const onPageSelected = useCallback(({nativeEvent: {position}}) => {
    if (!programmatic.current) {
      // Swipe-initiated page change — update state and fire callback.
      setCurrentPage(position);
      onTabChange?.(position);
    }
    // programmatic reset is handled by the spring completion callback, not here.
  }, [onTabChange]);

  return (
    <View style={{flex: 1}}>
      <View style={[styles.tabRow, tabRowStyle]}>
        {tabs.map((label, i) => (
          <TouchableOpacity
            key={i}
            style={styles.tab}
            onPress={() => goToTab(i)}
            accessibilityRole="tab"
            accessibilityLabel={`${label} tab`}>
            <Text style={[styles.tabText, currentPage === i && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
        <Animated.View style={[styles.indicator, {width: tabW, transform: [{translateX: indicatorX}]}]} />
      </View>
      <PagerView
        ref={pagerRef}
        style={{flex: 1}}
        initialPage={initialPage}
        onPageScroll={onPageScroll}
        onPageSelected={onPageSelected}>
        {pages.map((page, i) => (
          <View key={String(i)} style={{flex: 1}}>
            {lazy ? <LazyPage active={i === currentPage}>{page}</LazyPage> : page}
          </View>
        ))}
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    height: 44,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  tab: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  tabText: {color: Colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5},
  tabTextActive: {color: Colors.yellow},
  indicator: {position: 'absolute', bottom: 0, left: 0, height: 2, backgroundColor: Colors.yellow},
});
