import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
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
export default function SessionAnalysisTabs({tabs, roundNumber, session, activeKey: controlledKey, onActiveKeyChange}) {
  const available = tabs.filter(t => t.hasData);
  const [internalKey, setInternalKey] = useState(available[0]?.key);

  if (!available.length) return null;
  if (available.length === 1) return available[0].render();

  const isControlled = controlledKey != null && onActiveKeyChange != null;
  const activeKey = isControlled ? controlledKey : internalKey;
  const activeIndex = Math.max(0, available.findIndex(t => t.key === activeKey));
  const active = available[activeIndex];

  const goTo = (index) => {
    const target = available[index];
    if (!target) return;
    if (isControlled) onActiveKeyChange(target.key);
    else setInternalKey(target.key);
    Analytics.sessionAnalysisTabChanged(roundNumber, session, target.key);
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
        <View style={styles.pagerTitleWrap}>
          {active.group && <Text style={styles.pagerEyebrow}>{active.group}</Text>}
          <Text style={styles.pagerTitle}>{active.label}</Text>
        </View>
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
  pagerTitleWrap: {minWidth: 130, alignItems: 'center'},
  pagerEyebrow: {color: Colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 2},
  pagerTitle: {color: Colors.yellow, fontSize: 14, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center'},
});
