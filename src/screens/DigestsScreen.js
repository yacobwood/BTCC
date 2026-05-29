import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {fetchHubPosts} from '../api/client';
import CachedImage from '../components/CachedImage';
import {Analytics} from '../utils/analytics';
import {getReadIds, markRead, markAllRead, markUnread} from '../utils/digestRead';

export default function DigestsScreen({navigation}) {
  const [digests, setDigests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [readIds, setReadIds] = useState(new Set());

  const load = () => {
    setLoading(true);
    setError(false);
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const all = await fetchHubPosts();
        if (!cancelled) {
          setDigests(all.filter(a => a.category === 'Weekly Digest'));
        }
      } catch {
        if (!cancelled) setError(true);
      }
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  };

  useEffect(() => {
    Analytics.screen('digests');
    getReadIds().then(setReadIds);
    return load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group by month  -  assign episode numbers oldest-first
  const listData = useMemo(() => {
    const sorted = [...digests].sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate));
    const episodeMap = {};
    sorted.forEach((a, i) => { episodeMap[a.id] = i + 1; });

    const result = [];
    let lastMonth = null;
    digests.forEach(article => {
      const monthKey = article.sortDate
        ? new Date(article.sortDate).toLocaleDateString('en-GB', {month: 'long', year: 'numeric'})
        : null;
      if (monthKey && monthKey !== lastMonth) {
        result.push({type: 'header', key: `header-${monthKey}`, label: monthKey});
        lastMonth = monthKey;
      }
      result.push({type: 'digest', key: String(article.id), article, episode: episodeMap[article.id]});
    });
    return result;
  }, [digests]);

  const allRead = digests.length > 0 && digests.every(a => readIds.has(String(a.id)));

  const openArticle = article => {
    Analytics.articleClicked(article.title, 'digest', article.source);
    markRead(article.id).then(() =>
      setReadIds(prev => new Set([...prev, String(article.id)])),
    );
    navigation.navigate('Article', {article, trafficSource: 'organic'});
  };

  const handleMarkAllRead = () => {
    const allIds = digests.map(a => a.id);
    markAllRead(allIds).then(() => setReadIds(new Set(allIds.map(String))));
  };

  const handleMarkAllUnread = () => {
    markAllRead([]).then(() => setReadIds(new Set()));
  };

  const toggleRead = article => {
    const id = String(article.id);
    if (readIds.has(id)) {
      markUnread(article.id).then(() =>
        setReadIds(prev => { const s = new Set(prev); s.delete(id); return s; }),
      );
    } else {
      markRead(article.id).then(() =>
        setReadIds(prev => new Set([...prev, id])),
      );
    }
  };

  const renderItem = ({item}) => {
    if (item.type === 'header') {
      return <Text style={styles.monthHeader}>{item.label.toUpperCase()}</Text>;
    }
    const {article, episode} = item;
    const isRead = readIds.has(String(article.id));
    return (
      <TouchableOpacity
        style={[styles.card, isRead && styles.cardRead]}
        activeOpacity={0.8}
        onPress={() => openArticle(article)}
accessibilityLabel={article.title}
        accessibilityRole="button">
        {article.imageUrl && (
          <CachedImage uri={article.imageUrl} style={[styles.cardImage, isRead && styles.cardImageRead]} targetWidth={150} />
        )}
        <View style={styles.cardContent}>
          <View style={styles.cardCategoryRow}>
            <Text style={[styles.cardCategory, isRead && styles.cardCategoryRead]}>BTCC MONDAY ROUNDUP · EP. {episode}</Text>
            {isRead && <Text style={styles.readBadge}>READ</Text>}
          </View>
          <Text style={[styles.cardTitle, isRead && styles.cardTitleRead]} numberOfLines={3}>{article.title}</Text>
          <Text style={styles.cardDate}>{article.pubDate}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{padding: 4}}
          accessibilityLabel="Go back"
          accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BTCC MONDAY ROUNDUP</Text>
        {digests.length > 0 && (
          <TouchableOpacity
            onPress={allRead ? handleMarkAllUnread : handleMarkAllRead}
            accessibilityRole="button"
            accessibilityLabel={allRead ? 'Mark all unread' : 'Mark all read'}>
            <Text style={styles.headerAction}>{allRead ? 'Mark unread' : 'Mark all read'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.yellow} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Icon name="wifi-off" size={40} color={Colors.outline} />
          <Text style={styles.emptyText}>Could not load digests</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityLabel="Retry" accessibilityRole="button">
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item.key}
          renderItem={renderItem}
          contentContainerStyle={{padding: 16, paddingBottom: 20}}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No digests found</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1, flex: 1},
  headerAction: {color: Colors.yellow, fontSize: 13, fontWeight: '700'},
  monthHeader: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  unreadBtn: {justifyContent: 'center', paddingHorizontal: 12},
  cardImage: {width: 100, height: 90},
  cardImageRead: {opacity: 0.5},
  cardRead: {opacity: 0.7},
  cardContent: {flex: 1, padding: 10, justifyContent: 'center'},
  cardCategoryRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3},
  cardCategory: {color: Colors.yellow, fontSize: 10, fontWeight: '800', letterSpacing: 1},
  cardCategoryRead: {color: Colors.textSecondary},
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
  cardTitle: {color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 18},
  cardTitleRead: {color: Colors.textSecondary},
  cardDate: {color: Colors.textSecondary, fontSize: 11, marginTop: 4},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40},
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  retryBtnText: {color: '#fff', fontSize: 13, fontWeight: '700'},
});
