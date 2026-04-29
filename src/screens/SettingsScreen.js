import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Clipboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {useUnits} from '../store/units';
import {useSettings} from '../store/settings';
import {useFeatureFlags} from '../store/featureFlags';
import {Analytics} from '../utils/analytics';
import {version} from '../../package.json';
import {getFCMToken} from '../utils/notifications';
import {navigateFromData} from '../utils/notifNavigation';
import {navigationRef} from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getStableDeviceId} from '../utils/deviceId';

export default function SettingsScreen({navigation}) {
  const {settings, setSetting} = useSettings();
  const {useKm, toggleUnits} = useUnits();
  const {podcasts_enabled, debug_mode} = useFeatureFlags();
  const [fcmToken, setFcmToken] = useState('');
  const [copiedFcm, setCopiedFcm] = useState(false);
  const [stableId, setStableId] = useState('');
  const [copiedStableId, setCopiedStableId] = useState(false);

  useEffect(() => {
    getFCMToken().then(tok => { if (tok) setFcmToken(tok); }).catch(() => {});
    getStableDeviceId().then(id => { if (id) setStableId(id); }).catch(() => {});
  }, []);

  const copyStableId = () => {
    if (!stableId) return;
    Clipboard.setString(stableId);
    setCopiedStableId(true);
    setTimeout(() => setCopiedStableId(false), 2000);
  };

  const copyFcmToken = () => {
    if (!fcmToken) return;
    Clipboard.setString(fcmToken);
    setCopiedFcm(true);
    setTimeout(() => setCopiedFcm(false), 2000);
  };

  useEffect(() => { Analytics.screen('settings'); }, []);

  const toggle = (key) => (v) => {
    Analytics.notificationTypeToggled(key, v);
    setSetting(key, v);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTINGS</Text>
      </View>
      <ScrollView contentContainerStyle={{padding: 16}}>
        <Text style={styles.sectionTitle}>SPOILER-FREE MODE</Text>
        <SettingRow
          label="No Spoilers"
          description="Pauses result notifications until you open the app or Monday night"
          value={settings.spoilerFree}
          onToggle={toggle('spoilerFree')}
        />
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

        <SettingRow
          label="News alerts"
          description="Get notified when a new BTCC article is published"
          value={settings.newsAlerts}
          onToggle={toggle('newsAlerts')}
        />
        {podcasts_enabled && (
          <SettingRow
            label="Podcast alerts"
            description="Get notified when a new BTCC podcast or interview is released"
            value={settings.podcastAlerts}
            onToggle={toggle('podcastAlerts')}
          />
        )}

        <SettingRow
          label="Race weekend preview"
          description="Friday reminder before each race weekend"
          value={settings.weekendPreview}
          onToggle={toggle('weekendPreview')}
        />

        {/* ── Pre-race ── */}
        <GroupRow
          label="Pre-race alerts"
          description="Notifications before each session starts"
          value={settings.preRace}
          onToggle={toggle('preRace')}
        />
        <SubRow
          label="Free Practice"
          accessibilityLabel="Pre-race Free Practice"
          value={settings.preRaceFP}
          onToggle={toggle('preRaceFP')}
          parentEnabled={settings.preRace}
        />
        <SubRow
          label="Qualifying"
          accessibilityLabel="Pre-race Qualifying"
          value={settings.preRaceQualifying}
          onToggle={toggle('preRaceQualifying')}
          parentEnabled={settings.preRace}
        />
        <SubRow
          label="Qualifying Race"
          accessibilityLabel="Pre-race Qualifying Race"
          value={settings.preRaceQRace}
          onToggle={toggle('preRaceQRace')}
          parentEnabled={settings.preRace}
        />
        <SubGroupRow
          label="Race"
          accessibilityLabel="Pre-race Race"
          value={settings.preRaceRace}
          onToggle={toggle('preRaceRace')}
          parentEnabled={settings.preRace}
        />
        <SubSubRow
          label="Race 1"
          accessibilityLabel="Pre-race Race 1"
          value={settings.preRaceRace1}
          onToggle={toggle('preRaceRace1')}
          parentEnabled={settings.preRace && settings.preRaceRace}
        />
        <SubSubRow
          label="Race 2"
          accessibilityLabel="Pre-race Race 2"
          value={settings.preRaceRace2}
          onToggle={toggle('preRaceRace2')}
          parentEnabled={settings.preRace && settings.preRaceRace}
        />
        <SubSubRow
          label="Race 3"
          accessibilityLabel="Pre-race Race 3"
          value={settings.preRaceRace3}
          onToggle={toggle('preRaceRace3')}
          parentEnabled={settings.preRace && settings.preRaceRace}
        />

        {/* ── Results ── */}
        <GroupRow
          label="Results alerts"
          description="Notifications when session results are published"
          value={settings.results}
          onToggle={toggle('results')}
        />
        <SubRow
          label="Free Practice"
          accessibilityLabel="Results Free Practice"
          value={settings.resultsFP}
          onToggle={toggle('resultsFP')}
          parentEnabled={settings.results}
        />
        <SubRow
          label="Qualifying"
          accessibilityLabel="Results Qualifying"
          value={settings.resultsQualifying}
          onToggle={toggle('resultsQualifying')}
          parentEnabled={settings.results}
        />
        <SubRow
          label="Qualifying Race"
          accessibilityLabel="Results Qualifying Race"
          value={settings.resultsQRace}
          onToggle={toggle('resultsQRace')}
          parentEnabled={settings.results}
        />
        <SubGroupRow
          label="Race"
          accessibilityLabel="Results Race"
          value={settings.resultsRace}
          onToggle={toggle('resultsRace')}
          parentEnabled={settings.results}
        />
        <SubSubRow
          label="Race 1"
          accessibilityLabel="Results Race 1"
          value={settings.resultsRace1}
          onToggle={toggle('resultsRace1')}
          parentEnabled={settings.results && settings.resultsRace}
        />
        <SubSubRow
          label="Race 2"
          accessibilityLabel="Results Race 2"
          value={settings.resultsRace2}
          onToggle={toggle('resultsRace2')}
          parentEnabled={settings.results && settings.resultsRace}
        />
        <SubSubRow
          label="Race 3"
          accessibilityLabel="Results Race 3"
          value={settings.resultsRace3}
          onToggle={toggle('resultsRace3')}
          parentEnabled={settings.results && settings.resultsRace}
        />

        <View style={styles.divider} />
        <SettingRow
          label="Standings update"
          description="Tuesday reminder to check standings after each round"
          value={settings.standingsUpdate}
          onToggle={toggle('standingsUpdate')}
        />

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>UNIT DISPLAY</Text>

        <View style={styles.settingRow}>
          <View style={{flex: 1}}>
            <Text style={styles.settingLabel}>Distance</Text>
            <Text style={styles.settingDesc}>Unit used for circuit distances</Text>
          </View>
          <View style={styles.pillRow}>
            <TouchableOpacity
              style={[styles.pill, useKm && styles.pillActive]}
              onPress={() => { Analytics.unitSystemChanged('km'); toggleUnits(true); }}
              accessibilityRole="button"
              accessibilityLabel="Switch to km">
              <Text style={[styles.pillText, useKm && styles.pillTextActive]}>km</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, !useKm && styles.pillActive]}
              onPress={() => { Analytics.unitSystemChanged('miles'); toggleUnits(false); }}
              accessibilityRole="button"
              accessibilityLabel="Switch to miles">
              <Text style={[styles.pillText, !useKm && styles.pillTextActive]}>miles</Text>
            </TouchableOpacity>
          </View>
        </View>

        {debug_mode && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>DEBUG</Text>
            <SettingRow
              label="Hub news preview"
              description="Load posts from hub_news_draft.json instead of live"
              value={settings.hubPreview}
              onToggle={(v) => setSetting('hubPreview', v)}
            />
            <Text style={[styles.settingDesc, {marginTop: 12, marginBottom: 8}]}>Deep-link tests</Text>
            {[
              {label: 'Podcast', data: {type: 'podcast'}},
              {label: 'News', data: {type: 'news', slug: 'btcc-2026-season-preview'}},
              {label: 'Round 1', data: {type: 'round', round: '1'}},
              {label: 'Results R1', data: {type: 'results', round: '1', year: '2026'}},
            ].map(({label, data}) => (
              <TouchableOpacity key={label} style={styles.debugBtn} onPress={() => navigateFromData(navigationRef, data)}>
                <Text style={styles.debugBtnText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={styles.divider} />
        <Text style={styles.versionText}>Version {version}</Text>
        {!!stableId && (
          <TouchableOpacity onPress={copyStableId} accessibilityRole="button" accessibilityLabel="Copy preview device ID">
            <Text style={styles.deviceIdText}>{copiedStableId ? '✓ Copied' : `Preview ID: ${stableId.slice(0, 16)}…`}</Text>
          </TouchableOpacity>
        )}
        {!!fcmToken && (
          <TouchableOpacity onPress={copyFcmToken} accessibilityRole="button" accessibilityLabel="Copy device token">
            <Text style={styles.deviceIdText}>{copiedFcm ? '✓ Copied' : `Device Token: ${fcmToken.slice(0, 20)}…`}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ── Components ────────────────────────────────────────────────────

function SettingRow({label, description, value, onToggle}) {
  return (
    <View style={styles.settingRow}>
      <View style={{flex: 1}}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description ? <Text style={styles.settingDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{false: Colors.outline, true: Colors.yellow}}
        thumbColor="#fff"
        accessibilityLabel={label}
        accessibilityRole="switch"
      />
    </View>
  );
}

// Parent group header with its own toggle
function GroupRow({label, description, value, onToggle}) {
  return (
    <View style={[styles.settingRow, styles.groupRow]}>
      <View style={{flex: 1}}>
        <Text style={styles.groupLabel}>{label}</Text>
        {description ? <Text style={styles.settingDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{false: Colors.outline, true: Colors.yellow}}
        thumbColor="#fff"
        accessibilityLabel={label}
        accessibilityRole="switch"
      />
    </View>
  );
}

// First-level child (indented once)
function SubRow({label, accessibilityLabel, value, onToggle, parentEnabled}) {
  const dimmed = !parentEnabled;
  return (
    <View style={[styles.settingRow, styles.subRow]}>
      <View style={styles.subIndent} />
      <Text style={[styles.subLabel, dimmed && styles.dimmed]}>{label}</Text>
      <Switch
        value={parentEnabled && value}
        onValueChange={onToggle}
        disabled={dimmed}
        trackColor={{false: Colors.outline, true: Colors.yellow}}
        thumbColor="#fff"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityRole="switch"
      />
    </View>
  );
}

// Second-level parent (e.g. "Race" within Pre-race)
function SubGroupRow({label, accessibilityLabel, value, onToggle, parentEnabled}) {
  const dimmed = !parentEnabled;
  return (
    <View style={[styles.settingRow, styles.subRow]}>
      <View style={styles.subIndent} />
      <Text style={[styles.subGroupLabel, dimmed && styles.dimmed]}>{label}</Text>
      <Switch
        value={parentEnabled && value}
        onValueChange={onToggle}
        disabled={dimmed}
        trackColor={{false: Colors.outline, true: Colors.yellow}}
        thumbColor="#fff"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityRole="switch"
      />
    </View>
  );
}

// Second-level child (indented twice, e.g. Race 1/2/3)
function SubSubRow({label, accessibilityLabel, value, onToggle, parentEnabled}) {
  const dimmed = !parentEnabled;
  return (
    <View style={[styles.settingRow, styles.subSubRow]}>
      <View style={styles.subSubIndent} />
      <Text style={[styles.subLabel, dimmed && styles.dimmed]}>{label}</Text>
      <Switch
        value={parentEnabled && value}
        onValueChange={onToggle}
        disabled={dimmed}
        trackColor={{false: Colors.outline, true: Colors.yellow}}
        thumbColor="#fff"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityRole="switch"
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
    paddingBottom: 8,
    backgroundColor: Colors.background,
    gap: 12,
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1},
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  groupRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.outline,
    paddingTop: 14,
  },
  groupLabel: {color: '#fff', fontSize: 15, fontWeight: '700'},
  subRow: {paddingVertical: 7},
  subSubRow: {paddingVertical: 7},
  subIndent: {width: 20, height: 1},
  subSubIndent: {width: 40, height: 1},
  subLabel: {flex: 1, color: Colors.textSecondary, fontSize: 14, fontWeight: '500'},
  subGroupLabel: {flex: 1, color: '#fff', fontSize: 14, fontWeight: '600'},
  dimmed: {opacity: 0.35},
  settingLabel: {color: '#fff', fontSize: 15, fontWeight: '600'},
  settingDesc: {color: Colors.textSecondary, fontSize: 12, marginTop: 2},
  divider: {height: 1, backgroundColor: Colors.outline, marginVertical: 20},
  pillRow: {flexDirection: 'row', gap: 4},
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  pillActive: {backgroundColor: Colors.yellow},
  pillText: {color: Colors.textSecondary, fontSize: 13, fontWeight: '700'},
  pillTextActive: {color: Colors.navy},
  versionText: {color: Colors.textSecondary, fontSize: 12, marginTop: 12},
  deviceIdText: {color: Colors.textSecondary, fontSize: 11, fontFamily: 'monospace', marginTop: 4},
  debugBtn: {paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.surface, borderRadius: 8, marginBottom: 8, alignSelf: 'flex-start'},
  debugBtnText: {color: Colors.yellow, fontSize: 13, fontWeight: '600'},
  tokenRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12},
  tokenText: {color: Colors.textSecondary, fontSize: 11, fontFamily: 'monospace', marginTop: 2},
});
