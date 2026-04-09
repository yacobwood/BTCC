import React, {useState, useEffect, useCallback} from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';
import {Colors} from '../theme/colors';
import {fetchArticles} from '../api/client';
import {parseArticle} from '../api/parsers';
import styles from './NewsScreen.styles';
import CachedImage, {prefetchImages} from '../components/CachedImage';
import {Analytics} from '../utils/analytics';

const logoImg = require('../assets/logo_long.png');

export default function NewsScreen({navigation}) {
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
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (p = 1, append = false) => {
    try {
      if (p === 1 && !append) setLoading(true);
      setError(null);
      const raw = await fetchArticles(p);
      const parsed = raw.map(parseArticle);
      // Prefetch images in background
      prefetchImages(parsed.map(a => a.imageUrl).filter(Boolean));
      if (append) {
        setArticles(prev => [...prev, ...parsed]);
      } else {
        setArticles(parsed);
      }
      setHasMore(parsed.length >= 20);
      setPage(p);
    } catch (e) {
      if (!append) setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { Analytics.screen('news'); }, []);
  useEffect(() => { load(); }, [load]);

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
        <TouchableOpacity style={styles.retryBtn} onPress={() => { Analytics.retryClicked('news'); load(); }}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Build the list data structure
  const hero = !searchActive && articles.length > 0 ? articles[0] : null;
  const gridArticles = !searchActive ? articles.slice(1, 3) : []; // 2 grid cards
  const remaining = !searchActive ? articles.slice(3) : [];

  const buildListData = () => {
    if (searchActive && searchQuery.length >= 2) {
      return searchResults.map(a => ({type: 'compact', article: a}));
    }
    const data = [];
    if (hero) data.push({type: 'hero', article: hero});
    if (gridArticles.length > 0) data.push({type: 'grid', articles: gridArticles});
    if (remaining.length > 0) {
      data.push({type: 'moreHeader'});
      remaining.forEach(a => data.push({type: 'compact', article: a}));
    }
    return data;
  };

  const listData = buildListData();

  const renderItem = ({item}) => {
    switch (item.type) {
      case 'hero':
        return <HeroCard article={item.article} onPress={() => { Analytics.articleClicked(item.article.title, 'hero'); openArticle(item.article); }} onRefresh={onRefresh} onSearchClick={() => { Analytics.searchOpened(); setSearchActive(true); }} />;
      case 'grid':
        return <GridRow articles={item.articles} onPress={(article) => { Analytics.articleClicked(article.title, 'grid'); openArticle(article); }} />;
      case 'moreHeader':
        return <Text style={styles.moreHeader}>MORE STORIES</Text>;
      case 'compact':
        return <CompactCard article={item.article} onPress={() => { Analytics.articleClicked(item.article.title, 'list'); openArticle(item.article); }} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {searchActive && (
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color={Colors.textSecondary} />
          <TextInput
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
      {/* Preloaded search ad — always mounted so it's ready instantly */}
      <View style={searchActive && searchQuery.length < 2
        ? {flex: 1, justifyContent: 'center', alignItems: 'center'}
        : {height: 0, overflow: 'hidden'}}>
        <BannerAd
          unitId="ca-app-pub-2098489502774763/8563706368"
          size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
          requestOptions={{requestNonPersonalizedAdsOnly: true}}
          onAdFailedToLoad={() => {}}
          onAdImpression={() => Analytics.adImpression('search')}
          onAdOpened={() => Analytics.adClicked('search')}
        />
      </View>
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

// ── Hero Card ────────────────────────────────────────────────────
function HeroCard({article, onPress, onRefresh, onSearchClick}) {
  return (
    <TouchableOpacity style={styles.hero} activeOpacity={0.9} onPress={onPress} accessibilityLabel={`Featured article: ${article.title}`} accessibilityRole="button">
      {article.imageUrl && (
        <CachedImage uri={article.imageUrl} style={styles.heroImage} />
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
          {article.category ? (
            <Text style={styles.heroCategory}>{article.category.toUpperCase()}</Text>
          ) : null}
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
            <CachedImage uri={article.imageUrl} style={styles.gridImage} />
          )}
          <View style={styles.gridOverlay} />
          <View style={styles.gridContent}>
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
        <CachedImage uri={article.imageUrl} style={styles.compactImage} />
      )}
      <View style={styles.compactContent}>
        {article.category ? (
          <Text style={styles.compactCategory}>{article.category.toUpperCase()}</Text>
        ) : null}
        <Text style={styles.compactTitle} numberOfLines={3}>{article.title}</Text>
        <Text style={styles.compactDate}>{article.pubDate}</Text>
      </View>
    </TouchableOpacity>
  );
}
