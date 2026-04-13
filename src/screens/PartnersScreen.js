import React from 'react';
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

const PARTNERS = [
  {
    id: 'kwik-fit',
    name: 'Kwik Fit',
    role: 'Title Sponsor',
    logo: 'https://btcc.net/wp-content/uploads/2024/03/Kwikfit.jpg',
    description: 'Kwik Fit has been the Title Sponsor of the BTCC since 2019. One of the UK\'s leading automotive retailers, with over 600 centres offering tyres, MOTs, and car servicing.',
    url: 'https://www.kwik-fit.com/',
  },
  {
    id: 'goodyear',
    name: 'Goodyear',
    role: 'Tyre Supplier',
    logo: 'https://btcc.net/wp-content/uploads/2024/03/Goodyear.jpg',
    description: 'Founded in 1898, Goodyear has been the exclusive tyre supplier to the BTCC since 2020. Their Dunlop brand supplied the championship from 2003–2019.',
    url: 'https://www.goodyear.eu/',
  },
  {
    id: 'liqui-moly',
    name: 'Liqui Moly',
    role: 'Oil & Lubricants Partner',
    logo: 'https://btcc.net/wp-content/uploads/2024/07/Liqui-Moly-Logo-RGB.png',
    description: 'German manufacturer specialising in motor oils, additives, and car care products. Official oil and lubricants partner of the BTCC since mid-2024.',
    url: 'https://www.liqui-moly.com/en/gb/',
  },
  {
    id: 'barc',
    name: 'BARC',
    role: 'British Automobile Racing Club',
    logo: 'https://btcc.net/wp-content/uploads/2024/03/BARC.jpg',
    description: 'The BARC is one of the UK\'s leading motorsport organisations, overseeing a wide range of racing events and providing official support to the championship.',
    url: 'http://barc.net/',
  },
  {
    id: 'motorsport-uk',
    name: 'Motorsport UK',
    role: 'Governing Body',
    logo: 'https://btcc.net/wp-content/uploads/2024/03/Motorsport-UK-logo.png',
    description: 'The governing body for four-wheel motorsport in the UK, promoting the development, safety, and sustainability of the sport at all levels.',
    url: 'https://www.motorsportuk.org/',
  },
  {
    id: 'autocar',
    name: 'Autocar',
    role: 'Media Partner',
    logo: 'https://btcc.net/wp-content/uploads/2024/03/Autocar_logo.png',
    description: 'The world\'s oldest car magazine, established in 1895. Autocar has been the BTCC\'s official media partner for over a decade.',
    url: 'http://autocar.co.uk/',
  },
  {
    id: 'dread',
    name: 'Dread',
    role: 'Official Merchandise',
    logo: 'https://btcc.net/wp-content/uploads/2024/03/Dread-1.jpg',
    description: 'UK-based supplier of premium race team clothing and motorsport merchandise, known for quality and durability.',
    url: 'https://shop.dread.cc/',
  },
  {
    id: 'alcosense',
    name: 'AlcoSense',
    role: 'Alcohol Testing Partner',
    logo: 'https://btcc.net/wp-content/uploads/2024/03/Alcosense-Logo-scaled.jpeg',
    description: 'Official alcohol testing partner since 2014, making the BTCC the first major racing series to introduce mandatory driver breathalyser testing.',
    url: 'http://alcosense.co.uk/',
  },
];

export default function PartnersScreen({navigation}) {
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
        data={PARTNERS}
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
