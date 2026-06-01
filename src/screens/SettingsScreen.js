import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Clipboard,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {useUnits} from '../store/units';
import {useSettings} from '../store/settings';
import {useFeatureFlags} from '../store/featureFlags';
import {useBroadcaster} from '../utils/broadcaster';
import {Analytics} from '../utils/analytics';
import {version} from '../../package.json';
import {getFCMToken} from '../utils/notifications';
import {navigateFromData} from '../utils/notifNavigation';
import {navigationRef} from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '../store/auth';

export default function SettingsScreen({navigation}) {
  const {settings, setSetting} = useSettings();
  const {useKm, toggleUnits} = useUnits();
  const {podcasts_enabled, debug_mode, live_chat, broadcaster_override} = useFeatureFlags();
  const detectedBroadcaster = useBroadcaster();
  const {user, isAnonymous, providerIds, sendMagicLink, signOut} = useAuth();
  const [fcmToken, setFcmToken] = useState('');
  const [copiedFcm, setCopiedFcm] = useState(false);
  const [copiedStableId, setCopiedStableId] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSent, setAuthSent] = useState(false);

  useEffect(() => {
    getFCMToken().then(tok => { if (tok) setFcmToken(tok); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAnonymous && authModalVisible) {
      setAuthModalVisible(false);
      setAuthSent(false);
    }
  }, [isAnonymous]);

  const copyStableId = () => {
    if (!user?.uid) return;
    Clipboard.setString(user.uid);
    setCopiedStableId(true);
    setTimeout(() => setCopiedStableId(false), 2000);
  };

  const openAuthModal = () => {
    setAuthEmail('');
    setAuthError('');
    setAuthSent(false);
    setAuthModalVisible(true);
    Analytics.signInModalOpened();
  };

  const handleSendMagicLink = async () => {
    if (!authEmail.trim()) {
      setAuthError('Please enter your email address.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    Analytics.magicLinkRequested();
    try {
      await sendMagicLink(authEmail.trim());
      setAuthSent(true);
      Analytics.magicLinkSent();
    } catch (e) {
      const code = e?.code;
      Analytics.magicLinkFailed(code);
      if (code === 'auth/invalid-email') {
        setAuthError("That doesn't look like a valid email address.");
      } else if (code === 'auth/network-request-failed') {
        setAuthError('Check your internet connection and try again.');
      } else {
        setAuthError('Something went wrong. Please try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Your preferences are saved. You will be signed in anonymously until you link an account again.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Sign out', style: 'destructive', onPress: () => { Analytics.signedOut(); signOut().catch(() => {}); }},
      ],
    );
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
        <SettingRow
          label="Monday Roundup"
          description="Get notified when a new BTCC Monday Roundup drops"
          value={settings.digestAlerts}
          onToggle={toggle('digestAlerts')}
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

        {live_chat && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>LIVE CHAT</Text>
            <SettingRow
              label="Chat button"
              description="Show the floating chat button on all screens"
              value={settings.chatFab}
              onToggle={(v) => setSetting('chatFab', v)}
            />
          </>
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
            <Text style={[styles.settingDesc, {marginTop: 12, marginBottom: 4}]}>Broadcaster detection</Text>
            <Text style={styles.deviceIdText}>
              Detected: {detectedBroadcaster || 'unknown'}
            </Text>
            <Text style={styles.deviceIdText}>
              Active: {broadcaster_override ? `${broadcaster_override} (override)` : `${detectedBroadcaster} (auto)`}
            </Text>
          </>
        )}

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        {isAnonymous ? (
          <>
            <Text style={styles.settingDesc}>Keeps your favourite driver(s), notification settings and chat username in sync across every device you use.</Text>
            <TouchableOpacity style={[styles.authBtn, {marginTop: 12}]} onPress={openAuthModal} accessibilityRole="button">
              <Icon name="login" size={16} color={Colors.yellow} />
              <Text style={styles.authBtnText}>Register or Log in</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
            <View>
              <Text style={styles.settingLabel}>{user?.email || user?.displayName || 'Linked account'}</Text>
              <Text style={styles.settingDesc}>{providerIds.filter(p => p !== 'firebase').join(', ')}</Text>
            </View>
            <TouchableOpacity onPress={handleSignOut} accessibilityRole="button">
              <Text style={[styles.settingDesc, {color: Colors.yellow}]}>Sign out</Text>
            </TouchableOpacity>
          </View>
        )}

        <Modal
          visible={authModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAuthModalVisible(false)}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setAuthModalVisible(false)} />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {authSent ? 'Check your inbox' : 'Sign in'}
                </Text>
                <Pressable onPress={() => setAuthModalVisible(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
                  <Icon name="close" size={22} color={Colors.textSecondary} />
                </Pressable>
              </View>
              {authSent ? (
                <>
                  <Text style={styles.settingDesc}>
                    We sent a magic link to {authEmail}. Open it on this device to sign in - no password needed.
                  </Text>
                  <TouchableOpacity style={[styles.modalSubmitBtn, {marginTop: 20}]} onPress={() => setAuthModalVisible(false)} accessibilityRole="button">
                    <Text style={styles.modalSubmitText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Email"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={authEmail}
                    onChangeText={v => { setAuthEmail(v); setAuthError(''); }}
                    onSubmitEditing={handleSendMagicLink}
                    returnKeyType="done"
                  />
                  {!!authError && <Text style={styles.modalError}>{authError}</Text>}
                  {authLoading ? (
                    <ActivityIndicator color={Colors.yellow} style={{marginTop: 16}} />
                  ) : (
                    <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSendMagicLink} accessibilityRole="button" accessibilityLabel="Send magic link">
                      <Text style={styles.modalSubmitText}>Send magic link</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <View style={styles.divider} />
        <Text style={styles.versionText}>Version {version}</Text>
        {!!user?.uid && (
          <TouchableOpacity onPress={copyStableId} accessibilityRole="button" accessibilityLabel="Copy user ID">
            <Text style={styles.deviceIdText}>{copiedStableId ? '✓ Copied' : `User ID: ${user.uid.slice(0, 16)}…`}</Text>
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
  authBtn: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: Colors.surface, borderRadius: 8, alignSelf: 'flex-start'},
  authBtnText: {color: Colors.yellow, fontSize: 14, fontWeight: '600'},
  modalOverlay: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)'},
  modalCard: {width: '85%', backgroundColor: Colors.surface, borderRadius: 12, padding: 24},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20},
  modalTitle: {color: Colors.textPrimary, fontSize: 18, fontWeight: '700'},
  modalInput: {backgroundColor: Colors.background, color: Colors.textPrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: Colors.outline},
  modalError: {color: '#ff6b6b', fontSize: 13, marginBottom: 4},
  modalSubmitBtn: {marginTop: 8, backgroundColor: Colors.yellow, borderRadius: 8, paddingVertical: 12, alignItems: 'center'},
  modalSubmitText: {color: Colors.background, fontWeight: '700', fontSize: 15},
  modalToggleText: {color: Colors.textSecondary, fontSize: 13},
  modalDivider: {flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 4},
  modalDividerLine: {flex: 1, height: 1, backgroundColor: Colors.outline},
  modalDividerText: {color: Colors.textSecondary, fontSize: 13, marginHorizontal: 10},
  modalSecondaryBtn: {marginTop: 8, borderWidth: 1, borderColor: Colors.outline, borderRadius: 10, paddingVertical: 13, alignItems: 'center'},
  modalSecondaryText: {color: Colors.textPrimary, fontSize: 15, fontWeight: '600'},
});
