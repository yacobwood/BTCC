import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';
import {useRadio} from '../store/radio';

export default function RadioScreen({navigation}) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const {currentStation, isPlaying, play, stop} = useRadio();

  useEffect(() => {
    Analytics.screen('radio');
    (async () => {
      try {
        const res = await fetch('https://raw.githubusercontent.com/yacobwood/BTCC/main/data/radio.json');
        const data = await res.json();
        setStations((data.stations || []).map(s => ({
          name: s.name || '', tagline: s.tagline || '', streamUrl: s.streamUrl || '', coverage: s.coverage || '',
        })));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const toggleStation = (station) => {
    if (currentStation === station.name && isPlaying) {
      Analytics.navItemClicked('radio_stop:' + station.name);
      stop();
    } else {
      Analytics.navItemClicked('radio_play:' + station.name);
      play(station);
    }
  };

  const renderStation = ({item}) => {
    const active = currentStation === item.name && isPlaying;
    return (
      <TouchableOpacity
        style={[styles.stationCard, active && styles.stationActive]}
        onPress={() => toggleStation(item)}
        accessibilityLabel={`${active ? 'Stop' : 'Play'} ${item.name}`}
        accessibilityRole="button">
        <View style={[styles.playBtn, active && {backgroundColor: Colors.yellow}]}>
          <Icon name={active ? 'stop' : 'play-arrow'} size={24} color={active ? Colors.navy : '#fff'} />
        </View>
        <View style={{flex: 1}}>
          <Text style={[styles.stationName, active && {color: Colors.yellow}]}>{item.name}</Text>
          <Text style={styles.stationTagline}>{item.tagline}</Text>
          {item.coverage ? <Text style={styles.stationCoverage}>{item.coverage}</Text> : null}
        </View>
        {active && <View style={styles.liveDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>RADIO</Text>
        {isPlaying && (
          <TouchableOpacity onPress={stop} style={styles.stopAllBtn} accessibilityLabel="Stop radio" accessibilityRole="button">
            <Icon name="stop" size={18} color={Colors.navy} />
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.yellow} size="large" /></View>
      ) : (
        <FlatList
          data={stations}
          keyExtractor={item => item.name}
          renderItem={renderStation}
          contentContainerStyle={{padding: 16, paddingBottom: 20}}
          ListEmptyComponent={<Text style={styles.emptyText}>No stations available</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  header: {flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, gap: 12},
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1, flex: 1},
  stopAllBtn: {width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.yellow, justifyContent: 'center', alignItems: 'center'},
  stationCard: {flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 10, gap: 12},
  stationActive: {borderWidth: 1, borderColor: Colors.yellow},
  playBtn: {width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center'},
  stationName: {color: '#fff', fontSize: 15, fontWeight: '700'},
  stationTagline: {color: Colors.textSecondary, fontSize: 12, marginTop: 2},
  stationCoverage: {color: Colors.textSecondary, fontSize: 11, marginTop: 2},
  liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.yellow},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40},
});
