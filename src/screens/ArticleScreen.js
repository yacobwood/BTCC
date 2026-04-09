import React, {useMemo, useEffect, useState} from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Share,
  Linking,
  ActivityIndicator,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';
import {fetchArticleBySlug} from '../api/client';
import {parseArticle} from '../api/parsers';

export default function ArticleScreen({route, navigation}) {
  const {article: articleParam, slug} = route.params;
  const [article, setArticle] = useState(articleParam || null);
  const insets = useSafeAreaInsets();
  const topPad = insets.top || 44;

  useEffect(() => {
    if (!articleParam && slug) {
      fetchArticleBySlug(slug).then(raw => {
        if (raw) setArticle(parseArticle(raw));
      }).catch(() => {});
    }
  }, [slug, articleParam]);

  useEffect(() => {
    if (article) Analytics.screen('article:' + article.title?.substring(0, 50));
  }, [article]);

  const html = useMemo(() => article ? buildHtml(article, topPad) : null, [article, topPad]);

  const onShare = async () => {
    const slug = article.link.replace(/\/$/, '').split('/').pop();
    const appLink = `https://btcchub.vercel.app/news/${slug}`;
    Analytics.articleShared(article.title);
    await Share.share({message: `${article.title}\n\n${appLink}`});
  };

  // Open external links in browser
  const onNavigationStateChange = (event) => {
    const url = event.url;
    if (url && !url.startsWith('data:') && !url.startsWith('about:') && url !== 'https://www.btcc.net') {
      return false; // handled by onShouldStartLoadWithRequest
    }
  };

  const onShouldStartLoad = (request) => {
    const url = request.url;
    // Allow the initial HTML load and btcc.net base
    if (url.startsWith('data:') || url.startsWith('about:') || url === 'https://www.btcc.net' || url === 'https://www.btcc.net/') {
      return true;
    }
    // Open everything else in external browser
    Linking.openURL(url);
    return false;
  };

  if (!article || !html) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <ActivityIndicator color={Colors.yellow} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{html, baseUrl: 'https://www.btcc.net'}}
        style={styles.webview}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        mixedContentMode="never"
        onShouldStartLoadWithRequest={onShouldStartLoad}
      />
      <View style={[styles.statusBarBg, {height: topPad}]} />
      <View style={[styles.topBar, {top: topPad + 4}]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('NewsFeed')}
          accessibilityLabel="Go back"
          accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onShare} accessibilityLabel="Share article" accessibilityRole="button">
          <Icon name="share" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function sanitise(html) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/\s+style="[^"]*"/g, '')
    .replace(/\s+style='[^']*'/g, '')
    .replace(/\s+(?:width|height|srcset|sizes|loading|decoding|fetchpriority)="[^"]*"/g, '');
}

function buildHtml(article, topPad) {
  const content = sanitise(article.content || '');
  const heroSection = article.imageUrl
    ? `<div class="hero" style="background-image:url('${article.imageUrl}');">
         <div class="hero-gradient"></div>
         <div class="hero-text">
           <h1>${article.title}</h1>
           <p class="date">${article.pubDate}</p>
         </div>
       </div>`
    : `<div style="padding:${topPad + 50}px 16px 0;">
         <h1>${article.title}</h1>
         <p class="date">${article.pubDate}</p>
       </div>`;

  return `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <style>
      * { box-sizing:border-box; margin:0; padding:0; max-width:100%!important; }
      body { background:#0B0C0F; color:#fff; font-family:-apple-system,sans-serif; font-size:16px; line-height:1.7; padding-top:0; }
      .hero { position:relative; width:100%; min-height:${topPad + 300}px; padding-top:${topPad}px; background-size:cover; background-position:center; display:flex; flex-direction:column; justify-content:flex-end; }
      .hero-gradient { position:absolute; top:0;left:0;right:0;bottom:0; background:linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 30%,transparent 50%,rgba(11,12,15,0.95) 100%); }
      .hero-text { position:relative; z-index:1; padding:0 16px 20px; }
      h1 { font-size:22px; font-weight:700; margin-bottom:6px; line-height:1.3; }
      .date { font-size:13px; color:#8B949E; }
      .divider { height:2px; background:#FEBD02; margin:0 16px 20px; border-radius:2px; }
      .content { padding:0 16px 40px; }
      img { width:100%!important; height:auto!important; border-radius:8px; margin:12px 0; display:block; }
      p { margin-bottom:14px; }
      a { color:#FEBD02; text-decoration:none; }
      blockquote { border-left:3px solid #FEBD02; padding-left:14px; margin:16px 0; color:#8B949E; font-style:italic; }
      ul,ol { padding-left:1.5em; background:rgba(255,255,255,0.05); border-left:3px solid #FEBD02; border-radius:6px; padding:14px 14px 14px 28px; margin:16px 0; }
      li { margin-bottom:8px; color:#ccc; }
      iframe { width:100%!important; max-width:100%!important; border:none; }
      video { width:100%!important; height:auto!important; border-radius:8px; margin:12px 0; }
      table { width:100%!important; border-collapse:collapse; margin:16px 0; font-size:14px; }
      th, td { border:1px solid #333; padding:8px 10px; text-align:left; }
      th { background:rgba(255,255,255,0.08); font-weight:700; color:#fff; }
      tr:nth-child(even) { background:rgba(255,255,255,0.03); }
      td { color:#ccc; }
    </style>
  </head><body>
    ${heroSection}
    <div class="divider"></div>
    <div class="content">${content}</div>
  </body></html>`;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  webview: {flex: 1, backgroundColor: Colors.background},
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  statusBarBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
});
