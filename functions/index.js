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
          shouldNotify = false; notifyPayload = null;
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
      const latestHub = hubData?.posts?.find(p => !p.status || p.status === 'published');
      if (latestHub) {
        const hubStateRef = db.collection('state').doc('hub_news');
        let shouldNotify = false;
        let notifyPayload = null;
        await db.runTransaction(async (tx) => {
          shouldNotify = false; notifyPayload = null;
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
          shouldNotify = false; podTitle = null;
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

// ── Shared digest logic ───────────────────────────────────────
async function runDigest(label, promptIntro) {
  const messaging = getMessaging();
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
  const fileRes = await fetch(GITHUB_API, {headers: ghHeaders});
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
    const res = await fetch(
      'https://www.reddit.com/r/BTCC/top.json?t=week&limit=30',
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
    const posts = await fetch(
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
      const text = await fetch(url).then(r => r.text());
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
    content = parsed.content || content;
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
  const putRes = await fetch(GITHUB_API, {
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

  // ── Notify admin ────────────────────────────────────────────
  try {
    await messaging.send({
      topic: 'digest_ready',
      notification: {title: 'Weekly Digest Ready', body: title},
      android: {notification: {channelId: 'news'}},
      apns: {payload: {aps: {sound: 'default'}}},
      data: {type: 'hub', id: postId, channel: 'news', title},
    });
  } catch (e) {
    console.error(`${label}: notification failed:`, e);
  }

  console.log(`${label}: digest committed for ${today}: ${title}`);
}

// ── Weekly digest — every Monday at 8am ──────────────────────
exports.weeklyDigest = onSchedule(
  {
    schedule: '0 8 * * 1',
    timeZone: 'Europe/London',
    secrets: ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN'],
  },
  () => runDigest(
    'weeklyDigest',
    `You are a passionate, opinionated British BTCC fan writing a weekly round-up for the BTCC Hub fan app. ` +
    `Write like someone who was glued to their TV or at the circuit all weekend — not a journalist, not a press release. ` +
    `Use British English throughout. ` +
    `Cover the past 7 days: race results, driver performances, team news, championship picture, fan reaction and anything else worth talking about. ` +
    `Write 5 to 7 paragraphs. Each paragraph should have a clear focus. Mix short punchy sentences with the occasional longer one for rhythm. ` +
    `Have opinions — say who impressed you, who disappointed, what surprised you. ` +
    `Write the body in HTML using <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li> and <a> tags as appropriate — no images. ` +
    `Do not include the title in the body.\n\n`,
  ),
);

// ── Race weekend preview digest — every Thursday at 8am ──────
// Only runs if there is a BTCC round starting that Saturday.
exports.raceWeekendDigest = onSchedule(
  {
    schedule: '0 8 * * 4',
    timeZone: 'Europe/London',
    secrets: ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN'],
  },
  async () => {
    const now = new Date();
    const saturdayStr = getUKDateString(now, 2); // Thursday + 2 = Saturday
    const calendar = await fetch(CALENDAR_URL).then(r => r.json());
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
      `Do not include the title in the body.\n\n`,
    );
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
