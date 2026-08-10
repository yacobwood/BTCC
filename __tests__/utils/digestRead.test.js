import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import {saveProfile} from '../../src/utils/userProfile';
import {getReadIds, markRead, markAllRead, markUnread} from '../../src/utils/digestRead';

jest.mock('../../src/utils/userProfile', () => ({
  saveProfile: jest.fn(() => Promise.resolve()),
}));

const KEY = 'digest_read_ids';

describe('digestRead', () => {
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
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['1', '5', '12']));
      const result = await getReadIds();
      expect(result.has('1')).toBe(true);
      expect(result.has('5')).toBe(true);
      expect(result.has('12')).toBe(true);
    });

    it('returns empty Set on parse error', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce('not-json');
      const result = await getReadIds();
      expect(result.size).toBe(0);
    });
  });

  describe('markRead', () => {
    it('adds id to stored set', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['1']));
      await markRead(2);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        KEY,
        expect.stringContaining('"2"'),
      );
    });

    it('preserves existing ids when adding new one', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['1', '3']));
      await markRead(5);
      const [, saved] = AsyncStorage.setItem.mock.calls[0];
      const parsed = JSON.parse(saved);
      expect(parsed).toContain('1');
      expect(parsed).toContain('3');
      expect(parsed).toContain('5');
    });
  });

  describe('markAllRead', () => {
    it('stores all provided ids', async () => {
      await markAllRead([10, 20, 30]);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        KEY,
        JSON.stringify(['10', '20', '30']),
      );
    });

    it('stores empty array when called with empty list', async () => {
      await markAllRead([]);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(KEY, '[]');
    });
  });

  describe('markUnread', () => {
    it('removes id from stored set', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['1', '2', '3']));
      await markUnread(2);
      const [, saved] = AsyncStorage.setItem.mock.calls[0];
      const parsed = JSON.parse(saved);
      expect(parsed).toContain('1');
      expect(parsed).not.toContain('2');
      expect(parsed).toContain('3');
    });

    it('is a no-op when id is not in the set', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['1']));
      await markUnread(99);
      const [, saved] = AsyncStorage.setItem.mock.calls[0];
      expect(JSON.parse(saved)).toEqual(['1']);
    });
  });

  describe('cloud sync', () => {
    it('does not sync to a Firestore profile for an anonymous user', async () => {
      await markRead(2);
      expect(saveProfile).not.toHaveBeenCalled();
    });

    it('syncs read ids to the Firestore profile when signed in', async () => {
      auth().currentUser.isAnonymous = false;
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['1']));
      await markRead(2);
      expect(saveProfile).toHaveBeenCalledWith('test-uid-123', {digestReadIds: ['1', '2']});
    });

    it('syncs markAllRead to the Firestore profile when signed in', async () => {
      auth().currentUser.isAnonymous = false;
      await markAllRead([10, 20]);
      expect(saveProfile).toHaveBeenCalledWith('test-uid-123', {digestReadIds: ['10', '20']});
    });

    it('syncs markUnread to the Firestore profile when signed in', async () => {
      auth().currentUser.isAnonymous = false;
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['1', '2']));
      await markUnread(2);
      expect(saveProfile).toHaveBeenCalledWith('test-uid-123', {digestReadIds: ['1']});
    });
  });
});
