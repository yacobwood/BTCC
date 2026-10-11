import React, {useState, useEffect, useMemo, useRef} from 'react';
import {View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, InteractionManager, RefreshControl, PanResponder} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';
import {useRadio} from '../store/radio';
import {CHAT_FAB_CLEARANCE} from '../utils/chatFabLayout';
import {decodeEntities} from '../api/parsers';

const CACHE_KEY = 'podcasts_episodes';

const RSS_URL = 'https://rss.buzzsprout.com/1065916.rss';

const SESSION_FILTERS = ['All', 'Race', 'Qualifying', 'Practice', 'Interview', 'Podcast'];

function matchesSession(title, filter) {
  if (filter === 'All') return true;
  const t = title.toLowerCase();
  if (filter === 'Race') return /\brace\b/.test(t);
  if (filter === 'Qualifying') return /qualif/.test(t);
  if (filter === 'Practice') return /practice/.test(t);
  if (filter === 'Interview') return /(launch day|media day|season launch|interview)/.test(t);
  if (filter === 'Podcast') return /(podcast|tin top tuesday|listen again)/.test(t);
  return true;
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const rawTitle = (/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block) || /<title>([\s\S]*?)<\/title>/.exec(block) || [])[1]?.trim() || '';
    const title = rawTitle ? decodeEntities(rawTitle) : '';
    const url = /enclosure[^>]+url="([^"]+)"/.exec(block)?.[1] || '';
    const pubDate = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1]?.trim() || '';
    const duration = /<itunes:duration>([\s\S]*?)<\/itunes:duration>/.exec(block)?.[1]?.trim() || '';
    if (title && url) items.push({title, url, pubDate, duration});
  }
  return items;
}

function formatDuration(raw) {
  const secs = parseInt(raw, 10);
  if (isNaN(secs)) return raw;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// <itunes:duration> may be plain seconds ("2730"), "MM:SS" or "HH:MM:SS".
export function parseDurationSeconds(raw) {
  if (!raw) return 0;
  const parts = String(raw).trim().split(':').map(n => parseInt(n, 10));
  if (parts.some(isNaN)) return 0;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

export function formatClock(totalSeconds) {
  const t = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// Tap or drag anywhere on the track to seek. The thumb follows the finger
// locally while dragging and only seeks once on release, so a drag doesn't
// fire dozens of native seeks.
function ProgressBar({position, duration, onSeek}) {
  const [width, setWidth] = useState(0);
  const [dragPos, setDragPos] = useState(null);
  const stateRef = useRef({width: 0, duration: 0, onSeek});
  stateRef.current = {width, duration, onSeek};

  const toSeconds = (x) => {
    const {width: w, duration: d} = stateRef.current;
    if (!w || !d) return 0;
    return Math.min(Math.max(x / w, 0), 1) * d;
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => stateRef.current.duration > 0,
    onMoveShouldSetPanResponder: () => stateRef.current.duration > 0,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => setDragPos(toSeconds(e.nativeEvent.locationX)),
    onPanResponderMove: e => setDragPos(toSeconds(e.nativeEvent.locationX)),
    onPanResponderRelease: e => {
      stateRef.current.onSeek(toSeconds(e.nativeEvent.locationX));
      setDragPos(null);
    },
    onPanResponderTerminate: () => setDragPos(null),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = dragPos ?? position;
  const pct = duration > 0 ? Math.min(shown / duration, 1) * 100 : 0;

  return (
    <View style={styles.progressWrap}>
      <View
        testID="podcast-progress"
        style={styles.progressHit}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel="Playback position"
        accessibilityValue={{min: 0, max: Math.round(duration), now: Math.round(shown), text: `${formatClock(shown)} of ${formatClock(duration)}`}}
        accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
        onAccessibilityAction={e => {
          const step = e.nativeEvent.actionName === 'increment' ? 15 : -15;
          onSeek(Math.min(Math.max(position + step, 0), duration));
        }}
        {...responder.panHandlers}>
        <View style={styles.progressTrack} pointerEvents="none">
          <View style={[styles.progressFill, {width: `${pct}%`}]} />
        </View>
        <View style={[styles.progressThumb, {left: `${pct}%`}]} pointerEvents="none" />
      </View>
      <View style={styles.progressTimes}>
        <Text style={styles.progressTime}>{formatClock(shown)}</Text>
        <View style={styles.skipRow}>
          <TouchableOpacity
            onPress={() => onSeek(Math.max(position - 10, 0))}
            style={styles.skipBtn}
            accessibilityLabel="Back 10 seconds"
            accessibilityRole="button">
            <Icon name="replay-10" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onSeek(duration > 0 ? Math.min(position + 30, duration) : position + 30)}
            style={styles.skipBtn}
            accessibilityLabel="Forward 30 seconds"
            accessibilityRole="button">
            <Icon name="forward-30" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.progressTime}>{duration > 0 ? formatClock(duration) : '--:--'}</Text>
      </View>
    </View>
  );
}

function formatDate(raw) {
  try {
    return new Date(raw).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});
  } catch {
    return raw;
  }
}

const PAGE_SIZE = 20;

export default function PodcastsScreen({navigation}) {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const {currentStation, isPlaying, isPaused, progress, play, stop, pause, resume, seekTo} = useRadio();
  // Tracks whether the initial fetch has already been kicked off - NOT
  // `loading` itself, because the effect below calls setLoading(false) on a
  // cache hit before it awaits InteractionManager. Driving the effect's
  // dependency array off `loading` used to re-trigger this same effect right
  // then: the in-flight run's cleanup set `cancelled` and cancelled its
  // InteractionManager task, and the brand-new instance's own
  // `!loading && !refreshing` guard exited immediately (both now false),
  // silently skipping the network re-fetch entirely. A ref that this effect
  // only ever sets (never a dependency) can't cause that re-trigger.
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    const isInitialLoad = !hasFetchedRef.current;
    if (!isInitialLoad && !refreshing) return;
    hasFetchedRef.current = true;
    if (isInitialLoad) Analytics.screen('podcasts');
    let cancelled = false;
    let task;

    const run = async () => {
      // 1. Show cached episodes immediately on first load (skip on pull-to-refresh)
      if (isInitialLoad) {
        try {
          const raw = await AsyncStorage.getItem(CACHE_KEY);
          if (raw && !cancelled) {
            setEpisodes(JSON.parse(raw));
            setLoading(false);
          }
        } catch {}
      }

      // 2. Wait for screen transition to finish before network + parse
      await new Promise(resolve => {
        task = InteractionManager.runAfterInteractions(resolve);
      });
      if (cancelled) return;

      // 3. Fetch fresh data
      let fetched = false;
      for (const headers of [
        {},
        {'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'},
      ]) {
        if (fetched || cancelled) break;
        try {
          const res = await fetch(RSS_URL, {headers});
          if (!res.ok) continue;
          const xml = await res.text();
          if (cancelled) break;
          const fresh = parseRSS(xml);
          if (fresh.length === 0) continue;
          fetched = true;
          if (!cancelled) {
            setEpisodes(fresh);
            setError(false);
          }
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
        } catch {}
      }
      if (!fetched && !cancelled) setError(episodes.length === 0);
      if (!cancelled) { setLoading(false); setRefreshing(false); }
    };

    run();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [refreshing]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() =>
    episodes.filter(e => matchesSession(e.title, filter)),
    [episodes, filter]
  );

  const visible = useMemo(() => {
    const sliced = filtered.slice(0, page * PAGE_SIZE);
    const result = [];
    let lastMonth = null;
    sliced.forEach(ep => {
      const monthKey = ep.pubDate
        ? new Date(ep.pubDate).toLocaleDateString('en-GB', {month: 'long', year: 'numeric'})
        : null;
      if (monthKey && monthKey !== lastMonth) {
        result.push({type: 'header', key: `header-${monthKey}`, label: monthKey});
        lastMonth = monthKey;
      }
      result.push({type: 'episode', key: ep.url, ...ep});
    });
    return result;
  }, [filtered, page]);

  const onFilterChange = (f) => { setFilter(f); setPage(1); };
  const onLoadMore = () => { if (visible.length < filtered.length) setPage(p => p + 1); };

  const hasActive = !!currentStation && (isPlaying || isPaused);

  const toggleEpisode = (episode) => {
    const isCurrent = hasActive && currentStation === episode.title;
    if (isCurrent && isPlaying) {
      Analytics.navItemClicked('podcast_pause:' + episode.title);
      pause();
    } else if (isCurrent && isPaused) {
      Analytics.navItemClicked('podcast_resume:' + episode.title);
      resume();
    } else {
      Analytics.navItemClicked('podcast_play:' + episode.title);
      play({name: episode.title, streamUrl: episode.url, isLive: false});
    }
  };

  const stopEpisode = (episode) => {
    Analytics.navItemClicked('podcast_stop:' + episode.title);
    stop();
  };

  const seekEpisode = (episode, seconds) => {
    Analytics.navItemClicked('podcast_seek:' + episode.title);
    seekTo(seconds);
  };

  const renderEpisode = ({item}) => {
    const active = hasActive && currentStation === item.title;
    const playingNow = active && isPlaying;
    const actionLabel = !active ? 'Play' : playingNow ? 'Pause' : 'Resume';
    // The player's own duration is unknown until the file's header loads -
    // fall back to the RSS duration so the bar has a scale straight away.
    const duration = progress?.duration > 0 ? progress.duration : parseDurationSeconds(item.duration);
    return (
      <View style={[styles.card, active && styles.cardActive]}>
        <View style={styles.cardRow}>
          <TouchableOpacity
            style={styles.cardMain}
            onPress={() => toggleEpisode(item)}
            accessibilityLabel={`${actionLabel} ${item.title}`}
            accessibilityRole="button">
            <View style={[styles.playBtn, active && {backgroundColor: Colors.yellow}]}>
              <Icon name={playingNow ? 'pause' : 'play-arrow'} size={24} color={active ? Colors.navy : '#fff'} />
            </View>
            <View style={{flex: 1}}>
              <Text style={[styles.title, active && {color: Colors.yellow}]} numberOfLines={2}>{item.title}</Text>
              <View style={styles.meta}>
                {item.pubDate ? <Text style={styles.metaText}>{formatDate(item.pubDate)}</Text> : null}
                {item.duration ? <Text style={styles.metaText}>{formatDuration(item.duration)}</Text> : null}
                {active && !playingNow ? <Text style={[styles.metaText, {color: Colors.yellow}]}>Paused</Text> : null}
              </View>
            </View>
          </TouchableOpacity>
          {active && (
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={() => stopEpisode(item)}
              accessibilityLabel={`Stop ${item.title}`}
              accessibilityRole="button">
              <Icon name="stop" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        {active && (
          <ProgressBar
            position={progress?.position || 0}
            duration={duration}
            onSeek={s => seekEpisode(item, s)}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PODCASTS</Text>
        {hasActive && (
          <TouchableOpacity onPress={stop} style={styles.stopAllBtn} accessibilityLabel="Stop playback" accessibilityRole="button">
            <Icon name="stop" size={18} color={Colors.navy} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {SESSION_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => onFilterChange(f)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${f}`}>
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.filterChevron} pointerEvents="none">
          <Icon name="chevron-right" size={20} color={Colors.textSecondary} />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.yellow} size="large" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Icon name="wifi-off" size={40} color={Colors.outline} />
          <Text style={[styles.emptyText, {marginTop: 12}]}>Could not load episodes</Text>
          <TouchableOpacity
            style={{marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.outline}}
            onPress={() => { setError(false); setLoading(true); }}>
            <Text style={{color: '#fff', fontSize: 13, fontWeight: '700'}}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={item => item.key}
          renderItem={({item}) => item.type === 'header'
            ? <Text style={styles.monthHeader}>{item.label}</Text>
            : renderEpisode({item})}
          contentContainerStyle={{padding: 16, paddingBottom: 20 + CHAT_FAB_CLEARANCE}}
          ListEmptyComponent={<Text style={styles.emptyText}>No episodes found</Text>}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(true)}
              tintColor={Colors.yellow}
              colors={[Colors.yellow]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  header: {flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, gap: 12},
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1, flex: 1},
  stopAllBtn: {width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.yellow, justifyContent: 'center', alignItems: 'center'},
  filterWrapper: {flexDirection: 'row', alignItems: 'center'},
  filterRow: {paddingLeft: 16, paddingRight: 8, paddingBottom: 12, gap: 8, flexDirection: 'row'},
  filterChevron: {paddingRight: 8, paddingBottom: 12},
  chip: {paddingHorizontal: 14, height: 34, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.outline, justifyContent: 'center'},
  chipActive: {backgroundColor: Colors.yellow, borderColor: Colors.yellow},
  chipText: {color: Colors.textSecondary, fontSize: 13, fontWeight: '600'},
  chipTextActive: {color: Colors.navy},
  card: {backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 10},
  cardRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  cardMain: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12},
  cardActive: {borderWidth: 1, borderColor: Colors.yellow},
  playBtn: {width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center'},
  title: {color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20},
  meta: {flexDirection: 'row', gap: 10, marginTop: 4},
  metaText: {color: Colors.textSecondary, fontSize: 11},
  stopBtn: {width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center'},
  progressWrap: {marginTop: 12},
  progressHit: {height: 24, justifyContent: 'center'},
  progressTrack: {height: 4, borderRadius: 2, backgroundColor: Colors.surface, overflow: 'hidden'},
  progressFill: {height: 4, backgroundColor: Colors.yellow},
  progressThumb: {position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7, backgroundColor: Colors.yellow},
  progressTimes: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2},
  skipRow: {flexDirection: 'row', gap: 24},
  skipBtn: {padding: 4},
  progressTime: {color: Colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums']},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40},
  monthHeader: {color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 16, marginBottom: 8},
});
