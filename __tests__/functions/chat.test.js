const {makeReq, makeRes, makeFirestoreMock, makeDatabaseMock, makeMessagingMock, makeAuthMock} = require('./testHelpers');

const ADMIN_SECRET = 'test-admin-secret';

const {db: mockDatabaseDb, ref: mockDatabaseRef} = makeDatabaseMock();
jest.mock('firebase-admin/database', () => ({
  getDatabaseWithUrl: jest.fn(() => mockDatabaseDb),
}), {virtual: true});

const mockMessaging = makeMessagingMock();
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => mockMessaging),
}), {virtual: true});

const {db: mockFirestoreDb, docRef: mockFirestoreDocRef} = makeFirestoreMock();
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockFirestoreDb),
}), {virtual: true});

const mockAuth = makeAuthMock();
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => mockAuth),
}), {virtual: true});

const mockLogPushHistory = jest.fn(() => Promise.resolve());
jest.mock('../../functions/shared', () => ({
  logPushHistory: (...args) => mockLogPushHistory(...args),
  ADMIN_SECRET: 'test-admin-secret',
  requireAdminPost: (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return true; }
    if (req.headers['x-admin-secret'] !== 'test-admin-secret') { res.status(401).send('Unauthorized'); return true; }
    return false;
  },
}));

jest.mock('../../functions/chatMentions', () => ({
  resolveMentionedAuthorIds: jest.fn(),
}));

jest.mock('../../functions/chatTrim', () => ({
  selectMessagesToTrim: jest.fn(),
}));

const {onChatBan, onChatMention, setChatDonor, lookupUserByEmail, trimChat, banChatUser, unbanChatUser, onChatDeviceRegistered} = require('../../functions/chat');
const {resolveMentionedAuthorIds} = require('../../functions/chatMentions');
const {selectMessagesToTrim} = require('../../functions/chatTrim');

// onValueCreated/onSchedule-wrapped exports expose the raw handler at .run()
// (see firebase-functions v2's own database.js/scheduler.js source - func.run
// = handler), which is far simpler to drive in a test than reconstructing a
// full raw CloudEvent through the public wrapper. onRequest exports the same
// way, but Batch A's scraperAdmin tests already validated calling those
// directly as (req, res) through the real cors middleware, so this file only
// needs .run() for the two onValueCreated functions below.

describe('onChatBan', () => {
  beforeEach(() => jest.clearAllMocks());

  it('with messageAction remove, hides every message from the banned author and posts a ban_notice', async () => {
    const bannedMessages = {forEach: cb => { cb({key: 'msg-1'}); cb({key: 'msg-2'}); }};
    mockDatabaseRef.once.mockResolvedValueOnce({val: () => null, forEach: bannedMessages.forEach});

    const event = {
      params: {authorId: 'author-xyz'},
      data: {val: () => ({authorName: 'Gordon', duration: '24h', bannedAt: 1000, expiresAt: 2000, messageAction: 'remove'})},
    };
    await onChatBan.run(event);

    expect(mockDatabaseRef.update).toHaveBeenCalledWith({'msg-1/hidden': true, 'msg-2/hidden': true});
    expect(mockDatabaseRef.push).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Gordon has been banned for 24h.',
      type: 'ban_notice',
    }));
  });

  it.each([['keep'], ['obscure'], [undefined]])('with messageAction %s, leaves existing messages untouched but still posts the notice', async (messageAction) => {
    const event = {
      params: {authorId: 'author-xyz'},
      data: {val: () => ({authorName: 'Gordon', duration: '24h', bannedAt: 1000, expiresAt: 2000, messageAction})},
    };
    await onChatBan.run(event);
    expect(mockDatabaseRef.once).not.toHaveBeenCalled();
    expect(mockDatabaseRef.update).not.toHaveBeenCalled();
    expect(mockDatabaseRef.push).toHaveBeenCalledWith(expect.objectContaining({type: 'ban_notice'}));
  });

  it('phrases a permanent ban without "for"', async () => {
    const event = {
      params: {authorId: 'author-xyz'},
      data: {val: () => ({authorName: 'Gordon', duration: 'permanent', bannedAt: 1000, expiresAt: null})},
    };
    await onChatBan.run(event);
    expect(mockDatabaseRef.push).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Gordon has been banned permanently.',
    }));
  });

  it('does not throw if the database call fails (caught and logged)', async () => {
    mockDatabaseRef.once.mockRejectedValueOnce(new Error('rtdb down'));
    const event = {params: {authorId: 'x'}, data: {val: () => ({authorName: 'X', duration: '1h', messageAction: 'remove'})}};
    await expect(onChatBan.run(event)).resolves.toBeUndefined();
  });
});

describe('onChatBan linked (ban evasion) bans', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts no public notice for a ban carried over from a banned device', async () => {
    const event = {params: {authorId: 'new-uid'}, data: {val: () => ({authorName: 'Fan #abcd', duration: '24h', linkedFrom: 'old-uid', messageAction: 'keep'})}};
    await onChatBan.run(event);
    expect(mockDatabaseRef.push).not.toHaveBeenCalled();
  });
});

describe('banChatUser', () => {
  beforeEach(() => jest.clearAllMocks());
  const post = body => makeReq({method: 'POST', headers: {'x-admin-secret': ADMIN_SECRET}, body});

  it('rejects a request without the correct admin secret', async () => {
    const res = makeRes();
    await banChatUser(makeReq({method: 'POST', headers: {'x-admin-secret': 'wrong'}, body: {authorId: 'a', duration: '24h'}}), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockDatabaseRef.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown duration or message action', async () => {
    let res = makeRes();
    await banChatUser(post({authorId: 'a', duration: '2y'}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    res = makeRes();
    await banChatUser(post({authorId: 'a', duration: '24h', messageAction: 'nuke'}), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('writes the ban, bans the registered device and clears the report in one update', async () => {
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => 'device-abc'}) // devices/{uid}
      .mockResolvedValueOnce({val: () => ({flaggedMessage: {text: 'x'}, reportedAt: 1})}); // reports/{id}
    const res = makeRes();
    await banChatUser(post({authorId: 'troll', authorName: 'Troll', duration: '24h', messageAction: 'obscure', reportId: 'rep-1'}), res);

    const updates = mockDatabaseRef.update.mock.calls[0][0];
    expect(updates['bans/troll']).toEqual(expect.objectContaining({
      authorName: 'Troll', duration: '24h', messageAction: 'obscure', deviceBanned: true, reportData: {flaggedMessage: {text: 'x'}, reportedAt: 1},
    }));
    expect(updates['bans/troll'].expiresAt - updates['bans/troll'].bannedAt).toBe(86400000);
    expect(updates['deviceBans/device-abc']).toEqual(expect.objectContaining({authorId: 'troll', duration: '24h'}));
    expect(updates['reports/rep-1']).toBeNull();
    expect(res.json).toHaveBeenCalledWith({ok: true, deviceBanned: true});
  });

  it('still bans by uid when the device is unknown (older app), and says so', async () => {
    const res = makeRes();
    await banChatUser(post({authorId: 'troll', duration: 'permanent'}), res);
    const updates = mockDatabaseRef.update.mock.calls[0][0];
    expect(updates['bans/troll']).toEqual(expect.objectContaining({expiresAt: null, messageAction: 'keep', deviceBanned: false}));
    expect(Object.keys(updates).some(k => k.startsWith('deviceBans/'))).toBe(false);
    expect(res.json).toHaveBeenCalledWith({ok: true, deviceBanned: false});
  });
});

describe('unbanChatUser', () => {
  beforeEach(() => jest.clearAllMocks());
  const post = body => makeReq({method: 'POST', headers: {'x-admin-secret': ADMIN_SECRET}, body});

  it('removes the ban, its device bans and carried-over bans, and restores the report', async () => {
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({reportData: {reportedAt: 5}})}) // bans/{uid}
      .mockResolvedValueOnce({forEach: cb => cb({key: 'device-abc'})}) // deviceBans by authorId
      .mockResolvedValueOnce({forEach: cb => cb({key: 'evader-uid'})}); // bans by linkedFrom
    mockDatabaseRef.push.mockReturnValueOnce({key: 'new-rep'});
    const res = makeRes();
    await unbanChatUser(post({authorId: 'troll'}), res);

    expect(mockDatabaseRef.update).toHaveBeenCalledWith({
      'bans/troll': null,
      'deviceBans/device-abc': null,
      'bans/evader-uid': null,
      'reports/new-rep': {reportedAt: 5},
    });
    expect(res.json).toHaveBeenCalledWith({ok: true});
  });
});

describe('onChatDeviceRegistered', () => {
  beforeEach(() => jest.clearAllMocks());
  const event = {params: {authorId: 'new-uid'}, data: {val: () => 'device-abc'}};

  it('carries an active device ban over to a new account on that device, quietly', async () => {
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({authorId: 'old-uid', duration: '24h', expiresAt: Date.now() + 60000})})
      .mockResolvedValueOnce({val: () => null})
      .mockResolvedValueOnce({val: () => 'Sneaky'});
    await onChatDeviceRegistered.run(event);
    expect(mockDatabaseRef.set).toHaveBeenCalledWith(expect.objectContaining({
      authorName: 'Sneaky', duration: '24h', linkedFrom: 'old-uid', messageAction: 'keep',
    }));
  });

  it('does nothing for an expired device ban, a clean device or the originally banned account', async () => {
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({authorId: 'old-uid', duration: '1h', expiresAt: Date.now() - 1000})})
      .mockResolvedValueOnce({val: () => null})
      .mockResolvedValueOnce({val: () => null});
    await onChatDeviceRegistered.run(event);
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => null})
      .mockResolvedValueOnce({val: () => null})
      .mockResolvedValueOnce({val: () => null});
    await onChatDeviceRegistered.run(event);
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({authorId: 'new-uid', duration: '24h', expiresAt: null})})
      .mockResolvedValueOnce({val: () => null})
      .mockResolvedValueOnce({val: () => null});
    await onChatDeviceRegistered.run(event);
    expect(mockDatabaseRef.set).not.toHaveBeenCalled();
  });
});

describe('onChatMention', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing if the message has no "@" at all', async () => {
    const event = {data: {val: () => ({text: 'no mentions here', authorId: 'a', authorName: 'A'})}};
    await onChatMention.run(event);
    expect(resolveMentionedAuthorIds).not.toHaveBeenCalled();
  });

  it('does nothing for a ban_notice system message', async () => {
    const event = {data: {val: () => ({text: '@someone banned', type: 'ban_notice', authorId: 'system', authorName: 'BTCC Hub Admin'})}};
    await onChatMention.run(event);
    expect(resolveMentionedAuthorIds).not.toHaveBeenCalled();
  });

  it('sends a targeted FCM push to each mentioned author\'s registered token', async () => {
    resolveMentionedAuthorIds.mockReturnValue(['mentioned-1']);
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'Gordon'})}) // authorNames
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'device-token-abc'})}); // deviceTokens

    const event = {data: {val: () => ({text: '@Gordon check this out', authorId: 'sender-1', authorName: 'Sender'})}};
    await onChatMention.run(event);

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({
      token: 'device-token-abc',
      apns: {payload: {aps: expect.objectContaining({alert: expect.objectContaining({title: 'You were mentioned in Live Chat'})})}},
    }));
    // No top-level notification block: Android would display it without
    // running the app's spoiler-mode gate (displayAndroidDataNotification).
    expect(mockMessaging.send.mock.calls[0][0].notification).toBeUndefined();
  });

  it('records one push_history row per message with counts only (no text, no recipient IDs)', async () => {
    resolveMentionedAuthorIds.mockReturnValue(['mentioned-1', 'mentioned-2']);
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'Gordon', 'mentioned-2': 'Ash'})})
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'device-token-abc'})});

    const event = {data: {val: () => ({text: '@Gordon @Ash secret text', authorId: 'sender-1', authorName: 'Sender'})}};
    await onChatMention.run(event);

    expect(mockLogPushHistory).toHaveBeenCalledWith('You were mentioned in Live Chat', '', 'chat_mentions', {
      source: 'chatMention', target: 'token', senderId: 'sender-1', mentioned: 2, sent: 1, failed: 0, skippedSpoiler: 0, noToken: 1, ok: true,
    });
    expect(JSON.stringify(mockLogPushHistory.mock.calls)).not.toMatch(/secret text|mentioned-1|device-token/);
  });

  it('sends nothing to a mentioned user whose synced profile has spoiler mode on', async () => {
    resolveMentionedAuthorIds.mockReturnValue(['mentioned-1']);
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'Gordon'})})
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'device-token-abc'})});
    mockFirestoreDocRef.get.mockResolvedValueOnce({exists: true, data: () => ({spoilerFree: true})});

    const event = {data: {val: () => ({text: '@Gordon Moffat won it', authorId: 'sender-1', authorName: 'Sender'})}};
    await onChatMention.run(event);

    expect(mockMessaging.send).not.toHaveBeenCalled();
  });

  it('fails toward silence if the spoiler-mode profile read errors', async () => {
    resolveMentionedAuthorIds.mockReturnValue(['mentioned-1']);
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'Gordon'})})
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'device-token-abc'})});
    mockFirestoreDocRef.get.mockRejectedValueOnce(new Error('firestore down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const event = {data: {val: () => ({text: '@Gordon hi', authorId: 'sender-1', authorName: 'Sender'})}};
    await onChatMention.run(event);

    expect(mockMessaging.send).not.toHaveBeenCalled();
    console.error.mockRestore();
  });

  it('mirrors title/body/channel into data (the only thing Android displays from)', async () => {
    // Regression test for a real, live-reported bug (2026-09-09): the
    // notification block alone auto-displays fine when the recipient's app
    // is backgrounded/killed, but the foreground-Android JS display path
    // (displayAndroidDataNotification, src/utils/notifications.js) only
    // ever reads from `data` and silently drops anything missing
    // data.title - so a mention sent while the recipient had the app open
    // (the most likely state, since being tagged in chat basically requires
    // being active in it) never showed at all, with zero error on either
    // side. See project_chat_mention_foreground_android_notification_gap
    // memory - the exact bug the test just above would NOT have caught,
    // since it never asserted anything about `data`.
    resolveMentionedAuthorIds.mockReturnValue(['mentioned-1']);
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'Gordon'})})
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'device-token-abc'})});

    const event = {data: {val: () => ({text: '@Gordon check this out', authorId: 'sender-1', authorName: 'Sender'})}};
    await onChatMention.run(event);

    expect(mockMessaging.send).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        type: 'chat',
        title: 'You were mentioned in Live Chat',
        body: 'Sender: @Gordon check this out',
        channel: 'chat_mentions',
      },
    }));
  });

  it('drops a stale device token on messaging/registration-token-not-registered', async () => {
    resolveMentionedAuthorIds.mockReturnValue(['mentioned-1']);
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'Gordon'})})
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'stale-token'})});
    mockMessaging.send.mockRejectedValueOnce(Object.assign(new Error('gone'), {code: 'messaging/registration-token-not-registered'}));

    const event = {data: {val: () => ({text: '@Gordon hi', authorId: 'sender-1', authorName: 'Sender'})}};
    await onChatMention.run(event);

    expect(mockDatabaseRef.update).toHaveBeenCalledWith({'mentioned-1': null});
  });

  it('sends nothing when the sender has an active ban, and logs the skip with the sender id', async () => {
    resolveMentionedAuthorIds.mockReturnValue(['mentioned-1']);
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'Gordon'})})
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'device-token-abc'})})
      .mockResolvedValueOnce({val: () => ({bannedAt: 1, duration: '24h', expiresAt: Date.now() + 60000})});

    const event = {data: {val: () => ({text: '@Gordon hi', authorId: 'banned-1', authorName: 'Troll'})}};
    await onChatMention.run(event);

    expect(mockMessaging.send).not.toHaveBeenCalled();
    expect(mockLogPushHistory).toHaveBeenCalledWith('You were mentioned in Live Chat', '', 'chat_mentions', expect.objectContaining({
      senderId: 'banned-1', skippedBanned: true,
    }));
  });

  it('treats a permanent ban (no expiresAt) as active', async () => {
    resolveMentionedAuthorIds.mockReturnValue(['mentioned-1']);
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'Gordon'})})
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'device-token-abc'})})
      .mockResolvedValueOnce({val: () => ({bannedAt: 1, duration: 'permanent'})});

    const event = {data: {val: () => ({text: '@Gordon hi', authorId: 'banned-1', authorName: 'Troll'})}};
    await onChatMention.run(event);
    expect(mockMessaging.send).not.toHaveBeenCalled();
  });

  it('still sends when the sender\'s ban has expired', async () => {
    resolveMentionedAuthorIds.mockReturnValue(['mentioned-1']);
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'Gordon'})})
      .mockResolvedValueOnce({val: () => ({'mentioned-1': 'device-token-abc'})})
      .mockResolvedValueOnce({val: () => ({bannedAt: 1, duration: '1h', expiresAt: Date.now() - 1000})});

    const event = {data: {val: () => ({text: '@Gordon hi', authorId: 'was-banned', authorName: 'Fan'})}};
    await onChatMention.run(event);
    expect(mockMessaging.send).toHaveBeenCalledTimes(1);
  });

  it('does nothing if nobody was actually mentioned', async () => {
    resolveMentionedAuthorIds.mockReturnValue([]);
    const event = {data: {val: () => ({text: '@Nobody real', authorId: 'sender-1', authorName: 'Sender'})}};
    await onChatMention.run(event);
    expect(mockMessaging.send).not.toHaveBeenCalled();
  });
});

describe('setChatDonor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-POST request', async () => {
    const req = makeReq({method: 'GET'});
    const res = makeRes();
    await setChatDonor(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects a request without the correct admin secret', async () => {
    const req = makeReq({headers: {'x-admin-secret': 'wrong'}, body: {authorId: 'x', isDonor: true}});
    const res = makeRes();
    await setChatDonor(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('requires an authorId', async () => {
    const req = makeReq({headers: {'x-admin-secret': ADMIN_SECRET}, body: {isDonor: true}});
    const res = makeRes();
    await setChatDonor(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('sets the donor flag via the Admin SDK when isDonor is true', async () => {
    const req = makeReq({headers: {'x-admin-secret': ADMIN_SECRET}, body: {authorId: 'author-1', isDonor: true}});
    const res = makeRes();
    await setChatDonor(req, res);
    expect(mockDatabaseDb.ref).toHaveBeenCalledWith('/chat/donors/author-1');
    expect(mockDatabaseRef.set).toHaveBeenCalledWith(true);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('removes the donor flag when isDonor is false', async () => {
    const req = makeReq({headers: {'x-admin-secret': ADMIN_SECRET}, body: {authorId: 'author-1', isDonor: false}});
    const res = makeRes();
    await setChatDonor(req, res);
    expect(mockDatabaseRef.remove).toHaveBeenCalled();
  });
});

describe('lookupUserByEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-POST request', async () => {
    const req = makeReq({method: 'GET'});
    const res = makeRes();
    await lookupUserByEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects a request without the correct admin secret', async () => {
    const req = makeReq({headers: {'x-admin-secret': 'wrong'}, body: {email: 'a@b.com'}});
    const res = makeRes();
    await lookupUserByEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('requires an email', async () => {
    const req = makeReq({headers: {'x-admin-secret': ADMIN_SECRET}, body: {}});
    const res = makeRes();
    await lookupUserByEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when no Firebase Auth account exists for that email', async () => {
    const req = makeReq({headers: {'x-admin-secret': ADMIN_SECRET}, body: {email: 'nobody@example.com'}});
    const res = makeRes();
    await lookupUserByEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('resolves the account plus chat name/donor/ban state by uid when found', async () => {
    mockAuth.getUserByEmail.mockResolvedValueOnce({
      uid: 'uid-1',
      email: 'fan@example.com',
      emailVerified: true,
      disabled: false,
      metadata: {creationTime: '2026-01-01', lastSignInTime: '2026-08-01'},
    });
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => 'Gordon'}) // authorNames
      .mockResolvedValueOnce({val: () => true})     // donors
      .mockResolvedValueOnce({val: () => null});    // bans

    const req = makeReq({headers: {'x-admin-secret': ADMIN_SECRET}, body: {email: 'FAN@example.com'}});
    const res = makeRes();
    await lookupUserByEmail(req, res);

    expect(mockAuth.getUserByEmail).toHaveBeenCalledWith('fan@example.com'); // lowercased
    expect(mockDatabaseDb.ref).toHaveBeenCalledWith('/chat/authorNames/uid-1');
    expect(mockDatabaseDb.ref).toHaveBeenCalledWith('/chat/donors/uid-1');
    expect(mockDatabaseDb.ref).toHaveBeenCalledWith('/chat/bans/uid-1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true, uid: 'uid-1', chatDisplayName: 'Gordon', isDonor: true, activeBan: null,
    }));
  });

  it('reports an active ban but not an expired one', async () => {
    mockAuth.getUserByEmail.mockResolvedValueOnce({
      uid: 'uid-2', email: 'x@y.com', emailVerified: false, disabled: false,
      metadata: {creationTime: '2026-01-01', lastSignInTime: '2026-08-01'},
    });
    const activeBan = {bannedAt: 1, expiresAt: Date.now() + 100000, authorName: 'X'};
    mockDatabaseRef.once
      .mockResolvedValueOnce({val: () => null})
      .mockResolvedValueOnce({val: () => false})
      .mockResolvedValueOnce({val: () => activeBan});

    const req = makeReq({headers: {'x-admin-secret': ADMIN_SECRET}, body: {email: 'x@y.com'}});
    const res = makeRes();
    await lookupUserByEmail(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({activeBan}));
  });
});

describe('trimChat', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes exactly the keys selectMessagesToTrim returns', async () => {
    mockDatabaseRef.once.mockResolvedValueOnce({
      forEach: cb => { cb({key: 'old-1', val: () => ({timestamp: 1})}); cb({key: 'keep-1', val: () => ({timestamp: 2})}); },
    });
    selectMessagesToTrim.mockReturnValue(['old-1']);

    await trimChat.run();

    expect(mockDatabaseRef.update).toHaveBeenCalledWith({'old-1': null});
  });

  it('does not call update at all when nothing needs trimming', async () => {
    mockDatabaseRef.once.mockResolvedValueOnce({forEach: () => {}});
    selectMessagesToTrim.mockReturnValue([]);

    await trimChat.run();

    expect(mockDatabaseRef.update).not.toHaveBeenCalled();
  });
});
