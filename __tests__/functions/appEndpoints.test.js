const {makeReq, makeRes, makeFirestoreMock} = require('./testHelpers');

const {db: mockFirestoreDb, docRef: mockDocRef} = makeFirestoreMock();
const mockIncrement = jest.fn(n => ({__increment: n}));
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockFirestoreDb),
  FieldValue: {increment: (...args) => mockIncrement(...args)},
}), {virtual: true});

const mockGenerateSignInWithEmailLink = jest.fn();
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({generateSignInWithEmailLink: mockGenerateSignInWithEmailLink})),
}), {virtual: true});

const mockSendMail = jest.fn(() => Promise.resolve());
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({sendMail: mockSendMail})),
}), {virtual: true});

const {commentReact, sendMagicLinkEmail} = require('../../functions/appEndpoints');

describe('commentReact', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-POST request', async () => {
    const req = makeReq({method: 'GET'});
    const res = makeRes();
    await commentReact(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects a missing commentId', async () => {
    const req = makeReq({body: {prev: null, next: 'likes'}});
    const res = makeRes();
    await commentReact(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects when prev equals next (no actual change)', async () => {
    const req = makeReq({body: {commentId: 'c1', prev: 'likes', next: 'likes'}});
    const res = makeRes();
    await commentReact(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('increments likes and decrements dislikes when switching from dislike to like', async () => {
    const req = makeReq({body: {commentId: 'c1', prev: 'dislikes', next: 'likes'}});
    const res = makeRes();
    await commentReact(req, res);

    expect(mockIncrement).toHaveBeenCalledWith(-1);
    expect(mockIncrement).toHaveBeenCalledWith(1);
    expect(mockFirestoreDb.collection).toHaveBeenCalledWith('article_comments');
    expect(mockDocRef.update).toHaveBeenCalledWith({dislikes: {__increment: -1}, likes: {__increment: 1}});
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sets a reaction from no prior reaction (prev=null)', async () => {
    const req = makeReq({body: {commentId: 'c1', prev: null, next: 'likes'}});
    const res = makeRes();
    await commentReact(req, res);
    expect(mockDocRef.update).toHaveBeenCalledWith({likes: {__increment: 1}});
  });

  it('returns 500 if the Firestore update fails', async () => {
    mockDocRef.update.mockRejectedValueOnce(new Error('firestore down'));
    const req = makeReq({body: {commentId: 'c1', prev: null, next: 'likes'}});
    const res = makeRes();
    await commentReact(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('sendMagicLinkEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-POST request', async () => {
    const req = makeReq({method: 'GET'});
    const res = makeRes();
    await sendMagicLinkEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects an invalid email address', async () => {
    const req = makeReq({body: {email: 'not-an-email'}});
    const res = makeRes();
    await sendMagicLinkEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('generates a sign-in link and emails it to the given address', async () => {
    mockGenerateSignInWithEmailLink.mockResolvedValueOnce('https://btcchub-af77a.firebaseapp.com/?link=abc');
    const req = makeReq({body: {email: 'Fan@Example.com'}});
    const res = makeRes();
    await sendMagicLinkEmail(req, res);

    expect(mockGenerateSignInWithEmailLink).toHaveBeenCalledWith('fan@example.com', expect.any(Object));
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'fan@example.com',
      subject: 'Sign in to BTCC Hub',
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 if generating the link fails', async () => {
    mockGenerateSignInWithEmailLink.mockRejectedValueOnce(Object.assign(new Error('x'), {code: 'auth/invalid-email'}));
    const req = makeReq({body: {email: 'fan@example.com'}});
    const res = makeRes();
    await sendMagicLinkEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('returns 500 if sending the email fails', async () => {
    mockGenerateSignInWithEmailLink.mockResolvedValueOnce('https://link');
    mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
    const req = makeReq({body: {email: 'fan@example.com'}});
    const res = makeRes();
    await sendMagicLinkEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
