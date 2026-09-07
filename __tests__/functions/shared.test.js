// shared.js had zero dedicated tests before this - every other functions/
// test file mocks it wholesale (see e.g. scraperAdmin.test.js's own
// hand-rolled requireAdminPost stand-in), which means the REAL
// requireAdminPost implementation was never actually exercised by the test
// suite. That's exactly how the fail-open ADMIN_SECRET-unset bug went
// unnoticed - this file tests the real module directly instead of a mock of it.
const {makeReq, makeRes} = require('./testHelpers');

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({collection: jest.fn()})),
}), {virtual: true});

// functions/shared.js reads process.env.ADMIN_SECRET into a module-level
// const at require time, so each scenario needs a fresh module instance
// with the env var set (or deliberately unset) before requiring it.
describe('requireAdminPost', () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.ADMIN_SECRET;
  });

  it('rejects a non-POST request before even checking the secret', () => {
    process.env.ADMIN_SECRET = 'real-secret';
    const {requireAdminPost} = require('../../functions/shared');
    const req = makeReq({method: 'GET'});
    const res = makeRes();
    expect(requireAdminPost(req, res)).toBe(true);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('accepts a POST request carrying the correct secret', () => {
    process.env.ADMIN_SECRET = 'real-secret';
    const {requireAdminPost} = require('../../functions/shared');
    const req = makeReq({method: 'POST', headers: {'x-admin-secret': 'real-secret'}});
    const res = makeRes();
    expect(requireAdminPost(req, res)).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a POST request carrying the wrong secret', () => {
    process.env.ADMIN_SECRET = 'real-secret';
    const {requireAdminPost} = require('../../functions/shared');
    const req = makeReq({method: 'POST', headers: {'x-admin-secret': 'wrong'}});
    const res = makeRes();
    expect(requireAdminPost(req, res)).toBe(true);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // The actual regression this guards against: if a function forgets to
  // declare `secrets: ['ADMIN_SECRET']` in its onRequest options (confirmed
  // to have happened live, 2026-08-29 - see the comment above the
  // ADMIN_SECRET const in shared.js), process.env.ADMIN_SECRET reads as
  // undefined at runtime. Without an explicit `!ADMIN_SECRET ||` guard,
  // `undefined !== undefined` is false, so a request with NO x-admin-secret
  // header at all would incorrectly pass as authenticated - an auth bypass,
  // not just a stale-secret failure.
  it('fails CLOSED (rejects) rather than open when ADMIN_SECRET itself is unset, even with no auth header at all', () => {
    delete process.env.ADMIN_SECRET;
    const {requireAdminPost} = require('../../functions/shared');
    const req = makeReq({method: 'POST', headers: {}});
    const res = makeRes();
    expect(requireAdminPost(req, res)).toBe(true);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// Added 2026-09-07: a raw regex-extracted RSS <title> (Buzzsprout doesn't
// wrap it in CDATA) came through with a literal "&amp;" instead of "&" in
// the podcast push and the Podcasts screen - decodeEntities existed on the
// client (src/api/parsers.js) but functions/ had no equivalent, and nothing
// called it either way. Mirrors src/api/parsers.js's own decodeEntities tests.
describe('decodeEntities', () => {
  const {decodeEntities} = require('../../functions/shared');

  it('decodes a bare ampersand, the entity actually seen in the live Buzzsprout feed', () => {
    expect(decodeEntities('Tom Ingram &amp; Mikey Doble Join the BTCC Podcast'))
      .toBe('Tom Ingram & Mikey Doble Join the BTCC Podcast');
  });

  it('decodes the other common named/numeric entities', () => {
    expect(decodeEntities('&lt;tag&gt; &quot;quoted&quot; &#039;apos&#039; &nbsp;end')).toBe('<tag> "quoted" \'apos\'  end');
  });

  it('leaves plain text with no entities untouched', () => {
    expect(decodeEntities('Brands Hatch Race Review')).toBe('Brands Hatch Race Review');
  });
});
