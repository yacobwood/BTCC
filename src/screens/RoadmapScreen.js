import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';
import {getFCMToken} from '../utils/notifications';

const ROADMAP_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/roadmap.json';
const PROJECT_ID = 'btcchub-af77a';
const API_KEY = 'AIzaSyC0blgpkf9ioMa5QgkIwi9S6iCVnphSeHE';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function fetchVoteCount(itemId) {
  try {
    const r = await fetch(`${FS_BASE}/roadmap_votes/${itemId}?key=${API_KEY}`);
    if (!r.ok) return 0;
    const doc = await r.json();
    return parseInt(doc?.fields?.count?.integerValue || 0, 10);
  } catch {
    return 0;
  }
}

async function submitVote(itemId, deviceId) {
  const res = await fetch(`${FS_BASE}:commit?key=${API_KEY}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      writes: [
        {
          transform: {
            document: `projects/${PROJECT_ID}/databases/(default)/documents/roadmap_votes/${itemId}`,
            fieldTransforms: [
              {fieldPath: 'count', increment: {integerValue: '1'}},
              {
                fieldPath: 'voters',
                appendMissingElements: {values: [{stringValue: deviceId}]},
              },
            ],
          },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error('vote failed');
}

export default function RoadmapScreen({navigation}) {
  const [items, setItems] = useState([]);
  const [votes, setVotes] = useState({});
  const [voted, setVoted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ideaText, setIdeaText] = useState('');
  const [ideaState, setIdeaState] = useState('idle');

  useEffect(() => {
    Analytics.screen('roadmap');
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [data, storedVoted] = await Promise.all([
        fetch(ROADMAP_URL).then(r => r.json()),
        AsyncStorage.getItem('roadmap_voted').then(v => (v ? JSON.parse(v) : [])),
      ]);
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const STATUS_ORDER = {'in-progress': 0, planned: 1, idea: 2, done: 3, rejected: 4};
      const planned = (data.items || data.planned || [])
        .filter(item => {
          if (item.status === 'rejected') {
            if (!item.rejectedAt) return false;
            return new Date(item.rejectedAt).getTime() > twoWeeksAgo;
          }
          if (item.status === 'done') {
            if (!item.doneAt) return false;
            return new Date(item.doneAt).getTime() > twoWeeksAgo;
          }
          return true;
        })
        .sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
      setItems(planned);
      setVoted(storedVoted);

      const counts = await Promise.all(planned.map(item => fetchVoteCount(item.id)));
      const voteMap = {};
      planned.forEach((item, i) => {
        voteMap[item.id] = counts[i];
      });
      setVotes(voteMap);
    } catch {}
    setLoading(false);
  };

  const onVote = async item => {
    const hasVoted = voted.includes(item.id);
    const newVoted = hasVoted ? voted.filter(id => id !== item.id) : [...voted, item.id];
    setVoted(newVoted);
    setVotes(prev => ({...prev, [item.id]: Math.max(0, (prev[item.id] || 0) + (hasVoted ? -1 : 1))}));
    await AsyncStorage.setItem('roadmap_voted', JSON.stringify(newVoted));
    if (!hasVoted) Analytics.roadmapVoted(item.id);

    try {
      const deviceId = await getFCMToken();
      if (hasVoted) {
        await fetch(`${FS_BASE}:commit?key=${API_KEY}`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            writes: [{
              transform: {
                document: `projects/${PROJECT_ID}/databases/(default)/documents/roadmap_votes/${item.id}`,
                fieldTransforms: [
                  {fieldPath: 'count', increment: {integerValue: '-1'}},
                ],
              },
            }],
          }),
        });
      } else {
        await submitVote(item.id, deviceId);
      }
    } catch {}
  };

  const onSubmitIdea = async () => {
    if (!ideaText.trim() || ideaState === 'loading') return;
    setIdeaState('loading');
    try {
      const id = `sub_${Date.now()}`;
      const res = await fetch(`${FS_BASE}/roadmap_submissions?key=${API_KEY}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          fields: {
            id: {stringValue: id},
            title: {stringValue: ideaText.trim()},
            submittedAt: {stringValue: new Date().toISOString()},
          },
        }),
      });
      if (res.ok) {
        setIdeaState('success');
        setIdeaText('');
        Analytics.roadmapIdeaSubmitted();
      } else {
        setIdeaState('error');
      }
    } catch {
      setIdeaState('error');
    }
  };

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
        <Text style={styles.headerTitle}>ROADMAP</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.yellow} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>PLANNED</Text>
          <Text style={styles.sectionSubtitle}>Tap the thumbs up to vote for features you want most</Text>

          {items.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <StatusBadge status={item.status} />
                {item.status !== 'rejected' && item.status !== 'done' && (
                  <TouchableOpacity
                    style={[
                      styles.voteBtn,
                      voted.includes(item.id) && styles.voteBtnActive,
                    ]}
                    onPress={() => onVote(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Vote for ${item.title}, ${votes[item.id] || 0} votes`}>
                    <Icon
                      name="thumb-up"
                      size={15}
                      color={voted.includes(item.id) ? Colors.navy : Colors.yellow}
                    />
                    <Text
                      style={[
                        styles.voteCount,
                        voted.includes(item.id) && styles.voteCountActive,
                      ]}>
                      {votes[item.id] || 0}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {!!item.description && (
                <Text style={styles.cardDesc}>{item.description}</Text>
              )}
              {item.status === 'rejected' && !!item.rejectReason && (
                <View style={styles.rejectBox}>
                  <Text style={styles.rejectText}>{item.rejectReason}</Text>
                </View>
              )}
            </View>
          ))}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>SUBMIT AN IDEA</Text>
          <Text style={styles.sectionSubtitle}>
            Got a feature in mind? Let us know and it might make the list.
          </Text>

          {ideaState === 'success' ? (
            <View style={styles.successBox}>
              <Icon name="check-circle" size={20} color="#22C55E" />
              <Text style={styles.successText}>Thanks! We'll consider it.</Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={ideaText}
                onChangeText={setIdeaText}
                onFocus={() => ideaState === 'error' && setIdeaState('idle')}
                placeholder="e.g. Live pit stop counter"
                placeholderTextColor={Colors.textSecondary}
                maxLength={120}
                accessibilityLabel="Idea"
              />
              {ideaState === 'error' && (
                <Text style={styles.errorText}>Failed to submit. Please try again.</Text>
              )}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!ideaText.trim() || ideaState === 'loading') && {opacity: 0.5},
                ]}
                onPress={onSubmitIdea}
                disabled={!ideaText.trim() || ideaState === 'loading'}
                accessibilityRole="button"
                accessibilityLabel="Submit idea">
                {ideaState === 'loading' ? (
                  <ActivityIndicator color={Colors.navy} />
                ) : (
                  <Text style={styles.submitText}>Submit</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const STATUS_META = {
  idea: {label: 'Idea', color: Colors.textSecondary, border: Colors.outline},
  planned: {label: 'Planned', color: '#60A5FA', border: '#60A5FA'},
  'in-progress': {label: 'In Progress', color: Colors.yellow, border: Colors.yellow},
  done: {label: 'Done', color: '#22C55E', border: '#22C55E'},
  rejected: {label: 'Not Planned', color: '#EF4444', border: '#EF4444'},
};

function StatusBadge({status}) {
  const meta = STATUS_META[status] || STATUS_META.planned;
  return (
    <View style={[styles.badge, {borderColor: meta.border}]}>
      <Text style={[styles.badgeText, {color: meta.color}]}>{meta.label}</Text>
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
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  content: {padding: 16, paddingBottom: 48},
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  sectionSubtitle: {color: '#fff', fontSize: 13, marginBottom: 16, lineHeight: 19},
  card: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  cardTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6},
  cardTitle: {color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 2},
  cardDesc: {color: '#fff', fontSize: 12, lineHeight: 17},
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.yellow,
    minWidth: 52,
    justifyContent: 'center',
  },
  voteBtnActive: {backgroundColor: Colors.yellow, borderColor: Colors.yellow},
  voteCount: {color: Colors.yellow, fontSize: 14, fontWeight: '700'},
  voteCountActive: {color: Colors.navy},
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {fontSize: 11, fontWeight: '700', letterSpacing: 0.5},
  divider: {height: 1, backgroundColor: Colors.outline, marginVertical: 24},
  input: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.outline,
    marginBottom: 8,
  },
  errorText: {color: '#EF4444', fontSize: 13, marginBottom: 8},
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  successText: {color: '#22C55E', fontSize: 14, fontWeight: '600'},
  submitBtn: {
    backgroundColor: Colors.yellow,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {color: Colors.navy, fontSize: 15, fontWeight: '800'},
  rejectBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  rejectText: {color: '#EF4444', fontSize: 12, lineHeight: 17},
});
