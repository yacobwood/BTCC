import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';

// Renders a session's growing set of supplementary data panels (Speed Trap
// today; Weather, Perfect Lap, Position Chart etc. are the same shape of
// addition later) without the footer just getting longer per panel. Each
// entry in `tabs` is {key, label, hasData, render}: only entries with real
// data are considered, `render` is called lazily (only for whichever tab is
// selected). With one available panel it renders directly, no tab chrome -
// a tab bar with a single, always-selected pill has nothing to select.
export default function SessionAnalysisTabs({tabs, roundNumber, session}) {
  const available = tabs.filter(t => t.hasData);
  const [activeKey, setActiveKey] = useState(available[0]?.key);

  if (!available.length) return null;
  if (available.length === 1) return available[0].render();

  const active = available.find(t => t.key === activeKey) || available[0];

  const selectTab = (key) => {
    setActiveKey(key);
    Analytics.sessionAnalysisTabChanged(roundNumber, session, key);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.tabRow}>
        {available.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.pill, t.key === active.key && styles.pillActive]}
            onPress={() => selectTab(t.key)}
            accessibilityRole="tab"
            accessibilityLabel={`${t.label} tab`}
            accessibilityState={{selected: t.key === active.key}}>
            <Text style={[styles.pillText, t.key === active.key && styles.pillTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {active.render()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {marginTop: 4},
  tabRow: {flexDirection: 'row', gap: 8, marginBottom: 8},
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  pillActive: {
    backgroundColor: Colors.yellow,
    borderColor: Colors.yellow,
  },
  pillText: {color: Colors.textSecondary, fontSize: 13, fontWeight: '700'},
  pillTextActive: {color: Colors.navy},
});
