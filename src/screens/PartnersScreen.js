import React, {useEffect, useState} from 'react';
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
import {fetchPartners} from '../api/client';

const BUNDLED_PARTNERS = require('../../data/partners.json');

export default function PartnersScreen({navigation}) {
  // Bundled snapshot renders instantly; a live fetch swaps it in only if it
  // actually returns something, so a sponsor change updates without needing
  // an app release, and a cold/offline fetch never leaves the screen blank.
  const [partners, setPartners] = useState(BUNDLED_PARTNERS);

  useEffect(() => { Analytics.screen('partners'); }, []);
  useEffect(() => {
    fetchPartners().then(data => { if (Array.isArray(data) && data.length) setPartners(data); }).catch(() => {});
  }, []);

  const renderPartner = ({item}) => (
    <View style={styles.card}>
      <View style={styles.logoWrap}>
        <Image source={{uri: item.logo}} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.body}>
        <Text style={styles.role}>{item.role.toUpperCase()}</Text>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.description}>{item.description}</Text>
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => { Analytics.moreItemClicked('partner_link:' + item.id); Linking.openURL(item.url); }}
          accessibilityRole="link"
          accessibilityLabel={`Visit ${item.name} website`}>
          <Icon name="open-in-new" size={14} color={Colors.navy} />
          <Text style={styles.linkText}>Visit website</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PARTNERS & SPONSORS</Text>
      </View>
      <View style={styles.yellowDivider} />
      <FlatList
        data={partners}
        keyExtractor={item => item.id}
        renderItem={renderPartner}
        contentContainerStyle={{padding: 16, paddingBottom: 30}}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <Text style={styles.intro}>
            The BTCC is supported by a range of partners and sponsors whose backing makes the championship possible.
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
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: 'hidden',
  },
  logoWrap: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 110,
  },
  logo: {width: '70%', height: '100%'},
  body: {padding: 16},
  role: {color: Colors.yellow, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4},
  name: {color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 8},
  description: {color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 14},
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.yellow,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  linkText: {color: Colors.navy, fontSize: 13, fontWeight: '700'},
  separator: {height: 12},
});
