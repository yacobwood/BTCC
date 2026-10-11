/**
 * Static assertions on database.rules.json (Realtime Database security rules).
 *
 * Same technique as firestore.rules.test.js: no emulator, just parses the
 * rules file (real JSON here, so no regex needed) and asserts the security
 * properties that actually matter - who can read/write each node, and that
 * validation constraints exist where they should. Catches "forgot to lock
 * this down" mistakes without emulator infrastructure.
 */

const fs = require('fs');
const path = require('path');

const rules = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../database.rules.json'), 'utf8'),
).rules;

describe('database.rules.json', () => {
  it('denies read and write by default at the root', () => {
    expect(rules['.read']).toBe(false);
    expect(rules['.write']).toBe(false);
  });

  describe('chat/reports', () => {
    const reports = rules.chat.reports;

    it('allows public read', () => {
      expect(reports['.read']).toBe(true);
    });

    it('only allows creating a new report or deleting an existing one, not editing one in place', () => {
      const write = reports.$reportId['.write'];
      expect(write).toMatch(/^data\.exists\(\) \? !newData\.exists\(\) : \(auth != null && /);
    });

    it('refuses new reports from a banned uid or banned device (since 2026-10-11)', () => {
      const write = reports.$reportId['.write'];
      expect(write).toContain("root.child('chat/bans/' + auth.uid)");
      expect(write).toContain("root.child('chat/deviceBans/' + root.child('chat/devices/' + auth.uid).val())");
    });

    it('locks reporterId to the reporter\'s own uid', () => {
      expect(reports.$reportId.reporterId['.validate']).toBe('newData.val() === auth.uid');
    });

    it('validates required fields on write', () => {
      expect(reports.$reportId['.validate']).toContain('flaggedMessage');
      expect(reports.$reportId['.validate']).toContain('reportedAt');
    });
  });

  describe('chat/messages', () => {
    const messages = rules.chat.messages;
    const msg = messages.$msgId;

    it('allows public read and indexes by timestamp for the trim/query paths', () => {
      expect(messages['.read']).toBe(true);
      expect(messages['.indexOn']).toEqual(['timestamp']);
    });

    it('requires authentication to write a message', () => {
      expect(msg['.write']).toMatch(/^auth != null && /);
    });

    it('blocks a uid with an active ban from creating messages (permanent = no expiresAt)', () => {
      const w = msg['.write'];
      expect(w).toContain("!root.child('chat/bans/' + auth.uid).exists()");
      expect(w).toContain("child('expiresAt').val() < now");
    });

    it('only lets the author delete their own message', () => {
      expect(msg['.write']).toContain(": data.child('authorId').val() === auth.uid");
    });

    it('locks authorId to the writer\'s own uid and makes it immutable after creation', () => {
      const v = msg.authorId['.validate'];
      expect(v).toContain('newData.val() === auth.uid');
      expect(v).toContain('!data.exists() || newData.val() === data.val()');
    });

    it('makes text and timestamp immutable after creation', () => {
      expect(msg.text['.validate']).toContain('!data.exists() || newData.val() === data.val()');
      expect(msg.timestamp['.validate']).toContain('!data.exists() || newData.val() === data.val()');
    });

    it('only allows flagCount to increase, never decrease', () => {
      expect(msg.flagCount['.validate']).toContain('newData.val() >= data.val()');
    });

    it('only allows hidden to flip false -> true, never back to false', () => {
      const v = msg.hidden['.validate'];
      expect(v).toContain('data.val() === false || newData.val() === true');
    });

    it('rejects any field not explicitly allowed', () => {
      expect(msg.$other['.validate']).toBe(false);
    });
  });

  describe('chat/bans, deviceBans and devices', () => {
    // Bans were open-write until 2026-10-11 (anyone could delete their own
    // ban over REST). Now only the Admin SDK writes them, via the
    // banChatUser/unbanChatUser/onChatDeviceRegistered Cloud Functions.
    // Behaviour verified against the real database emulator that day.
    it('makes bans readable by the app but not client-writable', () => {
      expect(rules.chat.bans['.read']).toBe(true);
      expect(rules.chat.bans.$authorId['.write']).toBe(false);
    });

    it('keeps device bans fully server-side', () => {
      expect(rules.chat.deviceBans['.read']).toBe(false);
      expect(rules.chat.deviceBans.$deviceId['.write']).toBe(false);
    });

    it('lets a user register their own device once and read only their own entry', () => {
      const dev = rules.chat.devices;
      expect(dev['.read']).toBe(false);
      expect(dev.$authorId['.read']).toBe('auth != null && auth.uid === $authorId');
      expect(dev.$authorId['.write']).toBe('auth != null && auth.uid === $authorId && !data.exists()');
      expect(dev.$authorId['.validate']).toContain('matches(');
    });

    it('blocks messages from a banned device, not just a banned uid', () => {
      expect(rules.chat.messages.$msgId['.write']).toContain("root.child('chat/deviceBans/' + root.child('chat/devices/' + auth.uid).val())");
    });
  });

  describe('chat/authorNames', () => {
    const names = rules.chat.authorNames;

    it('only lets a user write their own display name', () => {
      expect(names.$authorId['.write']).toBe('auth != null && auth.uid === $authorId');
    });

    it('enforces a 1-30 character string', () => {
      const v = names.$authorId['.validate'];
      expect(v).toContain('newData.isString()');
      expect(v).toContain('newData.val().length >= 1');
      expect(v).toContain('newData.val().length <= 30');
    });
  });

  describe('chat/donors (supporter badge)', () => {
    it('is client-proof - only the Admin SDK (setChatDonor Cloud Function) can write', () => {
      expect(rules.chat.donors.$authorId['.write']).toBe(false);
    });

    it('is publicly readable so ChatScreen\'s live listener can render the badge', () => {
      expect(rules.chat.donors['.read']).toBe(true);
    });
  });

  describe('chat/deviceTokens', () => {
    const tokens = rules.chat.deviceTokens;

    it('is private - not publicly readable', () => {
      expect(tokens['.read']).toBe(false);
    });

    it('only lets a user write their own token', () => {
      expect(tokens.$authorId['.write']).toBe('auth != null && auth.uid === $authorId');
    });
  });
});
