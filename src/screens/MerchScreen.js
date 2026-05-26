import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  StyleSheet,
  Linking,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {fetchDrivers, fetchMerchStores} from '../api/client';
import {parseGrid} from '../api/parsers';
import {Analytics} from '../utils/analytics';
import {useFocusEffect} from '@react-navigation/native';
import CachedImage from '../components/CachedImage';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 10) / 2;

function withTracking(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}utm_source=btcchub&utm_medium=app&utm_campaign=merch`;
}

function StorePickerModal({team, onClose}) {
  const sheetY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (team) {
      sheetY.setValue(400);
      Animated.spring(sheetY, {toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20}).start();
    }
  }, [team]);

  const open = (store) => {
    Analytics.merchStoreClicked(team.name, store.name);
    Linking.openURL(withTracking(store.url));
    onClose();
  };

  return (
    <Modal
      visible={!!team}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.sheet, {transform: [{translateY: sheetY}]}]}>
          <Pressable onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={2}>{team?.name}</Text>
            <Text style={styles.sheetSubtitle}>CHOOSE A STORE</Text>
            {(team?.stores || []).map((store, i) => (
              <TouchableOpacity
                key={i}
                style={styles.storeRow}
                activeOpacity={0.7}
                onPress={() => open(store)}
                accessibilityRole="link"
                accessibilityLabel={`Open ${store.name}`}>
                <Text style={styles.storeName}>{store.name}</Text>
                <Icon name="open-in-new" size={18} color={Colors.yellow} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default function MerchScreen({navigation}) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerTeam, setPickerTeam] = useState(null);
  const scrollRef = useRef(null);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({y: 0, animated: false});
  }, []));

  useEffect(() => { Analytics.screen('merch'); }, []);

  useEffect(() => {
    (async () => {
      try {
        const [raw, stores] = await Promise.all([fetchDrivers(), fetchMerchStores()]);
        const {teams: allTeams} = parseGrid(raw);
        setTeams(
          allTeams
            .filter(t => stores[t.name]?.length > 0)
            .map(t => ({...t, stores: stores[t.name]})),
        );
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleTilePress = (team) => {
    if (team.stores.length === 1) {
      Analytics.merchStoreClicked(team.name, team.stores[0].name);
      Linking.openURL(withTracking(team.stores[0].url));
    } else {
      setPickerTeam(team);
    }
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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{padding: 4}}
          accessibilityLabel="Go back"
          accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>TEAM MERCH</Text>
      </View>
      <View style={styles.yellowDivider} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>
          Shop official merchandise from your favourite BTCC teams.
        </Text>
        {teams.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Icon name="shopping-bag" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No merch stores available yet.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {teams.map(team => (
              <TouchableOpacity
                key={team.name}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => handleTilePress(team)}
                accessibilityLabel={`Shop ${team.name} merchandise`}
                accessibilityRole="button">
                <View style={styles.imageArea}>
                  {team.cardBgUrl ? (
                    <CachedImage
                      uri={team.cardBgThumbUrl || team.cardBgUrl}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, {backgroundColor: Colors.surface}]} />
                  )}
                  {team.carImageUrl ? (
                    <CachedImage
                      uri={team.carThumbUrl || team.carImageUrl}
                      style={styles.carImage}
                      resizeMode="contain"
                    />
                  ) : null}
                  <View style={styles.shopBadge}>
                    <Icon name="shopping-bag" size={11} color={Colors.navy} />
                    <Text style={styles.shopBadgeText}>
                      {team.stores.length > 1 ? `${team.stores.length} SHOPS` : 'SHOP'}
                    </Text>
                  </View>
                </View>
                <View style={styles.footer}>
                  <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
                  <Icon name={team.stores.length > 1 ? 'expand-more' : 'open-in-new'} size={14} color={Colors.textSecondary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <StorePickerModal team={pickerTeam} onClose={() => setPickerTeam(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  center: {flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center'},
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
  scrollContent: {padding: 16, paddingBottom: 30},
  intro: {color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 20, marginTop: 4},
  emptyWrap: {alignItems: 'center', marginTop: 60, gap: 12},
  emptyText: {color: Colors.textSecondary, fontSize: 14},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  card: {width: CARD_WIDTH, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.card},
  imageArea: {width: '100%', aspectRatio: 1, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center'},
  carImage: {width: '100%', height: '85%'},
  shopBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.yellow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  shopBadgeText: {color: Colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.5},
  footer: {padding: 10, flexDirection: 'row', alignItems: 'center', gap: 6},
  teamName: {color: '#fff', fontSize: 13, fontWeight: '800', flex: 1},
  // Modal
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  sheetHandle: {width: 36, height: 4, backgroundColor: Colors.outline, borderRadius: 2, alignSelf: 'center', marginBottom: 20},
  sheetTitle: {color: '#fff', fontSize: 17, fontWeight: '900', marginBottom: 4},
  sheetSubtitle: {color: Colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 16},
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.outline,
  },
  storeName: {flex: 1, color: '#fff', fontSize: 15, fontWeight: '600'},
  cancelBtn: {marginTop: 8, paddingVertical: 14, alignItems: 'center'},
  cancelText: {color: Colors.textSecondary, fontSize: 15, fontWeight: '600'},
});
