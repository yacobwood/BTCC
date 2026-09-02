import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import {saveProfile} from '../../src/utils/userProfile';
import {getReadIds, markRead, markAllRead, markUnread} from '../../src/utils/explainerRead';

// Mirrors digestRead.test.js exactly - explainerRead.js is a deliberate
// parallel of digestRead.js (see that module's own comment), added
// 2026-09-02 so Academy articles get the same read/unread behaviour as
// The Flying Lap.
jest.mock('../../src/utils/userProfile', () => ({
  saveProfile: jest.fn(() => Promise.resolve()),
}));

const KEY = 'explainer_read_ids';

describe('explainerRead', () => {
  afterEach(() => {
    auth().currentUser.isAnonymous = true;
  });

  describe('getReadIds', () => {
    it('returns empty Set when storage is empty', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      const result = await getReadIds();
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('returns Set of stored ids', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['explainer-a', 'explainer-b']));
      const result = await getReadIds();
      expect(result.has('explainer-a')).toBe(true);
      expect(result.has('explainer-b')).toBe(true);
    });

    it('returns empty Set on parse error', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce('not-json');
      const result = await getReadIds();
      expect(result.size).toBe(0);
    });
  });

  describe('markRead', () => {
    it('adds id to stored set', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['explainer-a']));
      await markRead('explainer-b');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        KEY,
        expect.stringContaining('"explainer-b"'),
      );
    });

    it('preserves existing ids when adding new one', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['explainer-a', 'explainer-b']));
      await markRead('explainer-c');
      const [, saved] = AsyncStorage.setItem.mock.calls[0];
      const parsed = JSON.parse(saved);
      expect(parsed).toContain('explainer-a');
      expect(parsed).toContain('explainer-b');
      expect(parsed).toContain('explainer-c');
    });
  });

  describe('markAllRead', () => {
    it('stores all provided ids', async () => {
      await markAllRead(['explainer-a', 'explainer-b']);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        KEY,
        JSON.stringify(['explainer-a', 'explainer-b']),
      );
    });

    it('stores empty array when called with empty list', async () => {
      await markAllRead([]);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(KEY, '[]');
    });
  });

  describe('markUnread', () => {
    it('removes id from stored set', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['explainer-a', 'explainer-b', 'explainer-c']));
      await markUnread('explainer-b');
      const [, saved] = AsyncStorage.setItem.mock.calls[0];
      const parsed = JSON.parse(saved);
      expect(parsed).toContain('explainer-a');
      expect(parsed).not.toContain('explainer-b');
      expect(parsed).toContain('explainer-c');
    });

    it('is a no-op when id is not in the set', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['explainer-a']));
      await markUnread('explainer-z');
      const [, saved] = AsyncStorage.setItem.mock.calls[0];
      expect(JSON.parse(saved)).toEqual(['explainer-a']);
    });
  });

  describe('cloud sync', () => {
    it('does not sync to a Firestore profile for an anonymous user', async () => {
      await markRead('explainer-a');
      expect(saveProfile).not.toHaveBeenCalled();
    });

    it('syncs read ids to the Firestore profile when signed in', async () => {
      auth().currentUser.isAnonymous = false;
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['explainer-a']));
      await markRead('explainer-b');
      expect(saveProfile).toHaveBeenCalledWith('test-uid-123', {explainerReadIds: ['explainer-a', 'explainer-b']});
    });

    it('syncs markAllRead to the Firestore profile when signed in', async () => {
      auth().currentUser.isAnonymous = false;
      await markAllRead(['explainer-a', 'explainer-b']);
      expect(saveProfile).toHaveBeenCalledWith('test-uid-123', {explainerReadIds: ['explainer-a', 'explainer-b']});
    });

    it('syncs markUnread to the Firestore profile when signed in', async () => {
      auth().currentUser.isAnonymous = false;
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['explainer-a', 'explainer-b']));
      await markUnread('explainer-b');
      expect(saveProfile).toHaveBeenCalledWith('test-uid-123', {explainerReadIds: ['explainer-a']});
    });
  });
});
