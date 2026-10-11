import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Modal, Pressable} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';

// Renders a session's growing set of supplementary data panels (Speed Trap,
// Perfect Lap, Conditions, Leaderboard - the same shape of addition covers
// whatever ships next) one "page" at a time, switched via a title-with-
// arrows paginator rather than a row of tabs. A pill row grew to 4 entries
// and stopped fitting a phone screen (confirmed live); a horizontally
// scrollable pill row fixed reachability, but the user preferred a design
// that shows what's available without a scroll/swipe gesture first. Each
// entry in `tabs` is {key, label, hasData, render, group?}: only entries
// with real data are considered, `render` is called lazily (only for
// whichever entry is active). With one available panel it renders directly
// with no paginator chrome at all - arrows with nowhere to go have nothing
// to show. The optional `group` renders as a small label above the title
// (e.g. "SPEED TRAP" above "Intermediate 2") for a set of tabs that are
// siblings under one parent concept - added when a bare "Intermediate 2"
// title read as ungrouped and disconnected from "Speed Trap" on its own.
// Deliberately NOT folded into `label` itself ("Speed Trap - Intermediate
// 2"): `pagerTitle` has no width cap and this exact header has already
// hit real overflow bugs at larger accessibility font scales (see the
// 09-11 tab-bar/StatBox findings) - a standalone two-line eyebrow stays
// short on each line instead of nearly doubling the single title's length.
//
// `activeKey`/`onActiveKeyChange` make this a controlled component when
// BOTH are passed together - RoundResultsScreen does this, so the same
// data type (e.g. "Perfect Lap") stays selected across every race's own
// SessionAnalysisTabs instance as the user swipes FP/QUAL/Q RACE/R1/R2/R3,
// per the user's explicit ask: "switching between races, you remain on the
// same type of data." Falls back to its own internal state when either is
// omitted, so the component still works standalone - both the read (which
// panel shows) and write (what a press does) sides key off the exact same
// `isControlled` check, deliberately, so passing only one of the two props
// can't leave read and write disagreeing about which mode is active (a
// half-controlled instance would otherwise look like its arrows do
// nothing, since one side moves state the other side never reads). If the
// controlled `activeKey` isn't among THIS session's own available tabs
// (e.g. "Perfect Lap" remembered from Race 1, but Free Practice hasn't
// been scraped for it yet), it renders the first available tab instead
// without touching the parent's remembered key - so a later session that
// does have that data type still resumes there rather than the fallback
// becoming sticky.
//
// With 10 data types the arrows alone became a long walk with no sense of
// what's ahead, so the title is also a button: it opens a grid of every
// available data type (no scrolling - the same "see what's reachable at a
// glance" reason the pill row was dropped) to jump straight to one, and a
// row of position dots under the title shows where you are. Each tab may
// carry an `icon` (MaterialIcons name) for that grid.
export default function SessionAnalysisTabs({tabs, roundNumber, session, activeKey: controlledKey, onActiveKeyChange}) {
  const available = tabs.filter(t => t.hasData);
  const [internalKey, setInternalKey] = useState(available[0]?.key);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!available.length) return null;
  if (available.length === 1) return available[0].render();

  const isControlled = controlledKey != null && onActiveKeyChange != null;
  const activeKey = isControlled ? controlledKey : internalKey;
  const activeIndex = Math.max(0, available.findIndex(t => t.key === activeKey));
  const active = available[activeIndex];

  const goTo = (index, source = 'arrow') => {
    const target = available[index];
    if (!target) return;
    if (isControlled) onActiveKeyChange(target.key);
    else setInternalKey(target.key);
    Analytics.sessionAnalysisTabChanged(roundNumber, session, target.key, source);
  };

  const openMenu = () => {
    setMenuOpen(true);
    Analytics.sessionAnalysisMenuOpened(roundNumber, session, available.length);
  };

  const pick = (index) => {
    setMenuOpen(false);
    if (index !== activeIndex) goTo(index, 'menu');
  };

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < available.length - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.pagerRow}>
        <TouchableOpacity
          onPress={() => goTo(activeIndex - 1)}
          disabled={!canGoPrev}
          style={[styles.arrowBtn, !canGoPrev && styles.arrowBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Previous data type"
          accessibilityState={{disabled: !canGoPrev}}>
          <Icon name="chevron-left" size={24} color={canGoPrev ? Colors.yellow : Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pagerTitleWrap}
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={`${active.group ? `${active.group} ` : ''}${active.label}, ${activeIndex + 1} of ${available.length}. Show all data types`}>
          {active.group && <Text style={styles.pagerEyebrow}>{active.group}</Text>}
          <View style={styles.pagerTitleRow}>
            <Text style={styles.pagerTitle}>{active.label}</Text>
            <Icon name="expand-more" size={18} color={Colors.yellow} />
          </View>
          <View style={styles.dots}>
            {available.map((t, i) => (
              <View key={t.key} style={[styles.dot, i === activeIndex && styles.dotActive]} />
            ))}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => goTo(activeIndex + 1)}
          disabled={!canGoNext}
          style={[styles.arrowBtn, !canGoNext && styles.arrowBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Next data type"
          accessibilityState={{disabled: !canGoNext}}>
          <Icon name="chevron-right" size={24} color={canGoNext ? Colors.yellow : Colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {active.render()}
      <Modal visible={menuOpen} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Close data types">
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{session ? session.toUpperCase() : 'DATA'}</Text>
            <View style={styles.grid}>
              {available.map((t, i) => {
                const on = i === activeIndex;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.tile, on && styles.tileActive]}
                    onPress={() => pick(i)}
                    accessibilityRole="button"
                    accessibilityState={{selected: on}}
                    accessibilityLabel={`${t.group ? `${t.group} ` : ''}${t.label}`}>
                    <Icon name={t.icon || 'insights'} size={22} color={on ? Colors.navy : Colors.yellow} />
                    {t.group && <Text style={[styles.tileEyebrow, on && styles.tileTextActive]} numberOfLines={1}>{t.group}</Text>}
                    <Text style={[styles.tileLabel, on && styles.tileTextActive]} numberOfLines={2}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {marginTop: 4},
  pagerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 8},
  arrowBtn: {padding: 6},
  // Colour alone (Colors.textSecondary vs Colors.yellow) was confirmed too
  // low-contrast on its own for a disabled state - matches this screen's
  // own reversal-count stepper (styles.stepperBtnDisabled), which pairs a
  // dimmer icon colour with opacity for a clearer double signal.
  arrowBtnDisabled: {opacity: 0.4},
  // A fixed minWidth keeps the arrows roughly in place as the title text
  // changes length between data types ("Leaderboard" vs "Conditions"),
  // rather than the whole row visibly shifting width on every page change.
  pagerTitleWrap: {minWidth: 150, alignItems: 'center', paddingVertical: 2},
  pagerTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 2},
  dots: {flexDirection: 'row', gap: 4, marginTop: 5},
  dot: {width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.outline},
  dotActive: {width: 14, backgroundColor: Colors.yellow},
  backdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: Colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28},
  sheetTitle: {color: Colors.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  tile: {
    width: '31.5%', minHeight: 84, borderRadius: 12, padding: 10,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.outline, justifyContent: 'center', gap: 4,
  },
  tileActive: {backgroundColor: Colors.yellow, borderColor: Colors.yellow},
  tileEyebrow: {color: Colors.textSecondary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8},
  tileLabel: {color: '#fff', fontSize: 12.5, fontWeight: '800'},
  tileTextActive: {color: Colors.navy},
  pagerEyebrow: {color: Colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 2},
  pagerTitle: {color: Colors.yellow, fontSize: 14, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center'},
});
