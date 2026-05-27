import AsyncStorage from '@react-native-async-storage/async-storage';
import {loadProfile, saveProfile, uploadLocalProfile, applyProfileToStorage} from '../../src/utils/userProfile';

const UID = 'test-uid-123';

describe('userProfile', () => {
  describe('loadProfile', () => {
    it('returns null when doc not found (404)', async () => {
      global.fetch.mockResolvedValueOnce({ok: false, status: 404, json: jest.fn()});
      const result = await loadProfile(UID);
      expect(result).toBeNull();
    });

    it('parses boolean and string fields from Firestore response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn(() => Promise.resolve({
          fields: {
            unitKm: {booleanValue: true},
            commenterName: {stringValue: 'Tom Fan'},
            favouriteDrivers: {arrayValue: {values: [{stringValue: 'Tom Ingram'}]}},
          },
        })),
      });

      const result = await loadProfile(UID);
      expect(result).toEqual({
        unitKm: true,
        commenterName: 'Tom Fan',
        favouriteDrivers: ['Tom Ingram'],
      });
    });

    it('returns null on network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network'));
      const result = await loadProfile(UID);
      expect(result).toBeNull();
    });
  });

  describe('saveProfile', () => {
    it('sends a PATCH request with correct field mask', async () => {
      await saveProfile(UID, {unitKm: true, commenterName: 'Jake'});
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(UID),
        expect.objectContaining({method: 'PATCH'}),
      );
    });

    it('does not throw on network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network'));
      await expect(saveProfile(UID, {unitKm: false})).resolves.toBeUndefined();
    });
  });

  describe('uploadLocalProfile', () => {
    it('reads AsyncStorage and calls saveProfile with parsed values', async () => {
      AsyncStorage.multiGet.mockResolvedValueOnce([
        ['use_km', 'true'],
        ['commenter_name', 'Jake'],
        ['favourite_drivers', '["Tom Ingram"]'],
        ['setting_spoiler_free', 'false'],
      ]);

      await uploadLocalProfile(UID);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(UID),
        expect.objectContaining({method: 'PATCH'}),
      );
    });

    it('does not throw when AsyncStorage is empty', async () => {
      AsyncStorage.multiGet.mockResolvedValueOnce([]);
      await expect(uploadLocalProfile(UID)).resolves.toBeUndefined();
    });
  });

  describe('applyProfileToStorage', () => {
    it('writes profile fields back to AsyncStorage', async () => {
      await applyProfileToStorage({unitKm: true, commenterName: 'Jake', favouriteDrivers: ['Tom Ingram']});
      expect(AsyncStorage.multiSet).toHaveBeenCalledWith(
        expect.arrayContaining([
          ['use_km', 'true'],
          ['commenter_name', 'Jake'],
          ['favourite_drivers', '["Tom Ingram"]'],
        ]),
      );
    });

    it('does not throw on empty profile', async () => {
      await expect(applyProfileToStorage({})).resolves.toBeUndefined();
    });
  });
});
