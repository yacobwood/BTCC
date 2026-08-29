const {onValueCreated} = require('firebase-functions/v2/database');
const {onRequest} = require('firebase-functions/v2/https');
const {getMessaging} = require('firebase-admin/messaging');
const {getDatabaseWithUrl} = require('firebase-admin/database');
const {getAuth} = require('firebase-admin/auth');
const {resolveMentionedAuthorIds} = require('./chatMentions');
const {selectMessagesToTrim} = require('./chatTrim');
const {requireAdminPost} = require('./shared');

const CHAT_DB_URL = 'https://btcchub-af77a-default-rtdb.europe-west1.firebasedatabase.app';
const getChatDb = () => getDatabaseWithUrl(CHAT_DB_URL);

// Apply ban: hide all existing messages from the banned author and write a system notice
exports.onChatBan = onValueCreated(
  {ref: '/chat/bans/{authorId}', region: 'europe-west1', instance: 'btcchub-af77a-default-rtdb'},
  async (event) => {
    try {
      const authorId = event.params.authorId;
      const ban = event.data.val();
      const messagesRef = getChatDb().ref('/chat/messages');

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
      const messaging = getMessaging();
      const staleTokenUpdates = {};
      const body = msg.text.length > 100 ? `${msg.text.slice(0, 97)}...` : msg.text;

      await Promise.all(mentionedIds.map(async authorId => {
        const token = tokens[authorId];
        if (!token) return;
        try {
          await messaging.send({
            token,
            notification: {
              title: 'You were mentioned in Live Chat',
              body: `${msg.authorName}: ${body}`,
            },
            data: {type: 'chat'},
            android: {notification: {channelId: 'chat_mentions'}},
          });
        } catch (e) {
          // Device uninstalled the app or the token otherwise rotated out from
          // under us - drop it so future mentions don't keep retrying a dead token.
          if (e.code === 'messaging/registration-token-not-registered' || e.code === 'messaging/invalid-registration-token') {
            staleTokenUpdates[authorId] = null;
          } else {
            console.error('onChatMention send failed for', authorId, e.message);
          }
        }
      }));

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
