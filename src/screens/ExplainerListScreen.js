import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {fetchExplainerArticles} from '../api/client';
import CachedImage from '../components/CachedImage';
import {Analytics} from '../utils/analytics';
import {CHAT_FAB_CLEARANCE} from '../utils/chatFabLayout';
import {getReadIds, markRead, markAllRead} from '../utils/explainerRead';

// Deliberately no pagination, search or hub-post merging here, unlike
// NewsScreen - this is a small (currently 48-article), fully bundled-per-fetch
// list, not an ever-growing scraped archive, so none of that complexity earns
// its keep. See fetchExplainerArticles in api/client.js for why this is a
// separate fetch/data source from the real News feed rather than merged into
// it (kept apart deliberately - these are BTCC Hub's own written explainers,
// not btcc.net journalism, and must never look like the latter).
//
// Read/unread tracking added 2026-09-02, mirroring DigestsScreen.js's own
// behaviour exactly (mark-read-on-tap, header "Mark all read/unread"
// toggle, dimmed card + READ badge) via explainerRead.js - kept as a
// separate parallel util/state rather than sharing digestRead.js's, so
// reading every Flying Lap edition doesn't also mark every Academy article
// read and vice versa.
export default function ExplainerListScreen({navigation}) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [readIds, setReadIds] = useState(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchExplainerArticles();
      setArticles(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    Analytics.screen('explainers');
    getReadIds().then(setReadIds);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      getReadIds().then(setReadIds);
    });
    return unsub;
  }, [navigation]);

  const onRefresh = useCallback(() => {
    Analytics.pullToRefresh('explainers');
    setRefreshing(true);
    load();
  }, [load]);

  const allRead = articles.length > 0 && articles.every(a => readIds.has(String(a.id)));

  const openArticle = article => {
    Analytics.articleClicked(article.title, 'explainer_list', article.source, undefined, article.sortDate);
    markRead(article.id).then(() =>
      setReadIds(prev => new Set([...prev, String(article.id)])),
    );
    navigation.navigate('Article', {article, trafficSource: 'explainer_list'});
  };

  const handleMarkAllRead = () => {
    const allIds = articles.map(a => a.id);
    markAllRead(allIds).then(() => setReadIds(new Set(allIds.map(String))));
  };

  const handleMarkAllUnread = () => {
    markAllRead([]).then(() => setReadIds(new Set()));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.yellow} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ACADEMY</Text>
        {articles.length > 0 && (
          <TouchableOpacity
            onPress={allRead ? handleMarkAllUnread : handleMarkAllRead}
            accessibilityRole="button"
            accessibilityLabel={allRead ? 'Mark all unread' : 'Mark all read'}>
            <Text style={styles.headerAction}>{allRead ? 'Mark unread' : 'Mark all read'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && articles.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { Analytics.retryClicked('explainers'); load(); }} accessibilityLabel="Retry" accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          testID="explainer-flatlist"
          data={articles}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <ExplainerRow
              article={item}
              isRead={readIds.has(String(item.id))}
              onPress={() => openArticle(item)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.yellow} />}
          contentContainerStyle={{padding: 16, paddingBottom: 20 + CHAT_FAB_CLEARANCE}}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No explainer articles yet - check back soon.</Text>
          }
        />
      )}
    </View>
  );
}

function ExplainerRow({article, isRead, onPress}) {
  return (
    <TouchableOpacity style={[styles.row, isRead && styles.rowRead]} activeOpacity={0.8} onPress={onPress} accessibilityLabel={article.title} accessibilityRole="button">
      {article.imageUrl && (
        <CachedImage uri={article.imageUrl} style={[styles.rowImage, isRead && styles.rowImageRead]} targetWidth={150} />
      )}
      <View style={styles.rowContent}>
        <View style={styles.rowCategoryRow}>
          <Text style={[styles.rowCategory, isRead && styles.rowCategoryRead]}>
            {article.order ? `EPISODE ${article.order} · ` : ''}
            {(article.category || 'REGS EXPLAINED').toUpperCase()}
          </Text>
          {isRead && <Text style={styles.readBadge}>READ</Text>}
        </View>
        <Text style={[styles.rowTitle, isRead && styles.rowTitleRead]} numberOfLines={3}>{article.title}</Text>
        {!!article.pubDate && <Text style={styles.rowDate}>{article.pubDate}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: Colors.background,
    gap: 12,
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1, flex: 1},
  headerAction: {color: Colors.yellow, fontSize: 13, fontWeight: '700'},
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  rowRead: {opacity: 0.7},
  // No fixed height - `row` doesn't set alignItems, so its default (stretch)
  // makes this match rowContent's natural height instead, which varies with
  // how many lines the title wraps to (numberOfLines={3} below). A fixed
  // height here left the image only covering the top of any row taller than
  // 96px, with a visible gap underneath on 2-3 line titles - CachedImage's
  // resizeMode="cover" default fills whatever height this resolves to
  // without distorting the image, just cropping as needed.
  rowImage: {width: 96},
  rowImageRead: {opacity: 0.5},
  rowContent: {flex: 1, padding: 12, justifyContent: 'center'},
  rowCategoryRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4},
  rowCategory: {color: Colors.yellow, fontSize: 10, fontWeight: '800', letterSpacing: 0.5},
  rowCategoryRead: {color: Colors.textSecondary},
  readBadge: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: Colors.outline,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  rowTitle: {color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 20},
  rowTitleRead: {color: Colors.textSecondary},
  rowDate: {color: Colors.textSecondary, fontSize: 12, marginTop: 6},
  errorText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 24},
  retryBtn: {marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.yellow},
  retryText: {color: Colors.background, fontWeight: '700'},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40},
});
