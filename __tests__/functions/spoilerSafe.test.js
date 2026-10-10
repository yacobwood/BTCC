const fs = require('fs');
const path = require('path');
const {
  SPOILER_MARKER_TOPIC,
  LEGACY_SPOILER_STOPGAP,
  spoilerSafeCondition,
  buildSpoilerSafePush,
} = require('../../functions/spoilerSafe');

// Spoiler mode = NO notifications of any kind (2026-10-10, after a No Spoilers
// user still got a race-winner push). See functions/spoilerSafe.js.

const topicCount = condition => (condition.match(/' in topics/g) || []).length;

describe('spoilerSafeCondition', () => {
  it('uses the same marker topic the app subscribes (src/store/settings.js)', () => {
    const settingsSrc = fs.readFileSync(path.join(__dirname, '../../src/store/settings.js'), 'utf8');
    expect(SPOILER_MARKER_TOPIC).toBe('spoiler_free');
    expect(settingsSrc).toContain(`const SPOILER_MARKER_TOPIC = '${SPOILER_MARKER_TOPIC}'`);
  });

  it('excludes the marker and (stopgap) requires results_teaser for a non-results topic', () => {
    expect(LEGACY_SPOILER_STOPGAP).toBe(true);
    expect(spoilerSafeCondition('news_alerts')).toBe(
      "'news_alerts' in topics && !('spoiler_free' in topics) && 'results_teaser' in topics",
    );
  });

  it('needs no stopgap clause for results_* topics (every spoiler build unsubscribes them)', () => {
    expect(spoilerSafeCondition('results_qrace')).toBe(
      "'results_qrace' in topics && !('spoiler_free' in topics)",
    );
  });

  it('adds extra exclusions before the marker (results teaser)', () => {
    expect(spoilerSafeCondition('results_teaser', {exclude: ['results_race1']})).toBe(
      "'results_teaser' in topics && !('results_race1' in topics) && !('spoiler_free' in topics)",
    );
  });

  it('stays within FCM\'s 5-topic condition limit for every real sender', () => {
    for (const topic of ['news_alerts', 'broadcast', 'pre_race1', 'weekend_preview', 'standings_update', 'podcast_alerts', 'explainer_alerts']) {
      expect(topicCount(spoilerSafeCondition(topic))).toBeLessThanOrEqual(5);
    }
    expect(topicCount(spoilerSafeCondition('results_teaser', {exclude: ['results_race3']}))).toBeLessThanOrEqual(5);
  });
});

describe('buildSpoilerSafePush', () => {
  const push = buildSpoilerSafePush({
    topic: 'pre_race1', title: 'Race 1 — Starting in 15 mins', body: 'Lights out soon', channel: 'race',
    data: {type: 'round', round: '10'},
  });

  it('never has a top-level notification block (Android would show it without the app gate)', () => {
    expect(push.notification).toBeUndefined();
    expect(push.android.notification).toBeUndefined();
  });

  it('targets a spoiler-safe condition, never a plain topic', () => {
    expect(push.topic).toBeUndefined();
    expect(push.condition).toBe(spoilerSafeCondition('pre_race1'));
  });

  it('mirrors title/body/channel into data for the Android JS display path', () => {
    expect(push.data).toEqual({type: 'round', round: '10', title: 'Race 1 — Starting in 15 mins', body: 'Lights out soon', channel: 'race'});
  });

  it('gives iOS an alert', () => {
    expect(push.apns.payload.aps.alert).toEqual({title: 'Race 1 — Starting in 15 mins', body: 'Lights out soon'});
  });

  it('omits data.body when there is none (news headline shows as "New Article")', () => {
    const news = buildSpoilerSafePush({topic: 'news_alerts', title: 'Headline', channel: 'news'});
    expect(news.data).toEqual({title: 'Headline', channel: 'news'});
  });
});

// Guard: every visible push in the repo must go through buildSpoilerSafePush.
// A new sender that bypasses it would silently reach spoiler-mode users again.
describe('every push sender is spoiler-safe', () => {
  const root = path.join(__dirname, '../..');
  const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

  it('no Cloud Function sends a top-level notification block', () => {
    const dir = path.join(root, 'functions');
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.js'))) {
      expect({file: f, hasNotificationBlock: /\bnotification:\s*\{/.test(read(`functions/${f}`))})
        .toEqual({file: f, hasNotificationBlock: false});
    }
  });

  it('the only plain topic send left is the silent results_live refresh', () => {
    const dir = path.join(root, 'functions');
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.js') && n !== 'spoilerSafe.js')) {
      const topics = [...read(`functions/${f}`).matchAll(/^\s*topic:\s*'([^']+)'/gm)].map(m => m[1]);
      for (const t of topics) {
        const viaHelper = new RegExp(`buildSpoilerSafePush\\(\\{\\s*topic:\\s*'${t}'`).test(read(`functions/${f}`));
        expect({file: f, topic: t, ok: t === 'results_live' || viaHelper}).toEqual({file: f, topic: t, ok: true});
      }
    }
  });

  it('the broadcast workflow sends through the helper', () => {
    const yml = read('.github/workflows/send-broadcast-notif.yml');
    expect(yml).toContain("require('./repo/functions/spoilerSafe.js')");
    expect(yml).toContain('admin.messaging().send(buildSpoilerSafePush({');
    expect(yml).not.toMatch(/send\(\{\s*topic,/);
  });

  it('session_watcher.py sends by spoiler-safe condition with the same marker topic', () => {
    const py = read('.github/scripts/session_watcher.py');
    expect(py).toContain(`SPOILER_MARKER_TOPIC = "${SPOILER_MARKER_TOPIC}"`);
    expect(py).toContain('"condition": spoiler_safe_condition(topic)');
    expect(py).not.toContain('"topic": topic');
  });
});
