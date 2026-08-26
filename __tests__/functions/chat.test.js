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

const mockAuth = makeAuthMock();
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => mockAuth),
}), {virtual: true});

jest.mock('../../functions/shared', () => ({
  ADMIN_SECRET: 'test-admin-secret',
}));

jest.mock('../../functions/chatMentions', () => ({
  resolveMentionedAuthorIds: jest.fn(),
}));

jest.mock('../../functions/chatTrim', () => ({
  selectMessagesToTrim: jest.fn(),
}));

const {onChatBan, onChatMention, setChatDonor, lookupUserByEmail, trimChat} = require('../../functions/chat');
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

  it('hides every message from the banned author and posts a ban_notice system message', async () => {
    const bannedMessages = {forEach: cb => { cb({key: 'msg-1'}); cb({key: 'msg-2'}); }};
    mockDatabaseRef.once.mockResolvedValueOnce({val: () => null, forEach: bannedMessages.forEach});

    const event = {
      params: {authorId: 'author-xyz'},
      data: {val: () => ({authorName: 'Gordon', duration: '24h', bannedAt: 1000, expiresAt: 2000})},
    };
    await onChatBan.run(event);

    expect(mockDatabaseRef.update).toHaveBeenCalledWith({'msg-1/hidden': true, 'msg-2/hidden': true});
    expect(mockDatabaseRef.push).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Gordon has been banned for 24h.',
      type: 'ban_notice',
    }));
  });

  it('phrases a permanent ban without "for"', async () => {
    mockDatabaseRef.once.mockResolvedValueOnce({val: () => null, forEach: () => {}});
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
    const event = {params: {authorId: 'x'}, data: {val: () => ({authorName: 'X', duration: '1h'})}};
    await expect(onChatBan.run(event)).resolves.toBeUndefined();
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
      notification: expect.objectContaining({title: 'You were mentioned in Live Chat'}),
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
