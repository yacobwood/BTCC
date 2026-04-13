import React, {useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';

const pagesData = require('../assets/pages.json');

export default function InfoPageScreen({route, navigation}) {
  const {page} = route.params;

  useEffect(() => { Analytics.infoPageViewed(page.id); }, []);

  const openSubPage = (pageId) => {
    const allPages = (pagesData.pages || []).map(p => ({
      id: p.id || '',
      title: p.title || '',
      icon: p.icon || 'info',
      sections: (p.sections || []).map(s => ({
        type: s.type || '',
        body: s.body || '',
        url: s.url || '',
      })),
    }));
    const target = allPages.find(p => p.id === pageId);
    if (target) {
      navigation.push('InfoPage', {page: target});
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{page.title.toUpperCase()}</Text>
      </View>
      <View style={styles.yellowDivider} />
      <ScrollView contentContainerStyle={{padding: 16, paddingBottom: 30}}>
        {(page.sections || []).map((section, i) => {
          switch (section.type) {
            case 'text':
              return <Text key={i} style={styles.text}>{section.body}</Text>;
            case 'heading':
              return <Text key={i} style={styles.heading}>{section.body}</Text>;
            case 'image':
              return section.url ? (
                <Image key={i} source={{uri: section.url}} style={styles.image} resizeMode="cover" />
              ) : null;
            case 'callout':
              return (
                <View key={i} style={styles.callout}>
                  <Text style={styles.calloutLabel}>TALKING POINT</Text>
                  <Text style={styles.calloutText}>{section.body}</Text>
                </View>
              );
            case 'link':
              const isInternal = section.url && !section.url.startsWith('http');
              return (
                <TouchableOpacity key={i} onPress={() => {
                  if (isInternal) {
                    openSubPage(section.url);
                  } else if (section.url) {
                    Linking.openURL(section.url);
                  }
                }} style={styles.linkCard} accessibilityRole={isInternal ? 'button' : 'link'} accessibilityLabel={section.body || section.url}>
                  <Icon name={isInternal ? 'article' : 'open-in-new'} size={22} color={Colors.yellow} />
                  <Text style={styles.linkCardText}>{section.body || section.url}</Text>
                  <Icon name="chevron-right" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              );
            default:
              return section.body ? <Text key={i} style={styles.text}>{section.body}</Text> : null;
          }
        })}
      </ScrollView>
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
    backgroundColor: Colors.background,
    gap: 12,
  },
  headerTitle: {color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5, flex: 1},
  yellowDivider: {height: 3, backgroundColor: Colors.yellow, marginHorizontal: 16, borderRadius: 2},
  text: {color: '#fff', fontSize: 15, lineHeight: 24, marginBottom: 16},
  heading: {color: Colors.yellow, fontSize: 17, fontWeight: '800', marginTop: 20, marginBottom: 10},
  image: {width: '100%', height: 200, borderRadius: 10, marginBottom: 14},
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 0,
    gap: 12,
  },
  linkCardText: {flex: 1, color: '#fff', fontSize: 15, fontWeight: '600'},
  callout: {backgroundColor: 'rgba(254,189,2,0.08)', borderLeftWidth: 3, borderLeftColor: Colors.yellow, borderRadius: 8, padding: 14, marginBottom: 16},
  calloutLabel: {color: Colors.yellow, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6},
  calloutText: {color: '#fff', fontSize: 14, lineHeight: 22},
});
