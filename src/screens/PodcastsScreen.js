import React, {useState, useEffect, useMemo} from 'react';
import {View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';
import {useRadio} from '../store/radio';

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
    const title = (/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block) || /<title>([\s\S]*?)<\/title>/.exec(block) || [])[1]?.trim() || '';
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
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const {currentStation, isPlaying, play, stop} = useRadio();

  useEffect(() => {
    Analytics.screen('podcasts');
    (async () => {
      try {
        const res = await fetch(RSS_URL, {
          headers: {'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'},
        });
        const xml = await res.text();
        setEpisodes(parseRSS(xml));
      } catch (e) {
        setError(true);
      }
      setLoading(false);
    })();
  }, []);

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

  const toggleEpisode = (episode) => {
    if (currentStation === episode.title && isPlaying) {
      Analytics.navItemClicked('podcast_stop:' + episode.title);
      stop();
    } else {
      Analytics.navItemClicked('podcast_play:' + episode.title);
      play({name: episode.title, streamUrl: episode.url});
    }
  };

  const renderEpisode = ({item}) => {
    const active = currentStation === item.title && isPlaying;
    return (
      <TouchableOpacity
        style={[styles.card, active && styles.cardActive]}
        onPress={() => toggleEpisode(item)}
        accessibilityLabel={`${active ? 'Stop' : 'Play'} ${item.title}`}
        accessibilityRole="button">
        <View style={[styles.playBtn, active && {backgroundColor: Colors.yellow}]}>
          <Icon name={active ? 'stop' : 'play-arrow'} size={24} color={active ? Colors.navy : '#fff'} />
        </View>
        <View style={{flex: 1}}>
          <Text style={[styles.title, active && {color: Colors.yellow}]} numberOfLines={2}>{item.title}</Text>
          <View style={styles.meta}>
            {item.pubDate ? <Text style={styles.metaText}>{formatDate(item.pubDate)}</Text> : null}
            {item.duration ? <Text style={styles.metaText}>{formatDuration(item.duration)}</Text> : null}
          </View>
        </View>
        {active && <View style={styles.liveDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PODCASTS</Text>
        {isPlaying && (
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
        <View style={styles.center}><Text style={styles.emptyText}>Could not load episodes</Text></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={item => item.key}
          renderItem={({item}) => item.type === 'header'
            ? <Text style={styles.monthHeader}>{item.label}</Text>
            : renderEpisode({item})}
          contentContainerStyle={{padding: 16, paddingBottom: 20}}
          ListEmptyComponent={<Text style={styles.emptyText}>No episodes found</Text>}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5}
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
  card: {flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 10, gap: 12},
  cardActive: {borderWidth: 1, borderColor: Colors.yellow},
  playBtn: {width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center'},
  title: {color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20},
  meta: {flexDirection: 'row', gap: 10, marginTop: 4},
  metaText: {color: Colors.textSecondary, fontSize: 11},
  liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.yellow},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40},
  monthHeader: {color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 16, marginBottom: 8},
});
