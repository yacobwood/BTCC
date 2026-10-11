const {onValueCreated} = require('firebase-functions/v2/database');
const {onRequest} = require('firebase-functions/v2/https');
const {getMessaging} = require('firebase-admin/messaging');
const {getDatabaseWithUrl} = require('firebase-admin/database');
const {getAuth} = require('firebase-admin/auth');
const {getFirestore} = require('firebase-admin/firestore');
const {resolveMentionedAuthorIds} = require('./chatMentions');
const {selectMessagesToTrim} = require('./chatTrim');
const {requireAdminPost, logPushHistory} = require('./shared');

const CHAT_DB_URL = 'https://btcchub-af77a-default-rtdb.europe-west1.firebasedatabase.app';
const getChatDb = () => getDatabaseWithUrl(CHAT_DB_URL);

// Active = exists and either permanent (no expiresAt) or not yet expired.
const isBanActive = (ban, now = Date.now()) => !!ban && (!ban.expiresAt || ban.expiresAt > now);

// Apply ban: write a system notice, and deal with the author's existing
// messages per the admin's choice (ban.messageAction):
//   'keep' (default, also any ban written before the option existed) - leave them
//   'obscure' - leave them; the app collapses them behind tap-to-show while the ban is active
//   'remove' - hide them (hidden: true), the original pre-2026-10-11 behaviour
exports.onChatBan = onValueCreated(
  {ref: '/chat/bans/{authorId}', region: 'europe-west1', instance: 'btcchub-af77a-default-rtdb'},
  async (event) => {
    try {
      const authorId = event.params.authorId;
      const ban = event.data.val();
      const messagesRef = getChatDb().ref('/chat/messages');

      if (ban.messageAction === 'remove') {
        const snap = await messagesRef.orderByChild('authorId').equalTo(authorId).once('value');
        const updates = {};
        snap.forEach(c => { updates[`${c.key}/hidden`] = true; });
        if (Object.keys(updates).length > 0) await messagesRef.update(updates);
      }

      // A ban carried over to a new account on an already-banned device
      // (onChatDeviceRegistered) stays quiet - that account has usually
      // never posted, so a public notice would only tip them off.
      if (ban.linkedFrom) return;

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

const BAN_DURATIONS_MS = {'1h': 3600000, '24h': 86400000, '7d': 604800000, permanent: null};
const MESSAGE_ACTIONS = ['keep', 'obscure', 'remove'];

// Admin-only ban. /chat/bans is no longer client-writable (database.rules.json),
// so the admin panel goes through here instead of a raw RTDB PUT - before
// 2026-10-11 anyone could delete their own ban with one REST call. Also bans
// the user's device (/chat/devices/{uid}, registered by the app since
// 2026-10-11) so a reinstall - which gets a fresh anonymous uid - stays
// banned: see onChatDeviceRegistered. Older app builds never registered a
// device, so deviceBanned comes back false for them.
exports.banChatUser = onRequest(
  {secrets: ['ADMIN_SECRET'], cors: ['https://yacobwood.github.io']},
  async (req, res) => {
    if (requireAdminPost(req, res)) return;

    const {authorId, authorName, duration, messageAction = 'keep', reportId} = req.body || {};
    if (!authorId) { res.status(400).json({ok: false, error: 'authorId required'}); return; }
    if (!(duration in BAN_DURATIONS_MS)) { res.status(400).json({ok: false, error: 'invalid duration'}); return; }
    if (!MESSAGE_ACTIONS.includes(messageAction)) { res.status(400).json({ok: false, error: 'invalid messageAction'}); return; }

    try {
      const db = getChatDb();
      const [deviceSnap, reportSnap] = await Promise.all([
        db.ref(`/chat/devices/${authorId}`).once('value'),
        reportId ? db.ref(`/chat/reports/${reportId}`).once('value') : Promise.resolve(null),
      ]);
      const deviceId = deviceSnap.val();
      const now = Date.now();
      const ms = BAN_DURATIONS_MS[duration];
      const expiresAt = ms !== null ? now + ms : null;

      const ban = {bannedAt: now, expiresAt, duration, authorName: authorName || authorId, messageAction, deviceBanned: !!deviceId};
      // Kept on the ban so unbanning can put the report back in the queue.
      if (reportSnap?.val()) ban.reportData = reportSnap.val();

      const updates = {[`bans/${authorId}`]: ban};
      if (deviceId) updates[`deviceBans/${deviceId}`] = {authorId, bannedAt: now, expiresAt, duration};
      if (reportId) updates[`reports/${reportId}`] = null;
      await db.ref('/chat').update(updates);
      res.status(200).json({ok: true, deviceBanned: !!deviceId});
    } catch (e) {
      console.error('banChatUser failed:', e);
      res.status(500).json({ok: false, error: e.message});
    }
  },
);

// Admin-only unban: removes the ban, its device ban and any bans it was
// carried over to on new accounts, and puts the original report back.
exports.unbanChatUser = onRequest(
  {secrets: ['ADMIN_SECRET'], cors: ['https://yacobwood.github.io']},
  async (req, res) => {
    if (requireAdminPost(req, res)) return;

    const {authorId} = req.body || {};
    if (!authorId) { res.status(400).json({ok: false, error: 'authorId required'}); return; }

    try {
      const db = getChatDb();
      const [banSnap, deviceBansSnap, linkedSnap] = await Promise.all([
        db.ref(`/chat/bans/${authorId}`).once('value'),
        db.ref('/chat/deviceBans').orderByChild('authorId').equalTo(authorId).once('value'),
        db.ref('/chat/bans').orderByChild('linkedFrom').equalTo(authorId).once('value'),
      ]);
      const ban = banSnap.val();
      const updates = {[`bans/${authorId}`]: null};
      deviceBansSnap.forEach(c => { updates[`deviceBans/${c.key}`] = null; });
      linkedSnap.forEach(c => { updates[`bans/${c.key}`] = null; });
      if (ban?.reportData) updates[`reports/${db.ref('/chat/reports').push().key}`] = ban.reportData;
      await db.ref('/chat').update(updates);
      res.status(200).json({ok: true});
    } catch (e) {
      console.error('unbanChatUser failed:', e);
      res.status(500).json({ok: false, error: e.message});
    }
  },
);

// Ban evasion: when an account registers a device that is already banned
// (a reinstall gets a new anonymous uid but the same device id), copy the
// ban onto the new account. database.rules.json already refuses messages
// from a banned device directly; this copy is what makes the app show the
// banned state, onChatMention skip them and the admin list show them.
exports.onChatDeviceRegistered = onValueCreated(
  {ref: '/chat/devices/{authorId}', region: 'europe-west1', instance: 'btcchub-af77a-default-rtdb'},
  async (event) => {
    try {
      const authorId = event.params.authorId;
      const deviceId = event.data.val();
      if (!deviceId) return;
      const db = getChatDb();
      const [deviceBanSnap, existingSnap, nameSnap] = await Promise.all([
        db.ref(`/chat/deviceBans/${deviceId}`).once('value'),
        db.ref(`/chat/bans/${authorId}`).once('value'),
        db.ref(`/chat/authorNames/${authorId}`).once('value'),
      ]);
      const deviceBan = deviceBanSnap.val();
      if (!isBanActive(deviceBan) || deviceBan.authorId === authorId) return;
      if (isBanActive(existingSnap.val())) return;
      await db.ref(`/chat/bans/${authorId}`).set({
        bannedAt: Date.now(),
        expiresAt: deviceBan.expiresAt || null,
        duration: deviceBan.duration,
        authorName: nameSnap.val() || `Fan #${authorId.slice(-4)}`,
        messageAction: 'keep',
        linkedFrom: deviceBan.authorId,
      });
    } catch (e) {
      console.error('onChatDeviceRegistered failed:', e);
    }
  },
);

// Notify a mentioned user (@DisplayName) when a new chat message tags them.
// Mention resolution is plain-text against the live /chat/authorNames map
// (see chatMentions.js) rather than a structured mention field, since
// tagging is composed as free text via the reply button's "@Name " prefill
// (ChatScreen.js handleReply) with no dedicated compose UI. Delivery is a
// single targeted FCM send to the device token the mentioned user's app
// last registered at /chat/deviceTokens/{authorId} (written by
// syncChatMentionToken in src/utils/notifications.js) - unlike every other
// notification in this app, which is a topic broadcast.
exports.onChatMention = onValueCreated(
  {ref: '/chat/messages/{msgId}', region: 'europe-west1', instance: 'btcchub-af77a-default-rtdb'},
  async (event) => {
    try {
      const msg = event.data.val();
      if (!msg || msg.type === 'ban_notice' || !msg.text || !msg.text.includes('@')) return;

      const db = getChatDb();
      const namesSnap = await db.ref('/chat/authorNames').once('value');
      const mentionedIds = resolveMentionedAuthorIds(msg.text, namesSnap.val(), msg.authorId);
      if (mentionedIds.length === 0) return;

      const tokensSnap = await db.ref('/chat/deviceTokens').once('value');
      const tokens = tokensSnap.val() || {};
      // A banned sender never notifies anyone. The app blocks banned users
      // from posting, but bans are per uid and the database rules only
      // started enforcing them on 2026-10-11 - this is the backstop.
      const banSnap = await db.ref(`/chat/bans/${msg.authorId}`).once('value');
      if (isBanActive(banSnap.val())) {
        await logPushHistory('You were mentioned in Live Chat', '', 'chat_mentions', {
          source: 'chatMention', target: 'token', senderId: msg.authorId, mentioned: mentionedIds.length, skippedBanned: true, ok: true,
        });
        return;
      }
      const messaging = getMessaging();
      const staleTokenUpdates = {};
      const body = msg.text.length > 100 ? `${msg.text.slice(0, 97)}...` : msg.text;
      // Counts plus sender only for push_history - no message text or
      // recipient IDs. senderId (added 2026-10-11) is what ties a mention
      // push back to a user after they delete the message itself.
      const counts = {sent: 0, failed: 0, skippedSpoiler: 0, noToken: 0};

      await Promise.all(mentionedIds.map(async authorId => {
        const token = tokens[authorId];
        if (!token) { counts.noToken++; return; }
        // Spoiler mode = no notifications at all, and a chat message can
        // easily name a winner. The app also removes its token while
        // spoiler mode is on, but builds released before 2026-10-10 don't,
        // so check the synced profile too (signed-in users only - anonymous
        // users have no profile). Fails toward silence if the read errors.
        try {
          const profile = await getFirestore().collection('users').doc(authorId).get();
          if (profile.exists && profile.data().spoilerFree === true) { counts.skippedSpoiler++; return; }
        } catch (e) {
          console.error('onChatMention spoiler check failed, skipping', authorId, e.message);
          counts.skippedSpoiler++;
          return;
        }
        try {
          const title = 'You were mentioned in Live Chat';
          const notifBody = `${msg.authorName}: ${body}`;
          await messaging.send({
            token,
            // No top-level `notification` block: Android would display it
            // without running any app code, bypassing the spoiler-mode gate
            // in displayAndroidDataNotification. iOS gets its alert via apns.
            apns: {payload: {aps: {sound: 'default', alert: {title, body: notifBody}}}},
            // title/body/channel mirrored into data - the OS auto-displays
            // the notification block above when the recipient's app is
            // backgrounded/killed, but the foreground JS path
            // (displayAndroidDataNotification, src/utils/notifications.js)
            // only ever reads from data and silently drops anything missing
            // data.title. Root-caused live 2026-09-07/09-09 after a user
            // reported being @mentioned with no push received while
            // presumably in the app (the state most likely to hit this,
            // since being tagged in chat requires being active in it) - see
            // project_chat_mention_foreground_android_notification_gap
            // memory. Same gap existed on weekend_preview/standings_update/
            // session alerts/results_teaser - fixed alongside this, not in
            // isolation.
            data: {type: 'chat', title, body: notifBody, channel: 'chat_mentions'},
            android: {priority: 'high'},
          });
          counts.sent++;
        } catch (e) {
          counts.failed++;
          // Device uninstalled the app or the token otherwise rotated out from
          // under us - drop it so future mentions don't keep retrying a dead token.
          if (e.code === 'messaging/registration-token-not-registered' || e.code === 'messaging/invalid-registration-token') {
            staleTokenUpdates[authorId] = null;
          } else {
            console.error('onChatMention send failed for', authorId, e.message);
          }
        }
      }));

      await logPushHistory('You were mentioned in Live Chat', '', 'chat_mentions', {
        source: 'chatMention', target: 'token', senderId: msg.authorId, mentioned: mentionedIds.length, ...counts, ok: counts.failed === 0,
      });

      if (Object.keys(staleTokenUpdates).length > 0) {
        await db.ref('/chat/deviceTokens').update(staleTokenUpdates);
      }
    } catch (e) {
      console.error('onChatMention failed:', e);
    }
  },
);

// Flag or unflag a chat participant as a supporter (Buy Me a Coffee donor),
// admin-triggered from the standings admin panel after manually matching a
// donation notification against a claimed chat display name (donation
// volume doesn't justify building webhook-based auto-matching yet - see
// .claude/plans/can-we-gamify-buy-sleepy-hopcroft.md). Uses the Admin SDK
// to bypass /chat/donors' client-proof ".write": false rule, rather than a
// raw RTDB PUT like the admin panel's banUser does against /chat/bans -
// that open-write pattern is a known, separate issue and donors
// deliberately does not repeat it.
exports.setChatDonor = onRequest(
  {secrets: ['ADMIN_SECRET'], cors: ['https://yacobwood.github.io']},
  async (req, res) => {
    if (requireAdminPost(req, res)) return;

    const {authorId, isDonor} = req.body || {};
    if (!authorId) { res.status(400).json({ok: false, error: 'authorId required'}); return; }

    try {
      const ref = getChatDb().ref(`/chat/donors/${authorId}`);
      if (isDonor) {
        await ref.set(true);
      } else {
        await ref.remove();
      }
      res.status(200).json({ok: true});
    } catch (e) {
      console.error('setChatDonor failed:', e);
      res.status(500).json({ok: false, error: e.message});
    }
  },
);

// Admin lookup: given an email, resolve the Firebase Auth account (if any)
// and fold in everything else the admin panel already tracks by authorId -
// chat display name, donor badge, active ban - in one call, so an admin
// working from a support email or a Buy Me a Coffee receipt doesn't have to
// separately guess a chat display name (the fragile path setChatDonor's own
// UI otherwise relies on - see markSupporter()'s comment in the admin page).
exports.lookupUserByEmail = onRequest(
  {secrets: ['ADMIN_SECRET'], cors: ['https://yacobwood.github.io']},
  async (req, res) => {
    if (requireAdminPost(req, res)) return;

    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email) { res.status(400).json({ok: false, error: 'email required'}); return; }

    try {
      const user = await getAuth().getUserByEmail(email);
      const db = getChatDb();
      const [nameSnap, donorSnap, banSnap] = await Promise.all([
        db.ref(`/chat/authorNames/${user.uid}`).once('value'),
        db.ref(`/chat/donors/${user.uid}`).once('value'),
        db.ref(`/chat/bans/${user.uid}`).once('value'),
      ]);
      const ban = banSnap.val();
      const activeBan = (ban && (!ban.expiresAt || ban.expiresAt > Date.now())) ? ban : null;
      res.status(200).json({
        ok: true,
        uid: user.uid,
        email: user.email || null,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
        chatDisplayName: nameSnap.val() || null,
        isDonor: !!donorSnap.val(),
        activeBan,
      });
    } catch (e) {
      if (e.code === 'auth/user-not-found') { res.status(404).json({ok: false, error: 'No account found'}); return; }
      console.error('lookupUserByEmail failed:', e);
      res.status(500).json({ok: false, error: e.message});
    }
  },
);

// Trim live chat: keep only the newest 200 messages, and drop anything
// older than 14 days regardless of count (see chatTrim.js for the rule).
// Event-driven off new messages, same as the count-only version before it -
// during a genuinely quiet stretch with no new posts, cleanup of anything
// that ages past 14 days waits for the next message to arrive and trigger
// this again, rather than running on its own schedule.
exports.trimChat = onValueCreated(
  {ref: '/chat/messages/{msgId}', region: 'europe-west1', instance: 'btcchub-af77a-default-rtdb'},
  async () => {
    try {
      const ref = getChatDb().ref('/chat/messages');
      const snap = await ref.orderByChild('timestamp').once('value');
      const entries = [];
      snap.forEach(c => entries.push({key: c.key, timestamp: c.val()?.timestamp || 0}));
      const keysToDelete = selectMessagesToTrim(entries, Date.now());
      if (keysToDelete.length > 0) {
        const updates = {};
        keysToDelete.forEach(k => { updates[k] = null; });
        await ref.update(updates);
      }
    } catch (e) {
      console.error('trimChat failed:', e);
    }
  },
);
