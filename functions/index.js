const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onValueCreated} = require('firebase-functions/v2/database');
const {getMessaging} = require('firebase-admin/messaging');
const {getFirestore} = require('firebase-admin/firestore');
const {getDatabase} = require('firebase-admin/database');
const {initializeApp} = require('firebase-admin/app');

initializeApp();

const CALENDAR_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json';
const SCHEDULE_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/schedule.json';
const NEWS_URL = 'https://www.btcc.net/wp-json/wp/v2/posts?per_page=1&_fields=id,title,slug,featured_media,_links&_embed=wp:featuredmedia';
const HUB_NEWS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/hub_news.json';
const PODCAST_RSS_URL = 'https://rss.buzzsprout.com/1065916.rss';

// Session name → FCM topic
const SESSION_TOPICS = {
  'Free Practice': 'fp_alerts',
  'Qualifying': 'qualifying_alerts',
  'Qualifying Race': 'race_alerts',
  'Race 1': 'race_alerts',
  'Race 2': 'race_alerts',
  'Race 3': 'race_alerts',
};

// Session name → Android notification channel
const SESSION_CHANNELS = {
  'Free Practice': 'free_practice',
  'Qualifying': 'qualifying',
  'Qualifying Race': 'race',
  'Race 1': 'race',
  'Race 2': 'race',
  'Race 3': 'race',
};

/**
 * Converts a session date + local UK time string to a UTC Date.
 * Handles BST/GMT automatically via Intl.
 */
function sessionToUTC(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Check what UTC offset London has at midday on this date
  const midday = new Date(Date.UTC(year, month - 1, day, 12, 0));
  const londonMiddayHour = parseInt(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      hour12: false,
    }).format(midday),
    10,
  );
  const ukOffset = londonMiddayHour - 12; // 0 = GMT, 1 = BST

  return new Date(Date.UTC(year, month - 1, day, hour - ukOffset, minute));
}

/**
 * Returns current time parts in Europe/London timezone.
 */
function getUKTimeParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return {
    weekday: parts.find(p => p.type === 'weekday')?.value,
    hour: parseInt(parts.find(p => p.type === 'hour')?.value, 10),
    minute: parseInt(parts.find(p => p.type === 'minute')?.value, 10),
  };
}

/**
 * Returns a YYYY-MM-DD string for the UK date offsetDays from the given date.
 */
function getUKDateString(date, offsetDays = 0) {
  const d = new Date(date.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

exports.sendSessionNotifications = onSchedule(
  {schedule: 'every 1 minutes', timeZone: 'Europe/London'},
  async () => {
    const now = new Date();
    const uk = getUKTimeParts(now);
    const todayStr = getUKDateString(now);
    const tomorrowStr = getUKDateString(now, 1);
    const sundayStr = getUKDateString(now, -2);

    const messaging = getMessaging();
    const db = getFirestore();
    const sends = [];

    // ── Calendar-gated alerts (session, preview, standings) ───────
    // Only fetch calendar + schedule on relevant days to avoid unnecessary
    // network calls every minute when there's no race activity.
    const calendar = await fetch(CALENDAR_URL).then(r => r.json());

    const isRaceDay = calendar.rounds.some(
      r => r.startDate === todayStr || r.endDate === todayStr,
    );
    const isFridayBefore = uk.weekday === 'Friday' &&
      calendar.rounds.some(r => r.startDate === tomorrowStr);
    const isTuesdayAfter = uk.weekday === 'Tuesday' &&
      calendar.rounds.some(r => r.endDate === sundayStr);

    if (isRaceDay || isFridayBefore || isTuesdayAfter) {
      const schedule = await fetch(SCHEDULE_URL).then(r => r.json());

      const target = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins from now
      const windowMs = 30 * 1000; // ±30 sec window

      const scheduleByRound = {};
      for (const r of schedule.rounds) {
        scheduleByRound[r.round] = r.sessions;
      }

      // ── Session alerts ──────────────────────────────────────────
      for (const round of calendar.rounds) {
        const sessions = scheduleByRound[round.round];
        if (!sessions) continue;

        for (const session of sessions) {
          const dateStr = session.day === 'SAT' ? round.startDate : round.endDate;
          const sessionUTC = sessionToUTC(dateStr, session.time);
          const diff = Math.abs(sessionUTC.getTime() - target.getTime());

          if (diff > windowMs) continue;

          const topic = SESSION_TOPICS[session.name];
          if (!topic) continue;

          sends.push(
            messaging.send({
              topic,
              notification: {
                title: `${session.name} — Starting in 15 mins`,
                body: `${session.name} at ${round.venue} is about to get underway`,
              },
              android: {notification: {channelId: SESSION_CHANNELS[session.name] || 'race'}},
              apns: {payload: {aps: {sound: 'default'}}},
            }),
          );
        }
      }

      // ── Friday 9am — race weekend preview ──────────────────────
      if (uk.weekday === 'Friday' && uk.hour === 9 && uk.minute === 0) {
        const round = calendar.rounds.find(r => r.startDate === tomorrowStr);
        if (round) {
          const rStart = (round.round - 1) * 3 + 1;
          sends.push(
            messaging.send({
              topic: 'weekend_preview',
              notification: {
                title: 'Race Weekend Tomorrow',
                body: `Rounds ${rStart}–${rStart + 2} at ${round.venue} start tomorrow. Don't miss a lap.`,
              },
              android: {notification: {channelId: 'weekend_preview'}},
              apns: {payload: {aps: {sound: 'default'}}},
              data: {type: 'round', round: String(round.round)},
            }),
          );
        }
      }

      // ── Tuesday 9am — standings update ─────────────────────────
      if (uk.weekday === 'Tuesday' && uk.hour === 9 && uk.minute === 0) {
        const round = calendar.rounds.find(r => r.endDate === sundayStr);
        if (round) {
          const rStart = (round.round - 1) * 3 + 1;
          sends.push(
            messaging.send({
              topic: 'standings_update',
              notification: {
                title: 'Standings Updated',
                body: `See how the championship looks after Rounds ${rStart}–${rStart + 2} at ${round.venue}`,
              },
              android: {notification: {channelId: 'standings'}},
              apns: {payload: {aps: {sound: 'default'}}},
            }),
          );
        }
      }
    }

    // ── News alerts ───────────────────────────────────────────────
    try {
      const articles = await fetch(NEWS_URL).then(r => r.json());
      const latest = articles?.[0];
      if (latest) {
        const stateRef = db.collection('state').doc('news');
        let shouldNotify = false;
        let notifyPayload = null;
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(stateRef);
          const lastId = snap.exists ? snap.data().lastId : null;
          if (latest.id !== lastId) {
            tx.set(stateRef, {lastId: latest.id});
            if (lastId !== null) {
              shouldNotify = true;
              const title = latest.title?.rendered?.replace(/&#\d+;/g, c =>
                String.fromCharCode(parseInt(c.match(/\d+/)[0]))) || 'New BTCC Article';
              const imageUrl = latest._embedded?.['wp:featuredmedia']?.[0]?.source_url || null;
              notifyPayload = {title, imageUrl, slug: latest.slug || ''};
            }
          }
        });
        if (shouldNotify && notifyPayload) {
          sends.push(
            messaging.send({
              topic: 'news_alerts',
              notification: {title: 'New Article', body: notifyPayload.title},
              android: {collapseKey: `news_${notifyPayload.slug}`, priority: 'high', ttl: 3600000, notification: {channelId: 'news'}},
              apns: {headers: {'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600), 'apns-collapse-id': `news_${notifyPayload.slug}`}, payload: {aps: {sound: 'default'}}},
              data: {type: 'news', slug: notifyPayload.slug, channel: 'news', title: notifyPayload.title, ...(notifyPayload.imageUrl ? {imageUrl: notifyPayload.imageUrl} : {})},
            }),
          );
        }
      }
    } catch (e) {
      console.error('News check failed:', e);
    }

    // ── Hub news alerts ───────────────────────────────────────────
    try {
      const hubData = await fetch(HUB_NEWS_URL).then(r => r.json());
      const latestHub = hubData?.posts?.[0];
      if (latestHub) {
        const hubStateRef = db.collection('state').doc('hub_news');
        let shouldNotify = false;
        let notifyPayload = null;
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(hubStateRef);
          const lastHubId = snap.exists ? snap.data().lastId : null;
          if (String(latestHub.id) !== String(lastHubId)) {
            tx.set(hubStateRef, {lastId: String(latestHub.id)});
            if (lastHubId !== null) {
              shouldNotify = true;
              notifyPayload = {
                title: latestHub.title || 'New Post',
                imageUrl: latestHub.heroImage || latestHub.images?.[0] || null,
                id: String(latestHub.id),
              };
            }
          }
        });
        if (shouldNotify && notifyPayload) {
          sends.push(
            messaging.send({
              topic: 'news_alerts',
              notification: {title: 'New Post', body: notifyPayload.title},
              android: {collapseKey: `hub_${notifyPayload.id}`, priority: 'high', ttl: 3600000, notification: {channelId: 'news'}},
              apns: {headers: {'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600), 'apns-collapse-id': `hub_${notifyPayload.id}`}, payload: {aps: {sound: 'default'}}},
              data: {type: 'hub', id: notifyPayload.id, channel: 'news', title: notifyPayload.title, ...(notifyPayload.imageUrl ? {imageUrl: notifyPayload.imageUrl} : {})},
            }),
          );
        }
      }
    } catch (e) {
      console.error('Hub news check failed:', e);
    }

    // ── Podcast alerts ────────────────────────────────────────────
    try {
      const rssText = await fetch(PODCAST_RSS_URL).then(r => r.text());
      const guidMatch = rssText.match(/<guid[^>]*>(.*?)<\/guid>/);
      const titleMatch = rssText.match(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                         rssText.match(/<item>[\s\S]*?<title>(.*?)<\/title>/);
      const imageMatch = rssText.match(/<itunes:image[^>]+href="([^"]+)"/);
      const latestGuid = guidMatch?.[1]?.trim();
      const latestTitle = titleMatch?.[1]?.trim();
      const artworkUrl = imageMatch?.[1] || null;

      if (latestGuid) {
        const podcastStateRef = db.collection('state').doc('podcast');
        let shouldNotify = false;
        let podTitle = null;
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(podcastStateRef);
          const lastGuid = snap.exists ? snap.data().lastGuid : null;
          if (latestGuid !== lastGuid) {
            tx.set(podcastStateRef, {lastGuid: latestGuid});
            if (lastGuid !== null) {
              shouldNotify = true;
              podTitle = latestTitle || 'New BTCC Podcast';
            }
          }
        });
        if (shouldNotify && podTitle) {
          sends.push(
            messaging.send({
              topic: 'podcast_alerts',
              notification: {title: 'New Podcast', body: podTitle},
              android: {collapseKey: `podcast_${latestGuid}`, priority: 'high', ttl: 3600000, notification: {channelId: 'podcasts'}},
              apns: {headers: {'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600), 'apns-collapse-id': `podcast_${latestGuid}`}, payload: {aps: {sound: 'default'}}},
              data: {type: 'podcast', channel: 'podcasts', title: podTitle, ...(artworkUrl ? {imageUrl: artworkUrl} : {})},
            }),
          );
        }
      }
    } catch (e) {
      console.error('Podcast check failed:', e);
    }

    const results = await Promise.allSettled(sends);
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`Send ${i} failed:`, r.reason);
    });
  },
);

// Trim live chat to last 200 messages when a new one is written
exports.trimChat = onValueCreated(
  {ref: '/chat/messages/{msgId}', region: 'europe-west1', instance: 'btcchub-af77a-default-rtdb'},
  async () => {
    try {
      const ref = getDatabase('https://btcchub-af77a-default-rtdb.europe-west1.firebasedatabase.app').ref('/chat/messages');
      const snap = await ref.orderByChild('timestamp').once('value');
      const keys = [];
      snap.forEach(c => keys.push(c.key));
      if (keys.length > 200) {
        const updates = {};
        keys.slice(0, keys.length - 200).forEach(k => { updates[k] = null; });
        await ref.update(updates);
      }
    } catch (e) {
      console.error('trimChat failed:', e);
    }
  },
);
