/**
 * Static assertions on firestore.rules.
 *
 * These tests do not run the Firebase emulator — they parse the rules file as
 * text and assert that:
 *   - every collection the app writes to directly has an explicit allow-write rule
 *   - every collection that must stay locked has an explicit deny-write rule
 *   - the deny-all catch-all is present
 *
 * This catches "forgot to add a rule" mistakes (like the article_reactions
 * incident) without requiring emulator infrastructure.
 */

const fs = require('fs');
const path = require('path');

const rules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');

// Collections the app writes to directly (not via Cloud Functions / Admin SDK).
// Each entry must have an explicit "allow write" rule that is not "if false".
const APP_WRITE_COLLECTIONS = [
  'article_reactions',
  'article_comments',
  'chat/bans',
  'chat/reports',
  'chat/messages',
];

// User accounts collections — auth-guarded, not blanket writes.
const USER_ACCOUNT_COLLECTIONS = [
  'users',
  'usernames',
];

// Collections that must stay write-locked (Cloud Functions / Admin SDK only).
const LOCKED_WRITE_COLLECTIONS = [
  'errors',
  'bug_reports',
  'push_history',
  'roadmap_submissions',
  'roadmap_votes',
];

describe('firestore.rules', () => {
  it('contains the deny-all catch-all', () => {
    expect(rules).toMatch(/match\s+\/\{document=\*\*\}.*allow read, write: if false/s);
  });

  describe('app-write collections have non-false allow write rules', () => {
    APP_WRITE_COLLECTIONS.forEach(collection => {
      it(`${collection} allows writes`, () => {
        // Find the match block for this collection.
        const escapedPath = collection.replace('/', '\\/');
        const blockRegex = new RegExp(
          `match\\s+\\/${escapedPath}\\/\\{[^}]+\\}[^{]*\\{([^}]+)\\}`,
          's',
        );
        const match = rules.match(blockRegex);
        expect(match).not.toBeNull();
        const block = match[1];
        // Must contain an allow write rule that is not "if false".
        expect(block).toMatch(/allow write/);
        expect(block).not.toMatch(/allow write:\s*if false/);
      });
    });
  });

  describe('user account collections have auth-guarded rules', () => {
    it('users/{userId} allows read/write when request.auth.uid == userId', () => {
      expect(rules).toMatch(/match\s+\/users\/\{userId\}[^{]*\{[^}]*allow read, write: if request\.auth != null && request\.auth\.uid == userId/s);
    });

    it('usernames/{username} allows public read', () => {
      expect(rules).toMatch(/match\s+\/usernames\/\{username\}[^{]*\{[^}]*allow read: if true/s);
    });

    it('usernames/{username} restricts create to the owning uid', () => {
      expect(rules).toMatch(/allow create: if request\.auth != null && request\.resource\.data\.uid == request\.auth\.uid/);
    });

    it('usernames/{username} restricts delete to the owning uid', () => {
      expect(rules).toMatch(/allow delete: if request\.auth != null && resource\.data\.uid == request\.auth\.uid/);
    });

    it('usernames/{username} blocks updates entirely', () => {
      expect(rules).toMatch(/allow update: if false/);
    });
  });

  describe('locked collections deny writes', () => {
    LOCKED_WRITE_COLLECTIONS.forEach(collection => {
      it(`${collection} denies writes`, () => {
        const escapedPath = collection.replace('/', '\\/');
        const blockRegex = new RegExp(
          `match\\s+\\/${escapedPath}\\/\\{[^}]+\\}[^{]*\\{([^}]+)\\}`,
          's',
        );
        const match = rules.match(blockRegex);
        expect(match).not.toBeNull();
        const block = match[1];
        expect(block).toMatch(/allow write:\s*if false/);
      });
    });
  });
});
