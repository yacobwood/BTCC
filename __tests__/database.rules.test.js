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
      expect(write).toBe('!data.exists() || !newData.exists()');
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
      expect(msg['.write']).toBe('auth != null');
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

  describe('chat/bans', () => {
    // Known, separate issue (see the growth/re-engagement report and the
    // donor-badge plan) - .write is unconditionally true, so the admin
    // panel's "privilege" here is really just URL obscurity, not real
    // access control. This test documents the current state deliberately:
    // if it ever flips false, that's a real fix and this assertion (plus
    // the surrounding docs) should be updated as part of it, not silently.
    it('is currently open-write for any client (documented known issue, not a target to fix here)', () => {
      expect(rules.chat.bans.$authorId['.write']).toBe(true);
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
