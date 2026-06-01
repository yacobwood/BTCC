import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import {loadProfile, saveProfile, uploadLocalProfile, applyProfileToStorage, validateUsername, checkUsernameAvailable, claimUsername} from '../../src/utils/userProfile';

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

    it('includes Authorization header when auth token is available', async () => {
      global.fetch.mockResolvedValueOnce({ok: true, status: 200, json: jest.fn(() => Promise.resolve({fields: {}}))});

      await loadProfile(UID);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(UID),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-id-token',
          }),
        }),
      );
    });

    it('omits Authorization header gracefully when no token', async () => {
      const mockAuthInstance = auth();
      const origCurrentUser = mockAuthInstance.currentUser;
      mockAuthInstance.currentUser = null;

      global.fetch.mockResolvedValueOnce({ok: true, status: 200, json: jest.fn(() => Promise.resolve({fields: {}}))});

      await expect(loadProfile(UID)).resolves.not.toThrow();
      expect(global.fetch).toHaveBeenCalled();

      mockAuthInstance.currentUser = origCurrentUser;
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

    it('includes Authorization header in PATCH request', async () => {
      await saveProfile(UID, {unitKm: true});

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(UID),
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-id-token',
          }),
        }),
      );
    });

    it('sends correctly structured Firestore document (not double-wrapped)', async () => {
      await saveProfile(UID, {unitKm: true});

      const [, options] = global.fetch.mock.calls[0];
      const body = JSON.parse(options.body);

      // Should have top-level fields key, not fields.fields
      expect(body.fields).toBeDefined();
      expect(body.fields.fields).toBeUndefined();
      expect(body.fields.unitKm).toEqual({booleanValue: true});
    });

    it('uses actual field names in updateMask not "fields"', async () => {
      await saveProfile(UID, {unitKm: true, commenterName: 'Jake'});

      const [url] = global.fetch.mock.calls[0];

      expect(url).toMatch(/updateMask\.fieldPaths=.*unitKm/);
      expect(url).toMatch(/updateMask\.fieldPaths=.*commenterName/);
      // The field path must not be just "fields"
      expect(url).not.toMatch(/updateMask\.fieldPaths=fields$/);
    });

    it('passes each field as a separate updateMask.fieldPaths param, not comma-joined', async () => {
      await saveProfile(UID, {unitKm: true, commenterName: 'Jake'});

      const [url] = global.fetch.mock.calls[0];
      // Must NOT have a comma inside any updateMask.fieldPaths value
      expect(url).not.toMatch(/updateMask\.fieldPaths=[^&]*,[^&]*/);
      // Must have two separate updateMask.fieldPaths entries
      const matches = url.match(/updateMask\.fieldPaths=/g);
      expect(matches).toHaveLength(2);
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

  describe('validateUsername', () => {
    it('accepts a valid alphanumeric name', () => {
      expect(validateUsername('JakeWood')).toBeNull();
    });

    it('accepts a name with underscores', () => {
      expect(validateUsername('jake_wood_99')).toBeNull();
    });

    it('rejects names shorter than 3 characters', () => {
      expect(validateUsername('ab')).toBe('Must be at least 3 characters');
    });

    it('rejects names longer than 20 characters', () => {
      expect(validateUsername('abcdefghijklmnopqrstu')).toBe('Must be 20 characters or fewer');
    });

    it('accepts names with spaces', () => {
      expect(validateUsername('BTCC Hub Admin')).toBeNull();
    });

    it('rejects names with special characters', () => {
      expect(validateUsername('jake@wood')).toBe('Letters, numbers, spaces and underscores only');
    });

    it('trims whitespace before validating', () => {
      expect(validateUsername('  ab  ')).toBe('Must be at least 3 characters');
    });
  });

  describe('checkUsernameAvailable', () => {
    it('returns "available" when doc does not exist (404)', async () => {
      global.fetch.mockResolvedValueOnce({ok: false, status: 404});
      const result = await checkUsernameAvailable('JakeWood', UID);
      expect(result).toBe('available');
    });

    it('returns "yours" when the existing doc belongs to this uid', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn(() => Promise.resolve({fields: {uid: {stringValue: UID}}})),
      });
      const result = await checkUsernameAvailable('JakeWood', UID);
      expect(result).toBe('yours');
    });

    it('returns "taken" when the doc belongs to a different uid', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn(() => Promise.resolve({fields: {uid: {stringValue: 'other-uid'}}})),
      });
      const result = await checkUsernameAvailable('JakeWood', UID);
      expect(result).toBe('taken');
    });

    it('returns null on network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network'));
      const result = await checkUsernameAvailable('JakeWood', UID);
      expect(result).toBeNull();
    });

    it('normalizes the name to lowercase before querying', async () => {
      global.fetch.mockResolvedValueOnce({ok: false, status: 404});
      await checkUsernameAvailable('JakeWood', UID);
      const [url] = global.fetch.mock.calls[0];
      expect(url).toContain('jakewood');
      expect(url).not.toContain('JakeWood');
    });
  });

  describe('claimUsername', () => {
    it('returns "ok" immediately when new name equals old name (no-op)', async () => {
      const result = await claimUsername(UID, 'JakeWood', 'JakeWood');
      expect(result).toBe('ok');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns "ok" on successful claim and calls saveProfile PATCH', async () => {
      // POST commit succeeds
      global.fetch.mockResolvedValueOnce({ok: true, status: 200, json: jest.fn(() => Promise.resolve({}))});
      // saveProfile PATCH inside claimUsername
      global.fetch.mockResolvedValueOnce({ok: true, status: 200});

      const result = await claimUsername(UID, 'NewName', null);
      expect(result).toBe('ok');
    });

    it('releases old username via DELETE before claiming new one', async () => {
      // DELETE old name
      global.fetch.mockResolvedValueOnce({ok: true, status: 200});
      // POST commit for new name
      global.fetch.mockResolvedValueOnce({ok: true, status: 200, json: jest.fn(() => Promise.resolve({}))});
      // saveProfile PATCH
      global.fetch.mockResolvedValueOnce({ok: true, status: 200});

      await claimUsername(UID, 'NewName', 'OldName');

      const deleteFetch = global.fetch.mock.calls.find(
        ([, opts]) => opts?.method === 'DELETE',
      );
      expect(deleteFetch).toBeDefined();
      expect(deleteFetch[0]).toContain('oldname');
    });

    it('returns "taken" when commit fails with FAILED_PRECONDITION and doc belongs to another user', async () => {
      // POST commit returns FAILED_PRECONDITION
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: jest.fn(() => Promise.resolve({error: {status: 'FAILED_PRECONDITION'}})),
      });
      // checkUsernameAvailable GET returns "taken"
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn(() => Promise.resolve({fields: {uid: {stringValue: 'other-uid'}}})),
      });

      const result = await claimUsername(UID, 'TakenName', null);
      expect(result).toBe('taken');
    });

    it('returns "ok" when FAILED_PRECONDITION but doc already belongs to this uid (re-install)', async () => {
      // POST commit returns FAILED_PRECONDITION
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: jest.fn(() => Promise.resolve({error: {status: 'FAILED_PRECONDITION'}})),
      });
      // checkUsernameAvailable GET returns "yours"
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn(() => Promise.resolve({fields: {uid: {stringValue: UID}}})),
      });
      // saveProfile PATCH
      global.fetch.mockResolvedValueOnce({ok: true, status: 200});

      const result = await claimUsername(UID, 'MyName', null);
      expect(result).toBe('ok');
    });

    it('returns "error" on network failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('network'));
      const result = await claimUsername(UID, 'AnyName', null);
      expect(result).toBe('error');
    });

    it('uses the lowercase key so case variants of the same name are blocked', async () => {
      // "BTCC HUB ADMIN" and "btcc hub admin" must resolve to the same Firestore document key
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: jest.fn(() => Promise.resolve({error: {status: 'FAILED_PRECONDITION'}})),
      });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn(() => Promise.resolve({fields: {uid: {stringValue: 'other-uid'}}})),
      });

      const result = await claimUsername(UID, 'BTCC HUB ADMIN', null);
      expect(result).toBe('taken');

      // The commit POST must have used the lowercased key, not the original casing
      const commitCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'POST');
      const body = JSON.parse(commitCall[1].body);
      expect(body.writes[0].update.name).toContain('btcc hub admin');
      expect(body.writes[0].update.name).not.toContain('BTCC HUB ADMIN');
    });
  });
});
