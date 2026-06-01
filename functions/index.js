// v2
const {checkBtccNews} = require('./newsCheck');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onRequest} = require('firebase-functions/v2/https');
const {onValueCreated} = require('firebase-functions/v2/database');
const {getMessaging} = require('firebase-admin/messaging');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getDatabase} = require('firebase-admin/database');
const {getAuth} = require('firebase-admin/auth');
const {initializeApp} = require('firebase-admin/app');
const {GoogleAuth} = require('google-auth-library');

initializeApp();

// ── Error observability ───────────────────────────────────────
// opts.key   — upsert at errors/{key} instead of appending (use for repetitive per-minute errors)
// opts.alert — also send an email to btcchub@gmail.com
async function logError(fn, message, err, opts = {}) {
  try {
    const db = getFirestore();
    const entry = {
      fn,
      message: String(message).slice(0, 500),
      stack: (err?.stack || '').slice(0, 2000),
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    let shouldAlert = !!opts.alert;
    if (opts.key) {
      const ref = db.collection('errors').doc(opts.key);
      if (opts.alert) {
        // Only alert on first occurrence or when error recurs after being resolved
        const existing = await ref.get();
        shouldAlert = !existing.exists || existing.data().resolved === true;
      }
      await ref.set(entry);
    } else {
      await db.collection('errors').add(entry);
    }
    if (shouldAlert && process.env.GMAIL_APP_PASSWORD) {
      await sendErrorEmail(fn, message, err);
    }
  } catch (e) {
    console.error('logError itself failed:', e);
  }
}

async function logPushHistory(title, body, channel) {
  try {
    const db = getFirestore();
    await db.collection('push_history').add({
      title, body, channel, type: 'auto', sentAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('logPushHistory failed:', e);
  }
}

async function sendErrorEmail(fn, message, err) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {user: 'btcchub@gmail.com', pass: process.env.GMAIL_APP_PASSWORD},
  });
  await transporter.sendMail({
    from: '"BTCC Hub" <btcchub@gmail.com>',
    to: 'btcchub@gmail.com',
    subject: `[BTCC Hub Error] ${fn}`,
    text: `Function: ${fn}\nMessage: ${message}\n\nStack:\n${err?.stack || 'n/a'}\n\nTime: ${new Date().toISOString()}`,
  });
}

const CALENDAR_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json';
const SCHEDULE_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/schedule.json';
const HUB_NEWS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/hub_news.json';
const PODCAST_RSS_URL = 'https://rss.buzzsprout.com/1065916.rss';

// Wrap fetch with a hard timeout so a hanging external service never causes a 504.
// Cloud Run kills the function at 60s; with 10s per request we stay well inside that.
function fetchWithTimeout(url, ms = 10000, options = {}) {
  return fetch(url, {...options, signal: AbortSignal.timeout(ms)});
}

// Session name → FCM topic (must match LEAF_TOPICS in src/store/settings.js)
const SESSION_TOPICS = {
  'Free Practice':   'pre_fp',
  'Qualifying':      'pre_qualifying',
  'Qualifying Race': 'pre_qrace',
  'Race 1':          'pre_race1',
  'Race 2':          'pre_race2',
  'Race 3':          'pre_race3',
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

            sends.push(
              messaging.send({
                topic,
                notification: {
                  title: `${session.name} — Starting in 15 mins`,
                  body: `${session.name} at ${round.venue} is about to get underway`,
                },
                android: {notification: {channelId: SESSION_CHANNELS[session.name] || 'race'}},
                apns: {payload: {aps: {sound: 'default'}}},
                ...(round.tslEventId ? {data: {type: 'livetiming', eventId: String(round.tslEventId)}} : {}),
              }),
            );
            logPushHistory(`${session.name} — Starting in 15 mins`, `${session.name} at ${round.venue} is about to get underway`, topic);
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
            apns: {headers: {'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600), 'apns-collapse-id': `hub_${notifyPayload.id}`}, payload: {aps: {sound: 'default', alert: {title: 'New Post', body: notifyPayload.title}}}},
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

// ── Shared digest logic ───────────────────────────────────────
async function runDigest(label, promptIntro) {
  const today = getUKDateString(new Date());
  const postId = `digest-${today}`;

  const DIGEST_HERO = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/hub_images/digest/weekly-digest-hero.png';
  const GITHUB_API = 'https://api.github.com/repos/yacobwood/BTCC/contents/data/hub_news.json';
  const ghHeaders = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // ── Fetch current hub_news.json from GitHub ─────────────────
  const fileRes = await fetchWithTimeout(GITHUB_API, 10000, {headers: ghHeaders});
  if (!fileRes.ok) throw new Error(`GitHub GET failed: ${fileRes.status}`);
  const fileData = await fileRes.json();
  const hubNews = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

  // Skip if today's digest already exists (retry guard)
  if (hubNews.posts.some(p => p.id === postId)) {
    console.log(`${label}: ${postId} already exists, skipping`);
    return;
  }

  const sources = [];

  // ── Reddit r/BTCC ───────────────────────────────────────────
  try {
    const res = await fetchWithTimeout(
      'https://www.reddit.com/r/BTCC/top.json?t=week&limit=30',
      10000,
      {headers: {'User-Agent': 'BTCCHubBot/1.0 by BTCC_Hub'}},
    );
    const data = await res.json();
    for (const child of data?.data?.children ?? []) {
      const p = child.data;
      if (p.score < 3) continue;
      sources.push({
        source: 'Reddit r/BTCC',
        title: p.title,
        text: p.selftext?.slice(0, 800) || '',
        url: `https://reddit.com${p.permalink}`,
      });
    }
  } catch (e) {
    console.error('Reddit scrape failed:', e);
  }

  // ── BTCC.net WordPress API ──────────────────────────────────
  try {
    const posts = await fetchWithTimeout(
      'https://www.btcc.net/wp-json/wp/v2/posts?per_page=15&_fields=title,excerpt,link&orderby=date',
    ).then(r => r.json());
    for (const post of posts) {
      const excerpt = post.excerpt?.rendered?.replace(/<[^>]+>/g, '').trim() ?? '';
      sources.push({
        source: 'BTCC.net',
        title: post.title?.rendered ?? '',
        text: excerpt.slice(0, 600),
        url: post.link,
      });
    }
  } catch (e) {
    console.error('BTCC.net scrape failed:', e);
  }

  // ── RSS helper ──────────────────────────────────────────────
  async function scrapeRss(url, sourceName) {
    try {
      const text = await fetchWithTimeout(url).then(r => r.text());
      const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12);
      for (const item of items) {
        const title =
          (item[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
            item[1].match(/<title>(.*?)<\/title>/))?.[1] ?? '';
        const desc =
          (item[1].match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
            item[1].match(/<description>(.*?)<\/description>/))?.[1]
            ?.replace(/<[^>]+>/g, '')
            .trim() ?? '';
        const link =
          (item[1].match(/<link>(.*?)<\/link>/) ||
            item[1].match(/<link\s[^>]+href="([^"]+)"/))?.[1]?.trim() ?? '';
        if (title) {
          sources.push({source: sourceName, title, text: desc.slice(0, 500), url: link});
        }
      }
    } catch (e) {
      console.error(`${sourceName} RSS failed:`, e);
    }
  }

  await Promise.all([
    scrapeRss('https://www.autosport.com/rss/btcc/news/', 'Autosport'),
    scrapeRss('https://www.motorsport.com/rss/btcc/news/', 'Motorsport.com'),
    scrapeRss('https://touringcartimes.com/feed/', 'Touring Car Times'),
  ]);

  if (sources.length === 0) {
    console.log(`${label}: no sources found, skipping`);
    return;
  }

  // ── Ask Claude to write the article ────────────────────────
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.default({apiKey: process.env.ANTHROPIC_API_KEY});

  const sourceBlock = sources
    .map((s, i) => `[${i + 1}] ${s.source}: "${s.title}"\n${s.text || '(no excerpt)'}`)
    .join('\n\n');

  // Build cross-reference context from previous digest articles
  const prevDigests = hubNews.posts
    .filter(p => p.category === 'Weekly Digest' && p.id !== postId)
    .slice(0, 8);
  const prevDigestBlock = prevDigests.length
    ? prevDigests.map(p => {
        const plain = (p.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
        return `  • "${p.title}"\n    ${plain}`;
      }).join('\n\n')
    : '  (none yet — this is the first digest)';

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2200,
    messages: [
      {
        role: 'user',
        content:
          promptIntro +
          `Writing rules — follow all of these without exception:\n` +
          `- Write in British English (tyre not tire, colour not color, etc.)\n` +
          `- Never use a comma before "and"\n` +
          `- Never use em dashes (— or –)\n` +
          `- Never start a sentence with "It's worth noting", "Furthermore", "Additionally", "Moreover" or "In conclusion"\n` +
          `- Never use the words: delve, showcase, navigate, elevate, crucial, pivotal, fascinating, notably, seamlessly, underscores, landscape\n` +
          `- Avoid passive voice where active is possible\n` +
          `- Use specific names, lap times, positions and details rather than vague generalities\n` +
          `- Do not use full car model names (e.g. "Ford Focus Titanium", "BMW 330i M Sport") — just say "car" or refer to the team/manufacturer only when the make is genuinely relevant\n` +
          `- Express opinions and reactions — this is a fan writing for fans, not a wire report\n` +
          `- The app is called "BTCC Hub" — never refer to it as "BTCC Fan Hub"\n` +
          `- The title and body must feel completely distinct from any previously published article. Do not reuse phrasing, angles or story structures from these existing titles:\n` +
          hubNews.posts.slice(0, 20).map(p => `  • ${p.title}`).join('\n') + '\n\n' +
          `- Do not repeat a topic, story or driver storyline from a previous digest unless genuinely new information has emerged. If revisiting a recurring story, acknowledge only what has changed and move on:\n` +
          prevDigestBlock + '\n\n' +
          `Respond with ONLY valid JSON in exactly this format (no markdown, no extra text):\n` +
          `{"title":"<short punchy headline>","content":"<HTML body>","description":"<one sentence summary>"}\n\n` +
          `Sources:\n${sourceBlock}`,
      },
    ],
  });

  let title = `BTCC Digest — ${today}`;
  let content = '<p>No content generated.</p>';
  let description = '';
  try {
    const raw = message.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(raw);
    title = parsed.title || title;
    content = (parsed.content || content)
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/<h([23])>\s*/g, '<h$1>')
      .replace(/\s*<\/h([23])>/g, '</h$1>');
    description = parsed.description || '';
  } catch (e) {
    console.error(`${label}: failed to parse Claude response:`, e);
    content = `<p>${message.content[0].text}</p>`;
  }

  // ── Prepend draft to hub_news.json and commit ───────────────
  const newPost = {
    id: postId,
    title,
    description,
    content,
    imageUrl: DIGEST_HERO,
    pubDate: `${today}T08:00:00`,
    category: 'Weekly Digest',
    source: 'btcc-hub',
    status: 'draft',
  };

  hubNews.posts.unshift(newPost);

  const updatedContent = Buffer.from(JSON.stringify(hubNews, null, 2)).toString('base64');
  const putRes = await fetchWithTimeout(GITHUB_API, 10000, {
    method: 'PUT',
    headers: {...ghHeaders, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      message: `${label} digest draft — ${today}`,
      content: updatedContent,
      sha: fileData.sha,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub PUT failed: ${putRes.status} ${err}`);
  }

  // Notification is intentionally NOT sent here — the article is saved as a
  // draft for admin review first. The admin publishes it manually via the
  // admin panel, which triggers the digest_alerts notification at that point.
  console.log(`${label}: digest draft committed for ${today}: ${title}`);
}

// ── Weekly digest — every Monday at 8am ──────────────────────
exports.weeklyDigest = onSchedule(
  {
    schedule: '0 8 * * 1',
    timeZone: 'Europe/London',
    secrets: ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'GMAIL_APP_PASSWORD'],
  },
  async () => {
    try {
      await runDigest(
        'weeklyDigest',
        `You are a passionate, opinionated British BTCC fan writing a weekly round-up for the BTCC Hub fan app. ` +
        `Write like someone who was glued to their TV or at the circuit all weekend — not a journalist, not a press release. ` +
        `Use British English throughout. ` +
        `Cover the past 7 days: race results, driver performances, team news, championship picture, fan reaction and anything else worth talking about. If any drivers received penalty points on their licence, mention who got them and why — these matter for the title fight. ` +
        `Write 5 to 7 paragraphs. Each paragraph should have a clear focus. Mix short punchy sentences with the occasional longer one for rhythm. ` +
        `Have opinions — say who impressed you, who disappointed, what surprised you. ` +
        `Write the body in HTML using <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li> and <a> tags as appropriate — no images. ` +
        `Do not include the title in the body. Do not add empty <p> tags or blank lines between elements — place each <h2> or <h3> immediately after the closing </p> of the previous paragraph with no gap.\n\n`,
      );
    } catch (e) {
      console.error('weeklyDigest failed:', e);
      await logError('weeklyDigest', e.message, e, {alert: true});
    }
  },
);

// ── Race weekend preview digest — every Thursday at 8am ──────
// Only runs if there is a BTCC round starting that Saturday.
exports.raceWeekendDigest = onSchedule(
  {
    schedule: '0 8 * * 4',
    timeZone: 'Europe/London',
    secrets: ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'GMAIL_APP_PASSWORD'],
  },
  async () => {
    try {
      const now = new Date();
      const saturdayStr = getUKDateString(now, 2); // Thursday + 2 = Saturday
      const calendar = await fetchWithTimeout(CALENDAR_URL).then(r => r.json());
      const round = calendar.rounds.find(r => r.startDate === saturdayStr);
      if (!round) {
        console.log(`raceWeekendDigest: no round on ${saturdayStr}, skipping`);
        return;
      }
      await runDigest(
        'raceWeekendDigest',
        `You are a passionate, opinionated British BTCC fan writing a race weekend preview for the BTCC Hub fan app. ` +
        `Write like someone who can't wait for the weekend — not a journalist, not a press release. ` +
        `Use British English throughout. ` +
        `This weekend the BTCC heads to ${round.venue} (${round.location}). ` +
        `Build genuine anticipation: who to watch, the storylines going in, the championship battle, what makes this circuit special, and any team or driver news fans need to know. ` +
        `Write 5 to 7 paragraphs. Each paragraph should have a clear focus. Mix short punchy sentences with the occasional longer one for rhythm. ` +
        `Have opinions — get fans excited, make predictions, say who you think will shine or struggle. ` +
        `Write the body in HTML using <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li> and <a> tags as appropriate — no images. ` +
        `Do not include the title in the body. Do not add empty <p> tags or blank lines between elements — place each <h2> or <h3> immediately after the closing </p> of the previous paragraph with no gap.\n\n`,
      );
    } catch (e) {
      console.error('raceWeekendDigest failed:', e);
      await logError('raceWeekendDigest', e.message, e, {alert: true});
    }
  },
);

// ── Manual digest trigger — called from admin page ────────────
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'btcchub-digest-trigger-2026';

exports.triggerDigest = onRequest(
  {
    secrets: ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'GMAIL_APP_PASSWORD'],
    cors: ['https://yacobwood.github.io'],
  },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
    if (req.headers['x-admin-secret'] !== ADMIN_SECRET) { res.status(401).send('Unauthorized'); return; }

    const type = req.body?.type || 'weekly';
    try {
      if (type === 'race') {
        const now = new Date();
        const saturdayStr = getUKDateString(now, 2);
        const calendar = await fetchWithTimeout(CALENDAR_URL).then(r => r.json());
        const round = calendar.rounds.find(r => r.startDate === saturdayStr)
          || calendar.rounds.find(r => {
            const start = new Date(r.startDate);
            const end = new Date(r.endDate || r.startDate);
            return now >= start && now <= end;
          });
        await runDigest(
          'triggerDigest:race',
          `You are a passionate, opinionated British BTCC fan writing a race weekend preview for the BTCC Hub fan app. ` +
          `Write like someone who can't wait for the weekend — not a journalist, not a press release. ` +
          `Use British English throughout. ` +
          (round ? `This weekend the BTCC heads to ${round.venue} (${round.location}). ` : '') +
          `Build genuine anticipation: who to watch, the storylines going in, the championship battle, what makes this circuit special, and any team or driver news fans need to know. ` +
          `Write 5 to 7 paragraphs. Each paragraph should have a clear focus. Mix short punchy sentences with the occasional longer one for rhythm. ` +
          `Have opinions — get fans excited, make predictions, say who you think will shine or struggle. ` +
          `Write the body in HTML using <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li> and <a> tags as appropriate — no images. ` +
          `Do not include the title in the body.\n\n`,
        );
      } else {
        await runDigest(
          'triggerDigest:weekly',
          `You are a passionate, opinionated British BTCC fan writing a weekly round-up for the BTCC Hub fan app. ` +
          `Write like someone who was glued to their TV or at the circuit all weekend — not a journalist, not a press release. ` +
          `Use British English throughout. ` +
          `Cover the past 7 days: race results, driver performances, team news, championship picture, fan reaction and anything else worth talking about. If any drivers received penalty points on their licence, mention who got them and why — these matter for the title fight. ` +
          `Write 5 to 7 paragraphs. Each paragraph should have a clear focus. Mix short punchy sentences with the occasional longer one for rhythm. ` +
          `Have opinions — say who impressed you, who disappointed, what surprised you. ` +
          `Write the body in HTML using <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li> and <a> tags as appropriate — no images. ` +
          `Do not include the title in the body.\n\n`,
        );
      }
      res.status(200).json({ok: true});
    } catch (e) {
      console.error('triggerDigest failed:', e);
      await logError('triggerDigest', e.message, e, {alert: true});
      res.status(500).json({ok: false, error: e.message});
    }
  },
);

// Apply ban: hide all existing messages from the banned author and write a system notice
exports.onChatBan = onValueCreated(
  {ref: '/chat/bans/{authorId}', region: 'europe-west1', instance: 'btcchub-af77a-default-rtdb'},
  async (event) => {
    try {
      const authorId = event.params.authorId;
      const ban = event.data.val();
      const db = getDatabase('https://btcchub-af77a-default-rtdb.europe-west1.firebasedatabase.app');
      const messagesRef = db.ref('/chat/messages');

      const snap = await messagesRef.orderByChild('authorId').equalTo(authorId).once('value');
      const updates = {};
      snap.forEach(c => { updates[`${c.key}/hidden`] = true; });
      if (Object.keys(updates).length > 0) await messagesRef.update(updates);

      const durationText = ban.duration === 'permanent' ? 'permanently' : `for ${ban.duration}`;
      await messagesRef.push({
        text: `${ban.authorName} has been banned ${durationText}.`,
        authorId: 'system',
        authorName: 'BTCC Hub Admin',
        timestamp: Date.now(),
        flagCount: 0,
        hidden: false,
        type: 'ban_notice',
      });
    } catch (e) {
      console.error('onChatBan failed:', e);
    }
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

// ── Analytics sync — daily at 8am ─────────────────────────────
// Fetches key metrics from GA4 and writes to Firestore analytics/summary
// so they can be queried without needing direct Firebase Console access.
const GA4_PROPERTY_ID = '528813863';

exports.syncAnalytics = onSchedule(
  {schedule: '0 8 * * *', timeZone: 'Europe/London'},
  async () => { try {
    const db = getFirestore();
    const auth = new GoogleAuth({scopes: ['https://www.googleapis.com/auth/analytics.readonly']});
    const client = await auth.getClient();
    const {token} = await client.getAccessToken();

    const runReport = async (body) => {
      const res = await fetchWithTimeout(
        `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
        15000,
        {method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify(body)},
      );
      const json = await res.json();
      if (json.error) throw new Error(`GA4 API error: ${JSON.stringify(json.error)}`);
      return json;
    };

    const [overviewReport, sourcesReport, dailyReport] = await Promise.all([
      // New + active users across three windows
      runReport({
        dateRanges: [
          {startDate: 'today', endDate: 'today', name: '1d'},
          {startDate: '7daysAgo', endDate: 'today', name: '7d'},
          {startDate: '29daysAgo', endDate: 'today', name: '30d'},
        ],
        metrics: [{name: 'newUsers'}, {name: 'activeUsers'}],
      }),
      // Acquisition sources for the last 7 days
      runReport({
        dateRanges: [{startDate: '7daysAgo', endDate: 'today'}],
        dimensions: [{name: 'sessionSource'}, {name: 'sessionMedium'}],
        metrics: [{name: 'newUsers'}, {name: 'sessions'}],
        orderBys: [{metric: {metricName: 'newUsers'}, desc: true}],
        limit: 10,
      }),
      // Daily breakdown for the last 30 days
      runReport({
        dateRanges: [{startDate: '29daysAgo', endDate: 'today'}],
        dimensions: [{name: 'date'}],
        metrics: [{name: 'newUsers'}, {name: 'activeUsers'}],
        orderBys: [{dimension: {dimensionName: 'date'}}],
      }),
    ]);

    // Overview — each row corresponds to a named date range
    const overview = {};
    for (const row of overviewReport.rows || []) {
      const name = row.dimensionValues?.[0]?.value;
      overview[name] = {
        newUsers: parseInt(row.metricValues?.[0]?.value || '0'),
        activeUsers: parseInt(row.metricValues?.[1]?.value || '0'),
      };
    }

    // Acquisition sources
    const topSources = (sourcesReport.rows || []).map(row => ({
      source: row.dimensionValues?.[0]?.value,
      medium: row.dimensionValues?.[1]?.value,
      newUsers: parseInt(row.metricValues?.[0]?.value || '0'),
      sessions: parseInt(row.metricValues?.[1]?.value || '0'),
    }));

    // Daily new users — date is YYYYMMDD from GA4
    const dailyNewUsers = (dailyReport.rows || []).map(row => ({
      date: row.dimensionValues?.[0]?.value,
      newUsers: parseInt(row.metricValues?.[0]?.value || '0'),
      activeUsers: parseInt(row.metricValues?.[1]?.value || '0'),
    }));

    await db.collection('analytics').doc('summary').set({
      updatedAt: new Date().toISOString(),
      overview,
      topSources,
      dailyNewUsers,
    });

    console.log('syncAnalytics: done', JSON.stringify(overview));
  } catch (e) {
    console.error('syncAnalytics failed:', e);
    await logError('syncAnalytics', e.message, e, {alert: true});
  }},
);

// ── Results cache invalidation — called by GitHub Actions scraper ─────────────
// Sends a silent FCM data message to the 'results_live' topic so all app
// clients immediately discard their cached results and fetch fresh data.
// No visible notification is shown to users.
const SCRAPER_SECRET = process.env.SCRAPER_SECRET;

exports.notifyResultsUpdate = onRequest(
  {secrets: ['SCRAPER_SECRET']},
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
    if (!SCRAPER_SECRET || req.headers['x-scraper-secret'] !== SCRAPER_SECRET) {
      res.status(401).send('Unauthorized'); return;
    }
    const year = String(req.body?.year || '2026');
    try {
      await getMessaging().send({
        topic: 'results_live',
        data: {type: 'results_refresh', year},
        // content_available wakes iOS apps that are backgrounded
        apns: {payload: {aps: {'content-available': 1}}},
        android: {priority: 'high'},
      });
      console.log(`notifyResultsUpdate: sent results_refresh for year=${year}`);
      res.status(200).json({ok: true});
    } catch (e) {
      console.error('notifyResultsUpdate failed:', e);
      await logError('notifyResultsUpdate', e.message, e, {alert: true});
      res.status(500).json({ok: false, error: e.message});
    }
  },
);

exports.commentReact = onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const {commentId, prev, next} = req.body || {};
  const valid = [null, 'likes', 'dislikes'];
  if (!commentId || !valid.includes(prev) || !valid.includes(next) || prev === next) {
    res.status(400).json({ok: false, error: 'Invalid request'}); return;
  }

  const updates = {};
  if (prev === 'likes')    updates.likes    = FieldValue.increment(-1);
  if (prev === 'dislikes') updates.dislikes = FieldValue.increment(-1);
  if (next === 'likes')    updates.likes    = FieldValue.increment(1);
  if (next === 'dislikes') updates.dislikes = FieldValue.increment(1);

  try {
    await getFirestore().collection('article_comments').doc(commentId).update(updates);
    res.status(200).json({ok: true});
  } catch (e) {
    console.error('commentReact error:', e);
    res.status(500).json({ok: false, error: e.message});
  }
});

// ── Ask Colin (AI Q&A) ────────────────────────────────────────
const ASK_RATE_LIMIT = 5;   // max requests
const ASK_RATE_WINDOW = 10 * 60 * 1000; // per 10 minutes

exports.askBtccAi = onRequest(
  {region: 'europe-west1', secrets: ['ANTHROPIC_API_KEY'], cors: false},
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).json({error: 'Method Not Allowed'}); return; }

    const question = (req.body?.question ?? '').trim();
    if (!question || question.length > 500) {
      res.status(400).json({error: 'Question must be between 1 and 500 characters'}); return;
    }

    // Rate limit by IP: ASK_RATE_LIMIT requests per ASK_RATE_WINDOW
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
    const db = getFirestore();
    const rateLimitRef = db.collection('rate_limits').doc(`ask_${ip.replace(/[^a-z0-9]/gi, '_')}`);
    try {
      const now = Date.now();
      const limited = await db.runTransaction(async tx => {
        const doc = await tx.get(rateLimitRef);
        const data = doc.exists ? doc.data() : {count: 0, windowStart: now};
        const windowExpired = now - data.windowStart > ASK_RATE_WINDOW;
        const count = windowExpired ? 1 : data.count + 1;
        const windowStart = windowExpired ? now : data.windowStart;
        tx.set(rateLimitRef, {count, windowStart});
        return count > ASK_RATE_LIMIT;
      });
      if (limited) { res.status(429).json({error: 'Too many requests. Please wait a few minutes.'}); return; }
    } catch (e) {
      console.error('askBtccAi rate limit error:', e);
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({apiKey: process.env.ANTHROPIC_API_KEY});

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: `You are Colin, a BTCC (British Touring Car Championship) expert assistant inside the official BTCC Hub app. You are named after Colin Turkington, the 4x BTCC champion. Answer questions about BTCC only - drivers, teams, tracks, results, history, regulations and race format. Be concise and factual. Use British English. Never use em dashes. Never use a comma before "and". If the question is not related to BTCC, respond with exactly: "I can only answer questions about the BTCC."`,
        messages: [{role: 'user', content: question}],
      });
      res.status(200).json({answer: response.content[0].text});
    } catch (e) {
      console.error('askBtccAi error:', e);
      res.status(500).json({error: 'Failed to get a response. Please try again.'});
    }
  },
);

// ── Magic link email ──────────────────────────────────────────────────────────
// Generates a Firebase Auth sign-in link and sends a branded HTML email.
// Called instead of client-side sendSignInLinkToEmail so we control the email.
exports.sendMagicLinkEmail = onRequest(
  {region: 'europe-west1', secrets: ['GMAIL_APP_PASSWORD'], cors: false},
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).json({error: 'Method not allowed'}); return; }

    const email = (req.body?.email ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({error: 'Invalid email address'}); return;
    }

    const actionCodeSettings = {
      url: 'https://btcchub-af77a.firebaseapp.com',
      handleCodeInApp: true,
      iOS: {bundleId: 'com.btcchub.app'},
      android: {packageName: 'com.btccfanhub', installIfNotAvailable: false},
    };

    let link;
    try {
      link = await getAuth().generateSignInWithEmailLink(email, actionCodeSettings);
    } catch (e) {
      console.error('sendMagicLinkEmail generateLink error:', e);
      res.status(500).json({error: e.code || 'Failed to generate link'}); return;
    }

    const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>
:root { color-scheme: light only; supported-color-schemes: light only; }
@media (prefers-color-scheme: dark) {
  .email-body { background:#f0f0f5 !important; }
  .card-header { background:#020255 !important; }
  .card-body { background:#ffffff !important; color:#444444 !important; }
  .stripe { background:#FEBD02 !important; }
  .btn td { background:#FEBD02 !important; }
  .btn a { color:#080912 !important; }
  h2 { color:#080912 !important; }
  .body-text { color:#444444 !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#f0f0f5;">
<div class="email-body" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f0f0f5;margin:0;padding:24px 12px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
  <tr>
    <td class="card-header" style="background:#020255;padding:32px 40px;text-align:center;border-radius:12px 12px 0 0;">
      <img src="https://btcchub-af77a.firebaseapp.com/logo.png" width="200" alt="BTCC Hub" style="display:block;margin:0 auto;" />
    </td>
  </tr>
  <tr><td class="stripe" style="background:#FEBD02;height:4px;font-size:1px;line-height:1px;">&nbsp;</td></tr>
  <tr>
    <td class="card-body" style="background:#ffffff;padding:40px 40px 32px;border-radius:0 0 12px 12px;">
      <h2 style="color:#080912;font-size:20px;font-weight:700;margin:0 0 12px 0;">Sign in to BTCC Hub</h2>
      <p class="body-text" style="color:#444444;font-size:15px;line-height:1.6;margin:0 0 32px 0;">
        Tap the button below to sign in. This link expires in 1 hour and can only be used once - no password needed.
      </p>
      <table class="btn" cellpadding="0" cellspacing="0" style="margin:0 0 32px 0;">
        <tr>
          <td style="background:#FEBD02;border-radius:8px;">
            <a href="btccfanhub://magic-link?link=${encodeURIComponent(link)}" style="display:inline-block;padding:14px 36px;color:#080912;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">Sign in to BTCC Hub &rarr;</a>
          </td>
        </tr>
      </table>
      <p style="color:#999999;font-size:12px;line-height:1.5;margin:0 0 8px 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
      <p style="color:#bbbbbb;font-size:11px;line-height:1.5;margin:0;word-break:break-all;">
        Link not working? Copy and paste into your browser:<br/>
        <a class="fallback-link" href="${link}" style="color:#020255;">${link}</a>
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 0;text-align:center;">
      <p style="color:#aaaaaa;font-size:11px;margin:0;">BTCC Hub &middot; Not affiliated with the official BTCC</p>
    </td>
  </tr>
</table>
</div>
</body>
</html>`;

    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {user: 'btcchub@gmail.com', pass: process.env.GMAIL_APP_PASSWORD},
      });
      await transporter.sendMail({
        from: '"BTCC Hub" <btcchub@gmail.com>',
        to: email,
        subject: 'Sign in to BTCC Hub',
        html,
      });
      res.status(200).json({ok: true});
    } catch (e) {
      console.error('sendMagicLinkEmail send error:', e);
      res.status(500).json({error: 'Failed to send email'});
    }
  },
);
