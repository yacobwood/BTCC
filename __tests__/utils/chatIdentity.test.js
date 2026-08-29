import AsyncStorage from '@react-native-async-storage/async-storage';
import {claimUsername, validateUsername} from '../../src/utils/userProfile';
import {hasChatDisplayName, saveChatDisplayName} from '../../src/utils/chatIdentity';

jest.mock('../../src/utils/userProfile', () => ({
  claimUsername: jest.fn(),
  validateUsername: jest.fn(() => null),
}));

var mockOnce, mockSet, mockRef;

jest.mock('@react-native-firebase/database', () => {
  mockOnce = jest.fn();
  mockSet = jest.fn(() => Promise.resolve());
  mockRef = {once: mockOnce, set: mockSet};
  return jest.fn(() => ({ref: jest.fn(() => mockRef)}));
});

describe('hasChatDisplayName', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns true when a name exists at /chat/authorNames/{authorId}', async () => {
    mockOnce.mockResolvedValue({val: () => 'Gordon'});
    expect(await hasChatDisplayName('xyz')).toBe(true);
  });

  it('returns false when no name has ever been set', async () => {
    mockOnce.mockResolvedValue({val: () => null});
    expect(await hasChatDisplayName('xyz')).toBe(false);
  });

  it('returns false rather than throwing if the read fails', async () => {
    mockOnce.mockRejectedValue(new Error('offline'));
    await expect(hasChatDisplayName('xyz')).resolves.toBe(false);
  });
});

describe('saveChatDisplayName', () => {
  afterEach(() => jest.clearAllMocks());

  it('persists via AsyncStorage for an anonymous user, without claiming uniqueness', async () => {
    const result = await saveChatDisplayName({authorId: 'anon1', user: {isAnonymous: true, uid: 'anon1'}, name: 'Speedy'});
    expect(result).toEqual({status: 'ok', name: 'Speedy'});
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('commenter_name', 'Speedy');
    expect(claimUsername).not.toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith('Speedy');
  });

  it('persists via AsyncStorage when there is no user at all (fully anonymous)', async () => {
    const result = await saveChatDisplayName({authorId: 'anon1', user: null, name: 'Speedy'});
    expect(result).toEqual({status: 'ok', name: 'Speedy'});
    expect(claimUsername).not.toHaveBeenCalled();
  });

  it('falls back to "Fan #xxxx" when the name is blank', async () => {
    const result = await saveChatDisplayName({authorId: 'anon1234', user: null, name: '   '});
    expect(result).toEqual({status: 'ok', name: 'Fan #1234'});
  });

  it('claims the name via userProfile.claimUsername for a signed-in user', async () => {
    claimUsername.mockResolvedValue('ok');
    const result = await saveChatDisplayName({
      authorId: 'uid1', user: {isAnonymous: false, uid: 'uid1'}, name: 'Gordon', previousName: 'OldName',
    });
    expect(claimUsername).toHaveBeenCalledWith('uid1', 'Gordon', 'OldName');
    expect(result).toEqual({status: 'ok', name: 'Gordon'});
    expect(mockSet).toHaveBeenCalledWith('Gordon');
  });

  it('returns an invalid status when validateUsername rejects the name, without calling claimUsername', async () => {
    validateUsername.mockReturnValueOnce('Too short');
    const result = await saveChatDisplayName({authorId: 'uid1', user: {isAnonymous: false, uid: 'uid1'}, name: 'x'});
    expect(result).toEqual({status: 'invalid', message: 'Too short'});
    expect(claimUsername).not.toHaveBeenCalled();
  });

  it('returns a taken status when claimUsername reports the name is taken', async () => {
    claimUsername.mockResolvedValue('taken');
    const result = await saveChatDisplayName({authorId: 'uid1', user: {isAnonymous: false, uid: 'uid1'}, name: 'Gordon'});
    expect(result).toEqual({status: 'taken', message: 'That name is already taken'});
  });

  it('returns an error status when claimUsername itself fails', async () => {
    claimUsername.mockResolvedValue('error');
    const result = await saveChatDisplayName({authorId: 'uid1', user: {isAnonymous: false, uid: 'uid1'}, name: 'Gordon'});
    expect(result).toEqual({status: 'error', message: 'Could not save name. Please try again.'});
  });
});
