import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';

const FS_BASE = 'https://firestore.googleapis.com/v1/projects/btcchub-af77a/databases/(default)/documents';
const FS_API_KEY = 'AIzaSyC0blgpkf9ioMa5QgkIwi9S6iCVnphSeHE';
const categories = ['Bug', 'Crash', 'UI Issue', 'Feature Request', 'Other'];

export default function BugReportScreen({navigation}) {
  const [category, setCategory] = useState(categories[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [state, setState] = useState('idle'); // idle, loading, success, error

  useEffect(() => { Analytics.screen('bug_report'); }, []);

  const onSubmit = async () => {
    if (!title.trim() && !description.trim()) return;
    setState('loading');
    try {
      const res = await fetch(`${FS_BASE}/bug_reports?key=${FS_API_KEY}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          fields: {
            category: {stringValue: category},
            title: {stringValue: title.trim()},
            description: {stringValue: description.trim()},
            steps: {stringValue: steps.trim()},
            submittedAt: {stringValue: new Date().toISOString()},
          },
        }),
      });
      setState(res.ok ? 'success' : 'error');
      if (res.ok) Analytics.bugReportSubmitted(category);
    } catch {
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center', padding: 32}]}>
        <Icon name="check-circle" size={64} color={Colors.yellow} />
        <Text style={{color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 16}}>Thanks!</Text>
        <Text style={{color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8}}>
          Your feedback has been submitted. We'll look into it.
        </Text>
        <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.submitText}>Back to More</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FEEDBACK & BUGS</Text>
      </View>
      <ScrollView contentContainerStyle={{padding: 16}}>
        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.chipRow}>
          {categories.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, category === c && styles.chipActive]}
              onPress={() => setCategory(c)}
              accessibilityRole="button"
              accessibilityLabel={`${c} category, ${category === c ? 'selected' : 'not selected'}`}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>TITLE</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Brief description"
          placeholderTextColor={Colors.textSecondary}
          accessibilityLabel="Title"
        />

        <Text style={styles.label}>DESCRIPTION</Text>
        <TextInput
          style={[styles.input, {height: 120, textAlignVertical: 'top'}]}
          value={description}
          onChangeText={setDescription}
          placeholder="What happened?"
          placeholderTextColor={Colors.textSecondary}
          multiline
          accessibilityLabel="Description"
        />

        <Text style={styles.label}>STEPS TO REPRODUCE</Text>
        <TextInput
          style={[styles.input, {height: 100, textAlignVertical: 'top'}]}
          value={steps}
          onChangeText={setSteps}
          placeholder="1. Go to…  2. Tap on…  3. See error"
          placeholderTextColor={Colors.textSecondary}
          multiline
          accessibilityLabel="Steps to reproduce"
        />

        {state === 'error' && (
          <Text style={{color: '#EF4444', fontSize: 13, marginTop: 8}}>
            Failed to submit. Please try again.
          </Text>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, state === 'loading' && {opacity: 0.6}]}
          onPress={onSubmit}
          disabled={state === 'loading'}
          accessibilityLabel="Submit feedback"
          accessibilityRole="button">
          {state === 'loading' ? (
            <ActivityIndicator color={Colors.navy} />
          ) : (
            <Text style={styles.submitText}>Submit</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  label: {color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, marginTop: 20},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  chipActive: {backgroundColor: Colors.yellow, borderColor: Colors.yellow},
  chipText: {color: Colors.textSecondary, fontSize: 13, fontWeight: '600'},
  chipTextActive: {color: Colors.navy, fontWeight: '700'},
  input: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  submitBtn: {
    backgroundColor: Colors.yellow,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitText: {color: Colors.navy, fontSize: 15, fontWeight: '800'},
});
