let mockStorage = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(key => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key, val) => { mockStorage[key] = val; return Promise.resolve(); }),
}));

// Re-import fresh each test to reset the module-level cache
let getStableDeviceId;

beforeEach(() => {
  mockStorage = {};
  jest.resetModules();
  getStableDeviceId = require('../../src/utils/deviceId').getStableDeviceId;
});

describe('getStableDeviceId', () => {
  it('generates a UUID on first call', async () => {
    const id = await getStableDeviceId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('persists the UUID to AsyncStorage', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await getStableDeviceId();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('device_stable_id', expect.any(String));
  });

  it('returns the same ID on subsequent calls', async () => {
    const id1 = await getStableDeviceId();
    const id2 = await getStableDeviceId();
    expect(id1).toBe(id2);
  });

  it('reuses an existing ID from AsyncStorage', async () => {
    mockStorage['device_stable_id'] = 'existing-id-1234';
    const id = await getStableDeviceId();
    expect(id).toBe('existing-id-1234');
  });

  it('returns null when AsyncStorage throws', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('storage error'));
    const id = await getStableDeviceId();
    expect(id).toBeNull();
  });
});
