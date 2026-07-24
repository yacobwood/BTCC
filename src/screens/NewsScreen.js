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
import {fetchArticles, fetchHubPosts, peekArticlesCache} from '../api/client';
import {parseArticle} from '../api/parsers';
import styles from './NewsScreen.styles';
import CachedImage, {prefetchImages} from '../components/CachedImage';
import {Analytics} from '../utils/analytics';
import {useFocusEffect} from '@react-navigation/native';
import {useFeatureFlags} from '../store/featureFlags';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {getReadIds} from '../utils/digestRead';
const logoImg = require('../assets/logo_long.png');

const byDateDesc = (a, b) =>
  new Date(b.sortDate || b.pubDate || 0) - new Date(a.sortDate || a.pubDate || 0);

export default function NewsScreen({navigation}) {
  const {hub_news_enabled} = useFeatureFlags();
  const {favourites} = useFavouriteDriver();
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
  const [digestReadIds, setDigestReadIds] = useState(new Set());

  const hubNewsEnabledRef = React.useRef(hub_news_enabled);
  useEffect(() => { hubNewsEnabledRef.current = hub_news_enabled; }, [hub_news_enabled]);

  const load = useCallback(async (p = 1, append = false, force = false) => {
    setError(null);

    // Phase 1  -  show any cached articles immediately so the user never stares at a spinner
    // for content they've already seen. Skipped when force=true (pull-to-refresh) because
    // the user explicitly asked for fresh data, or when paginating.
    let shownStale = false;
    if (p === 1 && !append && !force) {
      const staleRaw = await peekArticlesCache(1);
      if (staleRaw?.length) {
        setArticles(staleRaw.map(parseArticle));
        setLoading(false);
        shownStale = true;
      } else {
        setLoading(true);
      }
    } else if (p === 1 && !append) {
      setLoading(true);
    }

    // Phase 2  -  fetch fresh data from the network and update the list.
    // forceRefresh=true bypasses the fetchJson cache so this always hits the network.
    try {
      const [raw, hubPosts] = await Promise.all([
        fetchArticles(p, 20, '', /* forceRefresh */ true),
        p === 1 && !append && hubNewsEnabledRef.current ? fetchHubPosts() : Promise.resolve(null),
      ]);
      const parsed = raw.map(parseArticle);
      if (append) {
        setArticles(prev => [...prev, ...parsed].sort(byDateDesc));
      } else {
        const merged = [...(hubPosts || []), ...parsed].sort(byDateDesc);
        setArticles(merged);
        // Prefetch at the thumbnail sizes CachedImage will actually request so
        // Android's OkHttp disk cache is warm for the exact URLs rendered.
        const allImageUrls = merged.map(a => a.imageUrl);
        prefetchImages(allImageUrls.slice(0, 1).filter(Boolean), 768);   // hero
        prefetchImages(allImageUrls.slice(1, 3).filter(Boolean), 300);   // grid
        prefetchImages(allImageUrls.slice(3).filter(Boolean), 150);      // compact list
      }
      setHasMore(parsed.length >= 20);
      setPage(p);
    } catch (e) {
      // If Phase 1 already showed stale articles, silently absorb the network error  - 
      // the user has something to read. Only surface the error on a true cold start.
      if (!append && !shownStale) setError(e.message);
      if (append) setHasMore(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);


  useEffect(() => { Analytics.screen('news'); }, []);
  useFocusEffect(useCallback(() => { getReadIds().then(setDigestReadIds); }, []));
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
    load(1, false, true);
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
    navigation.navigate('Article', {article, trafficSource: 'organic'});
  };

  // Hooks must be declared before any early returns (Rules of Hooks).
  const listData = useMemo(() => {
    if (searchActive && searchQuery.length >= 2) {
      return searchResults.map(a => ({type: 'compact', article: a}));
    }
    const digests = articles.filter(a => a.category === 'Weekly Digest');
    const nonDigests = articles.filter(a => a.category !== 'Weekly Digest');
    const hero = nonDigests[0] ?? null;
    const gridArticles = nonDigests.slice(1, 3);
    const remaining = nonDigests.slice(3);
    const data = [];
    if (hero) data.push({type: 'hero', article: hero});
    if (gridArticles.length > 0) data.push({type: 'grid', articles: gridArticles});
    if (digests.length > 0) {
      const unread = digests.filter(a => !digestReadIds.has(String(a.id))).length;
      data.push({type: 'digestBanner', count: digests.length, unread});
    }
    if (remaining.length > 0) {
      data.push({type: 'moreHeader'});
      remaining.forEach(a => data.push({type: 'compact', article: a}));
    }
    return data;
  }, [articles, searchActive, searchQuery, searchResults, digestReadIds]);

  const renderItem = useCallback(({item}) => {
    switch (item.type) {
      case 'hero':
        return <HeroCard article={item.article} favourite={favourites} onPress={() => { Analytics.articleClicked(item.article.title, 'hero', item.article.source, undefined, item.article.sortDate); openArticle(item.article); }} onRefresh={onRefresh} onSearchClick={() => { Analytics.searchOpened(); setSearchActive(true); }} />;
      case 'grid':
        return <GridRow articles={item.articles} favourite={favourites} onPress={(article) => { Analytics.articleClicked(article.title, 'grid', article.source, undefined, article.sortDate); openArticle(article); }} />;
      case 'moreHeader':
        return <Text style={styles.moreHeader}>MORE STORIES</Text>;
      case 'compact':
        return <CompactCard article={item.article} favourite={favourites} onPress={() => { Analytics.articleClicked(item.article.title, 'list', item.article.source, undefined, item.article.sortDate); openArticle(item.article); }} />;
      case 'digestBanner':
        return (
          <DigestBanner
            count={item.count}
            unread={item.unread}
            onPress={() => {
              Analytics.navItemClicked('digest_banner');
              navigation.navigate('Digests');
            }}
          />
        );
      default:
        return null;
    }
  }, [openArticle, onRefresh, favourites]);

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

      {(!searchActive || searchQuery.length >= 2) && (
      <FlatList
        ref={flatListRef}
        testID="news-flatlist"
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

// ── Favourite driver name match ───────────────────────────────────
function titleMentionsFav(title, favourites) {
  if (!favourites?.length || !title) return false;
  const titleLc = title.toLowerCase();
  return favourites.some(f => titleLc.includes(f.split(' ').pop().toLowerCase()));
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
function HeroCard({article, favourite, onPress, onRefresh, onSearchClick}) {
  const isFav = titleMentionsFav(article.title, favourite);
  return (
    <TouchableOpacity style={[styles.hero, isFav && styles.favBorder]} activeOpacity={0.9} onPress={onPress} accessibilityLabel={`Featured article: ${article.title}`} accessibilityRole="button">
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
function GridRow({articles, favourite, onPress}) {
  return (
    <View style={styles.gridRow}>
      {articles.map(article => (
        <TouchableOpacity
          key={article.id}
          style={[styles.gridCard, titleMentionsFav(article.title, favourite) && styles.favBorder]}
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

// ── Digest Banner ─────────────────────────────────────────────────
function DigestBanner({count, unread, onPress}) {
  const hasUnread = unread > 0;
  const subtitle = hasUnread
    ? `${unread} unread edition${unread !== 1 ? 's' : ''}`
    : 'All caught up';
  return (
    <TouchableOpacity
      style={[styles.digestBanner, hasUnread ? styles.digestBannerUnread : styles.digestBannerRead]}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityLabel="View BTCC Monday Roundup"
      accessibilityRole="button">
      <Icon
        name="library-books"
        size={22}
        color={hasUnread ? '#000' : Colors.textSecondary}
        style={styles.digestBannerIcon}
      />
      <View style={{flex: 1}}>
        <Text style={{fontSize: 14, fontWeight: '900', letterSpacing: 0.5, color: hasUnread ? '#000' : Colors.textSecondary}}>
          BTCC MONDAY ROUNDUP
        </Text>
        <Text style={{fontSize: 12, marginTop: 2, color: hasUnread ? 'rgba(0,0,0,0.6)' : Colors.textSecondary}}>
          {subtitle}
        </Text>
      </View>
      <Icon
        name="chevron-right"
        size={22}
        color={hasUnread ? '#000' : Colors.textSecondary}
        style={hasUnread && styles.digestBannerChevronUnread}
      />
    </TouchableOpacity>
  );
}

// ── Compact Card (list item with category badge) ─────────────────
function CompactCard({article, favourite, onPress}) {
  const isFav = titleMentionsFav(article.title, favourite);
  return (
    <TouchableOpacity style={[styles.compactCard, isFav && styles.favBorder]} activeOpacity={0.8} onPress={onPress} accessibilityLabel={article.title} accessibilityRole="button">
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
