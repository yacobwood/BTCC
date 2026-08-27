const {checkBtccNews} = require('./newsCheck');
const {buildSessionAlertPayload} = require('./sessionAlerts');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {getMessaging} = require('firebase-admin/messaging');
const {getFirestore} = require('firebase-admin/firestore');
const {
  logError,
  logPushHistory,
  fetchWithTimeout,
  CALENDAR_URL,
  SCHEDULE_URL,
  HUB_NEWS_URL,
  PODCAST_RSS_URL,
  SESSION_TOPICS,
  SESSION_CHANNELS,
  sessionToUTC,
  getUKTimeParts,
  getUKDateString,
} = require('./shared');

exports.sendSessionNotifications = onSchedule(
  {schedule: 'every 1 minutes', timeZone: 'Europe/London', secrets: ['GMAIL_APP_PASSWORD']},
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
    try {
      const calendar = await fetchWithTimeout(CALENDAR_URL).then(r => r.json());

      const isRaceDay = calendar.rounds.some(
        r => r.startDate === todayStr || r.endDate === todayStr,
      );
      const isFridayBefore = uk.weekday === 'Friday' &&
        calendar.rounds.some(r => r.startDate === tomorrowStr);
      const isTuesdayAfter = uk.weekday === 'Tuesday' &&
        calendar.rounds.some(r => r.endDate === sundayStr);

      if (isRaceDay || isFridayBefore || isTuesdayAfter) {
        const schedule = await fetchWithTimeout(SCHEDULE_URL).then(r => r.json());

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

            const {body, data} = buildSessionAlertPayload(session, round, now);

            sends.push(
              messaging.send({
                topic,
                notification: {
                  title: `${session.name} — Starting in 15 mins`,
                  body,
                },
                android: {notification: {channelId: SESSION_CHANNELS[session.name] || 'race'}},
                apns: {payload: {aps: {sound: 'default'}}},
                ...(data ? {data} : {}),
              }),
            );
            logPushHistory(`${session.name} — Starting in 15 mins`, body, topic);
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
            logPushHistory('Race Weekend Tomorrow', `Rounds ${rStart}–${rStart + 2} at ${round.venue} start tomorrow. Don't miss a lap.`, 'weekend_preview');
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
                data: {type: 'history'},
              }),
            );
            logPushHistory('Standings Updated', `See how the championship looks after Rounds ${rStart}–${rStart + 2} at ${round.venue}`, 'standings_update');
          }
        }
      }
    } catch (e) {
      console.error('Calendar check failed:', e);
      await logError('sendSessionNotifications', e.message, e, {key: 'check-calendar', alert: true});
    }

    // ── News alerts ───────────────────────────────────────────────
    try {
      await checkBtccNews({fetchFn: fetchWithTimeout, db, messaging, logHistory: logPushHistory});
    } catch (e) {
      console.error('News check failed:', e);
      await logError('sendSessionNotifications', e.message, e, {key: 'check-news', alert: true});
    }

    // ── Hub news alerts ───────────────────────────────────────────
    try {
      const hubData = await fetchWithTimeout(HUB_NEWS_URL).then(r => r.json());
      // Exclude Weekly Digest — those have their own notification fired via the admin page.
      // Also exclude articles older than 48 hours so a stale Firestore lastId can never
      // cause an old article to appear "new" when hub_news.json changes for any reason.
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const latestHub = hubData?.posts?.find(p =>
        (!p.status || p.status === 'published') &&
        p.category !== 'Weekly Digest' &&
        new Date(p.pubDate) > cutoff
      );
      if (latestHub) {
        const hubStateRef = db.collection('state').doc('hub_news');
        let notifyPayload = null;
        await db.runTransaction(async (tx) => {
          notifyPayload = null;
          const snap = await tx.get(hubStateRef);
          const data = snap.exists ? snap.data() : {};
          const lastHubId = data.lastId ?? null;
          const pendingSend = data.pendingSend ?? null;
          if (String(latestHub.id) !== String(lastHubId)) {
            const newPayload = lastHubId !== null ? {
              title: latestHub.title || 'New Post',
              imageUrl: latestHub.heroImage || latestHub.images?.[0] || null,
              id: String(latestHub.id),
            } : null;
            tx.set(hubStateRef, {lastId: String(latestHub.id), pendingSend: newPayload});
            notifyPayload = newPayload;
          } else if (pendingSend) {
            notifyPayload = pendingSend;
          }
        });
        if (notifyPayload) {
          await messaging.send({
            topic: 'news_alerts',
            android: {collapseKey: `hub_${notifyPayload.id}`, priority: 'high', ttl: 3600000},
            apns: {headers: {'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600), 'apns-collapse-id': `hub_${notifyPayload.id}`.slice(0, 64)}, payload: {aps: {sound: 'default', alert: {title: 'New Post', body: notifyPayload.title}}}},
            data: {type: 'hub', id: notifyPayload.id, channel: 'news', title: notifyPayload.title, ...(notifyPayload.imageUrl ? {imageUrl: notifyPayload.imageUrl} : {})},
          });
          console.log(`Hub notification sent OK: "${notifyPayload.title}"`);
          await hubStateRef.update({pendingSend: null});
          logPushHistory('New Post', notifyPayload.title, 'news_alerts');
        }
      }
    } catch (e) {
      console.error('Hub news check failed:', e);
      await logError('sendSessionNotifications', e.message, e, {key: 'check-hub', alert: true});
    }

    // ── Podcast alerts ────────────────────────────────────────────
    try {
      const rssText = await fetchWithTimeout(PODCAST_RSS_URL).then(r => r.text());
      const guidMatch = rssText.match(/<guid[^>]*>(.*?)<\/guid>/);
      const titleMatch = rssText.match(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                         rssText.match(/<item>[\s\S]*?<title>(.*?)<\/title>/);
      const imageMatch = rssText.match(/<itunes:image[^>]+href="([^"]+)"/);
      const latestGuid = guidMatch?.[1]?.trim();
      const latestTitle = titleMatch?.[1]?.trim();
      const artworkUrl = imageMatch?.[1] || null;

      if (latestGuid) {
        const podcastStateRef = db.collection('state').doc('podcast');
        let notifyPayload = null;
        await db.runTransaction(async (tx) => {
          notifyPayload = null;
          const snap = await tx.get(podcastStateRef);
          const data = snap.exists ? snap.data() : {};
          const lastGuid = data.lastGuid ?? null;
          const pendingSend = data.pendingSend ?? null;
          if (latestGuid !== lastGuid) {
            const newPayload = lastGuid !== null
              ? {title: latestTitle || 'New BTCC Podcast', artworkUrl: artworkUrl || null}
              : null;
            tx.set(podcastStateRef, {lastGuid: latestGuid, pendingSend: newPayload});
            notifyPayload = newPayload;
          } else if (pendingSend) {
            notifyPayload = pendingSend;
          }
        });
        if (notifyPayload) {
          await messaging.send({
            topic: 'podcast_alerts',
            android: {collapseKey: `podcast_${latestGuid}`, priority: 'high', ttl: 3600000},
            apns: {headers: {'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600), 'apns-collapse-id': `podcast_${latestGuid}`.slice(0, 64)}, payload: {aps: {sound: 'default', alert: {title: 'New Podcast', body: notifyPayload.title}}}},
            data: {type: 'podcast', channel: 'podcasts', title: notifyPayload.title, ...(notifyPayload.artworkUrl ? {imageUrl: notifyPayload.artworkUrl} : {})},
          });
          console.log(`Podcast notification sent OK: "${notifyPayload.title}"`);
          await podcastStateRef.update({pendingSend: null});
          logPushHistory('New Podcast', notifyPayload.title, 'podcast_alerts');
        }
      }
    } catch (e) {
      console.error('Podcast check failed:', e);
      await logError('sendSessionNotifications', e.message, e, {key: 'check-podcast', alert: true});
    }

    if (sends.length > 0) {
      const results = await Promise.allSettled(sends);
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`Send ${i} failed:`, r.reason);
          logError('sendSessionNotifications:fcm', r.reason?.message || String(r.reason), r.reason, {key: 'fcm-send-failure', alert: true});
        }
      });
    }
  },
);
