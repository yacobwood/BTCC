import React, {useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';
import {CHAT_FAB_CLEARANCE} from '../utils/chatFabLayout';

// A fixed, hand-curated list - one new episode a year at most, so this
// doesn't warrant a scraper/data-file pipeline the way Partners or Shorts
// do. YouTube's own thumbnail CDN (i.ytimg.com) is used directly rather
// than mirroring images, the same public no-auth-required URL pattern
// YouTube itself serves as <video>/maxresdefault.jpg etc.
const EPISODES = [
  {year: 2025, videoId: 'zY5xrSfCs5I'},
  {year: 2024, videoId: 'BkLpRq94cnw'},
  {year: 2023, videoId: 'SXqVedhpzfA'},
  {year: 2022, videoId: 'eRw8Moyirjo'},
  {year: 2021, videoId: 'NsB_5Imznok'},
  {year: 2020, videoId: 'tGQQV_cMPHs'},
].map(e => ({
  ...e,
  url: `https://youtu.be/${e.videoId}`,
  thumbnailUrl: `https://i.ytimg.com/vi/${e.videoId}/hqdefault.jpg`,
}));

export default function OnTheLimitScreen({navigation}) {
  useEffect(() => { Analytics.screen('on_the_limit'); }, []);

  const openEpisode = (item) => {
    Analytics.moreItemClicked('on_the_limit_episode:' + item.year);
    Linking.openURL(item.url);
  };

  const renderEpisode = ({item}) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => openEpisode(item)}
      accessibilityLabel={`Watch On The Limit ${item.year} on YouTube`}
      accessibilityRole="button">
      <View style={styles.thumbnailWrap}>
        <Image source={{uri: item.thumbnailUrl}} style={styles.thumbnail} resizeMode="cover" />
        <View style={styles.playBadge}>
          <Icon name="play-arrow" size={22} color="#fff" />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.year}>{item.year}</Text>
        <Text style={styles.title}>On The Limit {item.year}</Text>
      </View>
      <Icon name="open-in-new" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ON THE LIMIT</Text>
      </View>
      <View style={styles.yellowDivider} />
      <FlatList
        data={EPISODES}
        keyExtractor={item => item.videoId}
        renderItem={renderEpisode}
        contentContainerStyle={{padding: 16, paddingBottom: 30 + CHAT_FAB_CLEARANCE}}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <Text style={styles.intro}>
            BTCC's end-of-season documentary series, following the championship battle from behind the scenes. Tap a year to watch on YouTube.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: {color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5, flex: 1},
  yellowDivider: {height: 3, backgroundColor: Colors.yellow, marginHorizontal: 16, borderRadius: 2},
  intro: {color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 20, marginTop: 16},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 10,
    gap: 12,
  },
  thumbnailWrap: {width: 96, height: 96 * 9 / 16, borderRadius: 8, overflow: 'hidden'},
  thumbnail: {width: '100%', height: '100%', backgroundColor: Colors.surface},
  playBadge: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  body: {flex: 1},
  year: {color: Colors.yellow, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2},
  title: {color: '#fff', fontSize: 15, fontWeight: '700'},
  separator: {height: 12},
});
