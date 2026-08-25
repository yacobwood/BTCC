// Shared, reusable mock builders for the functions/ wrapper tests in this
// directory. None of these Cloud Functions had a direct (wrapper-level)
// test before this pass - only their extracted pure-logic siblings did
// (chatMentions, chatTrim, sessionAlerts, newsCheck) - so this establishes
// one consistent convention instead of each test file inventing its own
// firebase-admin mocking from scratch.

function makeReq({method = 'POST', headers = {}, body = {}} = {}) {
  return {method, headers, body};
}

// firebase-functions v2's onRequest wraps the handler in a Promise that
// resolves on the response's "finish" event (see
// functions/node_modules/firebase-functions/lib/v2/providers/https.js), and
// for any function with a `cors` option it also runs the real `cors` npm
// middleware first, which needs `res.setHeader`/`res.statusCode`/`res.end`
// and `req.headers`/`req.method` - a plain {status,json,send} stub isn't
// enough. This is a real Express-response-shaped mock, not a minimal one.
function makeRes() {
  const res = {statusCode: 200};
  let finishCb = null;
  res.on = jest.fn((event, cb) => { if (event === 'finish') finishCb = cb; });
  res.setHeader = jest.fn();
  res.getHeader = jest.fn();
  res.status = jest.fn(code => { res.statusCode = code; return res; });
  res.json = jest.fn(() => { finishCb?.(); return res; });
  res.send = jest.fn(() => { finishCb?.(); return res; });
  res.end = jest.fn(() => { finishCb?.(); return res; });
  return res;
}

// A fake Firestore db supporting the chained calls this codebase's functions
// actually use: collection().doc().get/set/update, collection().add,
// collection().where()/orderBy()/limit().get, db.batch(), db.runTransaction().
function makeFirestoreMock() {
  const docRef = {
    get: jest.fn(() => Promise.resolve({exists: false, data: () => ({})})),
    set: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
  };
  const querySnapshot = {docs: [], size: 0, forEach: jest.fn(), empty: true};
  const collectionRef = {
    doc: jest.fn(() => docRef),
    add: jest.fn(() => Promise.resolve({id: 'new-doc-id'})),
    where: jest.fn(() => collectionRef),
    orderBy: jest.fn(() => collectionRef),
    limit: jest.fn(() => collectionRef),
    get: jest.fn(() => Promise.resolve(querySnapshot)),
  };
  const batch = {
    update: jest.fn(),
    set: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  };
  const transactionCtx = {
    get: jest.fn(() => Promise.resolve({exists: false, data: () => ({})})),
    set: jest.fn(),
    update: jest.fn(),
  };
  const db = {
    collection: jest.fn(() => collectionRef),
    batch: jest.fn(() => batch),
    runTransaction: jest.fn(fn => fn(transactionCtx)),
  };
  return {db, docRef, collectionRef, batch, querySnapshot, transactionCtx};
}

// A fake RTDB db for getDatabaseWithUrl(...).ref(...) chains: once/on/off,
// set/remove/update/push, orderByChild().equalTo()/orderByChild().once().
function makeDatabaseMock() {
  const ref = {
    once: jest.fn(() => Promise.resolve({val: () => null, forEach: jest.fn()})),
    on: jest.fn(),
    off: jest.fn(),
    set: jest.fn(() => Promise.resolve()),
    remove: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    push: jest.fn(() => Promise.resolve()),
    orderByChild: jest.fn(() => ref),
    equalTo: jest.fn(() => ref),
  };
  const db = {ref: jest.fn(() => ref)};
  return {db, ref};
}

function makeMessagingMock() {
  return {send: jest.fn(() => Promise.resolve('projects/x/messages/1'))};
}

module.exports = {
  makeReq,
  makeRes,
  makeFirestoreMock,
  makeDatabaseMock,
  makeMessagingMock,
};
