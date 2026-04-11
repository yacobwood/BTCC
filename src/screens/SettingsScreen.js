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
import {getFCMToken} from '../utils/notifications';

export default function SettingsScreen({navigation}) {
  const {settings, setSetting} = useSettings();
  const {useKm, toggleUnits} = useUnits();
  const {podcasts_enabled} = useFeatureFlags();
  const [fcmToken, setFcmToken] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getFCMToken().then(t => { if (t) setFcmToken(t); });
  }, []);

  const copyToken = () => {
    if (!fcmToken) return;
    Clipboard.setString(fcmToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => { Analytics.screen('settings'); }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTINGS</Text>
      </View>
      <ScrollView contentContainerStyle={{padding: 16}}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

        <SettingRow
          label="News alerts"
          description="Get notified when a new BTCC article is published"
          value={settings.newsAlerts}
          onToggle={(v) => { Analytics.notificationTypeToggled('newsAlerts', v); setSetting('newsAlerts', v); }}
        />
        <SettingRow
          label="Race alerts"
          description="Get notified when a race session is about to start"
          value={settings.raceAlerts}
          onToggle={(v) => { Analytics.notificationTypeToggled('raceAlerts', v); setSetting('raceAlerts', v); }}
        />
        <SettingRow
          label="Qualifying alerts"
          description="Get notified when qualifying is about to start"
          value={settings.qualifyingAlerts}
          onToggle={(v) => { Analytics.notificationTypeToggled('qualifyingAlerts', v); setSetting('qualifyingAlerts', v); }}
        />
        <SettingRow
          label="Free practice alerts"
          description="Get notified when free practice is about to start"
          value={settings.fpAlerts}
          onToggle={(v) => { Analytics.notificationTypeToggled('fpAlerts', v); setSetting('fpAlerts', v); }}
        />
        <SettingRow
          label="Results alerts"
          description="Get notified when new round results are published"
          value={settings.resultsAlerts}
          onToggle={(v) => { Analytics.notificationTypeToggled('resultsAlerts', v); setSetting('resultsAlerts', v); }}
        />
        <SettingRow
          label="Race weekend preview"
          description="Friday reminder before each race weekend"
          value={settings.weekendPreview}
          onToggle={(v) => { Analytics.notificationTypeToggled('weekendPreview', v); setSetting('weekendPreview', v); }}
        />
        <SettingRow
          label="Standings update"
          description="Tuesday reminder to check standings after each round"
          value={settings.standingsUpdate}
          onToggle={(v) => { Analytics.notificationTypeToggled('standingsUpdate', v); setSetting('standingsUpdate', v); }}
        />
        {podcasts_enabled && (
          <SettingRow
            label="Podcast alerts"
            description="Get notified when a new BTCC podcast or interview is released"
            value={settings.podcastAlerts}
            onToggle={(v) => { Analytics.notificationTypeToggled('podcastAlerts', v); setSetting('podcastAlerts', v); }}
          />
        )}

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

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>DEBUG</Text>
        <TouchableOpacity style={styles.tokenRow} onPress={copyToken} accessibilityRole="button" accessibilityLabel="Copy device token">
          <View style={{flex: 1}}>
            <Text style={styles.settingLabel}>Device Token</Text>
            <Text style={styles.tokenText} numberOfLines={1}>{fcmToken || 'Loading…'}</Text>
          </View>
          <Icon name={copied ? 'check' : 'content-copy'} size={18} color={copied ? Colors.yellow : Colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.versionText}>Version 2.0.0</Text>
      </ScrollView>
    </View>
  );
}

function SettingRow({label, description, value, onToggle}) {
  return (
    <View style={styles.settingRow}>
      <View style={{flex: 1}}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
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
    paddingVertical: 12,
  },
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
  tokenRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12},
  tokenText: {color: Colors.textSecondary, fontSize: 11, fontFamily: 'monospace', marginTop: 2},
});
