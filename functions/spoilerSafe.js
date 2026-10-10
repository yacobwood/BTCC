// Spoiler mode = NO notifications of any kind (not just results). Every
// visible push goes through here so no sender can forget the exclusion.
//
// Pure module (no firebase imports) so .github/workflows/send-broadcast-notif.yml
// can require it straight from the checkout too. session_watcher.py mirrors
// spoiler_safe_condition() by hand - keep the two in sync.
//
// Three independent layers block a push to a spoiler-mode device (2026-10-10,
// after a user with No Spoilers on still got a Qualifying Race push):
//  1. The app unsubscribes every visible topic while spoiler mode is on
//     (src/store/settings.js syncAllTopics).
//  2. The app subscribes the SPOILER_MARKER_TOPIC, and every send here is a
//     condition excluding it - catches a topic unsubscribe that never landed.
//  3. Android is always sent data-only (never a top-level `notification`
//     block, which Android displays without running any app code), so every
//     push reaches displayAndroidDataNotification, which drops it while
//     spoiler mode is on (src/utils/notifications.js).

const SPOILER_MARKER_TOPIC = 'spoiler_free';

// STOPGAP for app builds released before the marker topic existed: those
// builds never subscribe SPOILER_MARKER_TOPIC, but their spoiler mode does
// unsubscribe results_teaser, so requiring it keeps them covered. Side
// effect while on: anyone who turned off Results notifications themselves
// (or is on an app build older than results_teaser, i.e. the current iOS
// build) also gets no non-results pushes. Turn off once
// update_min_version_android in data/flags.json is bumped past the build
// that ships the marker topic.
const LEGACY_SPOILER_STOPGAP = true;
const LEGACY_STOPGAP_TOPIC = 'results_teaser';

// Builds the FCM condition for a topic send that must skip spoiler-mode
// devices. `exclude` adds further !('x' in topics) clauses (results_teaser's
// existing "not already getting the session's own push" rule). FCM allows at
// most 5 topics per condition.
function spoilerSafeCondition(topic, {exclude = []} = {}) {
  const clauses = [`'${topic}' in topics`];
  for (const t of exclude) clauses.push(`!('${t}' in topics)`);
  clauses.push(`!('${SPOILER_MARKER_TOPIC}' in topics)`);
  // results_* session topics need no stopgap: every spoiler-mode build
  // already unsubscribes them.
  const isResultsTopic = topic.startsWith('results_');
  if (LEGACY_SPOILER_STOPGAP && !isResultsTopic) {
    clauses.push(`'${LEGACY_STOPGAP_TOPIC}' in topics`);
  }
  return clauses.join(' && ');
}

// Builds one visible push: data-only on Android (layer 3), alert on iOS.
// `data` keys must already be strings; title/body/channel are merged in so the
// Android JS display path always has them. `body` may be omitted (news sends
// the headline as data.title only, displayed as "New Article").
function buildSpoilerSafePush({topic, exclude, title, body, channel, data = {}, android = {}, apnsHeaders, alert}) {
  const payloadData = {...data, title, channel};
  if (body) payloadData.body = body;
  return {
    condition: spoilerSafeCondition(topic, {exclude}),
    data: payloadData,
    android: {priority: 'high', ...android},
    apns: {
      ...(apnsHeaders ? {headers: apnsHeaders} : {}),
      payload: {aps: {sound: 'default', alert: alert || {title, body: body || ''}}},
    },
  };
}

module.exports = {
  SPOILER_MARKER_TOPIC,
  LEGACY_SPOILER_STOPGAP,
  LEGACY_STOPGAP_TOPIC,
  spoilerSafeCondition,
  buildSpoilerSafePush,
};
