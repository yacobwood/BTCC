import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {fetchArticles, fetchHubPosts} from '../api/client';
import {parseArticle} from '../api/parsers';
import styles from './NewsScreen.styles';
import CachedImage, {prefetchImages} from '../components/CachedImage';
import {Analytics} from '../utils/analytics';
import AdBanner from '../components/AdBanner';
import AdSearchBanner from '../components/AdSearchBanner';
import {useFeatureFlags} from '../store/featureFlags';
import {useSettings} from '../store/settings';
const logoImg = require('../assets/logo_long.png');

export default function NewsScreen({navigation}) {
  const {search_ad, hub_news_enabled} = useFeatureFlags();
  const {settings} = useSettings();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const flatListRef = React.useRef(null);
  const searchInputRef = React.useRef(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [searchKeyboardShown, setSearchKeyboardShown] = useState(false);
  const [error, setError] = useState(null);

  const hubNewsEnabledRef = React.useRef(hub_news_enabled);
  useEffect(() => { hubNewsEnabledRef.current = hub_news_enabled; }, [hub_news_enabled]);

  const load = useCallback(async (p = 1, append = false) => {
    try {
      if (p === 1 && !append) setLoading(true);
      setError(null);
      const [raw, hubPosts] = await Promise.all([
        fetchArticles(p),
        p === 1 && !append && hubNewsEnabledRef.current ? fetchHubPosts() : Promise.resolve(null),
      ]);
      const parsed = raw.map(parseArticle);
      if (append) {
        setArticles(prev => [...prev, ...parsed]);
      } else {
        const merged = [...(hubPosts || []), ...parsed].sort((a, b) => {
          const da = new Date(a.sortDate || a.pubDate || 0);
          const db = new Date(b.sortDate || b.pubDate || 0);
          return db - da;
        });
        setArticles(merged);
        prefetchImages(merged.map(a => a.imageUrl).filter(Boolean));
      }
      setHasMore(parsed.length >= 20);
      setPage(p);
    } catch (e) {
      if (!append) setError(e.message);
      if (append) setHasMore(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);


  useEffect(() => { Analytics.screen('news'); }, []);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      if (searchActive) setSearchKeyboardShown(true);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, [searchActive]);

  useEffect(() => {
    if (searchActive) {
      setSearchKeyboardShown(false);
    }
  }, [searchActive]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(() => {
    Analytics.pullToRefresh('news');
    setRefreshing(true);
    load(1);
  }, [load]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loadingMore || searchActive) return;
    setLoadingMore(true);
    load(page + 1, true);
  }, [hasMore, loadingMore, page, load, searchActive]);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const raw = await fetchArticles(1, 20, searchQuery);
        setSearchResults(raw.map(parseArticle));
        Analytics.newsSearched(searchQuery);
      } catch {}
      setSearchLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const openArticle = article => {
    navigation.navigate('Article', {article});
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.yellow} size="large" />
      </View>
    );
  }

  if (error && articles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { Analytics.retryClicked('news'); load(); }} accessibilityLabel="Retry" accessibilityRole="button">
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Build the list data structure — memoized so FlatList doesn't re-render
  // every time unrelated state (keyboard visibility, scroll position, etc.) changes.
  const listData = useMemo(() => {
    if (searchActive && searchQuery.length >= 2) {
      return searchResults.map(a => ({type: 'compact', article: a}));
    }
    const hero = articles.length > 0 ? articles[0] : null;
    const gridArticles = articles.slice(1, 3);
    const remaining = articles.slice(3);
    const data = [];
    if (hero) data.push({type: 'hero', article: hero});
    if (gridArticles.length > 0) data.push({type: 'grid', articles: gridArticles});
    if (remaining.length > 0) {
      data.push({type: 'moreHeader'});
      remaining.forEach(a => data.push({type: 'compact', article: a}));
    }
    return data;
  }, [articles, searchActive, searchQuery, searchResults]);

  const renderItem = useCallback(({item}) => {
    switch (item.type) {
      case 'hero':
        return <HeroCard article={item.article} onPress={() => { Analytics.articleClicked(item.article.title, 'hero', item.article.source); openArticle(item.article); }} onRefresh={onRefresh} onSearchClick={() => { Analytics.searchOpened(); setSearchActive(true); }} />;
      case 'grid':
        return <GridRow articles={item.articles} onPress={(article) => { Analytics.articleClicked(article.title, 'grid', article.source); openArticle(article); }} />;
      case 'moreHeader':
        return <Text style={styles.moreHeader}>MORE STORIES</Text>;
      case 'compact':
        return <CompactCard article={item.article} onPress={() => { Analytics.articleClicked(item.article.title, 'list', item.article.source); openArticle(item.article); }} />;
      default:
        return null;
    }
  }, [openArticle, onRefresh]);

  return (
    <View style={styles.container}>
      {searchActive && (
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search news…"
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            accessibilityLabel="Search news articles"
          />
          <TouchableOpacity onPress={() => { Analytics.searchClosed(); setSearchActive(false); setSearchQuery(''); }} accessibilityLabel="Close search" accessibilityRole="button">
            <Icon name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <AdSearchBanner visible={search_ad && searchActive && searchKeyboardShown && searchQuery.length < 2} />

      {(!searchActive || searchQuery.length >= 2) && (
      <FlatList
        ref={flatListRef}
        data={listData}
        keyExtractor={(item, i) => item.article?.id ? String(item.article.id) : `section-${i}`}
        renderItem={renderItem}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        windowSize={10}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 400)}
        scrollEventThrottle={100}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.yellow} />
        }
        ListEmptyComponent={
          searchLoading ? (
            <ActivityIndicator color={Colors.yellow} style={{marginTop: 40}} />
          ) : searchActive && searchQuery.length >= 2 ? (
            <Text style={[styles.errorText, {marginTop: 40, textAlign: 'center'}]}>No results for "{searchQuery}"</Text>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={Colors.yellow} style={{padding: 16}} /> : null
        }
        contentContainerStyle={{paddingBottom: 20}}
      />
      )}
      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopFab}
          onPress={() => { Analytics.scrollToTop('news'); flatListRef.current?.scrollToOffset({offset: 0, animated: true}); }}
          accessibilityLabel="Scroll to top"
          accessibilityRole="button">
          <Icon name="keyboard-arrow-up" size={24} color={Colors.navy} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Source Badge ─────────────────────────────────────────────────
function SourceBadge({source}) {
  const isBtccNet = source === 'btcc.net';
  return (
    <View style={[styles.sourceBadge, {backgroundColor: isBtccNet ? 'rgba(254,189,2,0.15)' : 'rgba(59,130,246,0.15)'}]}>
      <Text style={[styles.sourceBadgeText, {color: isBtccNet ? Colors.yellow : '#3B82F6'}]}>
        {isBtccNet ? 'BTCC.NET' : source.toUpperCase()}
      </Text>
    </View>
  );
}

// ── Hero Card ────────────────────────────────────────────────────
function HeroCard({article, onPress, onRefresh, onSearchClick}) {
  return (
    <TouchableOpacity style={styles.hero} activeOpacity={0.9} onPress={onPress} accessibilityLabel={`Featured article: ${article.title}`} accessibilityRole="button">
      {article.imageUrl && (
        <CachedImage uri={article.imageUrl} style={styles.heroImage} targetWidth={768} />
      )}
      <View style={styles.heroGradient}>
        {/* Top bar with logo */}
        <View style={styles.heroHeader}>
          <Image source={logoImg} style={styles.logoImage} resizeMode="contain" accessible={false} />
          <View style={{flexDirection: 'row'}}>
            <TouchableOpacity onPress={onSearchClick} style={styles.headerBtn} accessibilityLabel="Search news" accessibilityRole="button">
              <Icon name="search" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onRefresh} style={styles.headerBtn} accessibilityLabel="Refresh news" accessibilityRole="button">
              <Icon name="refresh" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Bottom text */}
        <View style={styles.heroBottom}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6}}>
            {article.category ? (
              <Text style={styles.heroCategory}>{article.category.toUpperCase()}</Text>
            ) : null}
            <SourceBadge source={article.source} />
          </View>
          <Text style={styles.heroTitle} numberOfLines={3}>{article.title}</Text>
          <Text style={styles.heroDate}>{article.pubDate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Grid Row (2 side-by-side cards) ──────────────────────────────
function GridRow({articles, onPress}) {
  return (
    <View style={styles.gridRow}>
      {articles.map(article => (
        <TouchableOpacity
          key={article.id}
          style={styles.gridCard}
          activeOpacity={0.85}
          onPress={() => onPress(article)}
          accessibilityLabel={article.title}
          accessibilityRole="button">
          {article.imageUrl && (
            <CachedImage uri={article.imageUrl} style={styles.gridImage} targetWidth={300} />
          )}
          <View style={styles.gridOverlay} />
          <View style={styles.gridContent}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4}}>
              {article.category ? (
                <Text style={styles.compactCategory}>{article.category.toUpperCase()}</Text>
              ) : null}
              <SourceBadge source={article.source} />
            </View>
            <Text style={styles.gridTitle} numberOfLines={3}>{article.title}</Text>
            <Text style={styles.gridDate}>{article.pubDate}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Compact Card (list item with category badge) ─────────────────
function CompactCard({article, onPress}) {
  return (
    <TouchableOpacity style={styles.compactCard} activeOpacity={0.8} onPress={onPress} accessibilityLabel={article.title} accessibilityRole="button">
      {article.imageUrl && (
        <CachedImage uri={article.imageUrl} style={styles.compactImage} targetWidth={150} />
      )}
      <View style={styles.compactContent}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2}}>
          {article.category ? (
            <Text style={styles.compactCategory}>{article.category.toUpperCase()}</Text>
          ) : null}
          <SourceBadge source={article.source} />
        </View>
        <Text style={styles.compactTitle} numberOfLines={3}>{article.title}</Text>
        <Text style={styles.compactDate}>{article.pubDate}</Text>
      </View>
    </TouchableOpacity>
  );
}
