// v2
//
// This used to be one 1470-line file. Split 2026-08-25 into feature files,
// the same pattern chatMentions.js/chatTrim.js already used - see git
// history before this commit for the original monolith, and shared.js for
// the helpers common to more than one of these.
const {initializeApp} = require('firebase-admin/app');

initializeApp();

Object.assign(exports, require('./sessionNotifications'));
Object.assign(exports, require('./digest'));
Object.assign(exports, require('./chat'));
Object.assign(exports, require('./analytics'));
Object.assign(exports, require('./scraperAdmin'));
Object.assign(exports, require('./resultsDispatch'));
Object.assign(exports, require('./appEndpoints'));
