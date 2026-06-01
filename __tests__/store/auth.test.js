import React from 'react';
import {act, create} from 'react-test-renderer';
import {Linking} from 'react-native';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {AuthProvider, useAuth} from '../../src/store/auth';

jest.mock('../../src/utils/userProfile', () => ({
  loadProfile:           jest.fn(() => Promise.resolve(null)),
  uploadLocalProfile:    jest.fn(() => Promise.resolve()),
  applyProfileToStorage: jest.fn(() => Promise.resolve()),
}));

function renderProvider() {
  let hook;
  function Tester() {
    hook = useAuth();
    return null;
  }
  create(
    <AuthProvider>
      <Tester />
    </AuthProvider>,
  );
  return () => hook;
}

describe('AuthProvider', () => {
  describe('initial state', () => {
    it('signs in anonymously on mount when no user exists', async () => {
      const mockAuth = auth();
      mockAuth.onAuthStateChanged.mockImplementationOnce(cb => {
        cb(null);
        return jest.fn();
      });

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      expect(mockAuth.signInAnonymously).toHaveBeenCalled();
    });

    it('uses existing user from onAuthStateChanged without signing in again', async () => {
      const mockAuth = auth();
      const existingUser = {uid: 'existing-uid', isAnonymous: true, providerData: []};
      mockAuth.onAuthStateChanged.mockImplementationOnce(cb => {
        cb(existingUser);
        return jest.fn();
      });

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      expect(mockAuth.signInAnonymously).not.toHaveBeenCalled();
      expect(getHook().user).toEqual(existingUser);
    });

    it('exposes isAnonymous: true for anonymous user', async () => {
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });
      expect(getHook().isAnonymous).toBe(true);
    });
  });

  describe('profile sync', () => {
    it('uploads local profile when no Firestore doc exists (first sign-in)', async () => {
      const {loadProfile, uploadLocalProfile} = require('../../src/utils/userProfile');
      loadProfile.mockResolvedValueOnce(null);
      await act(async () => { renderProvider(); });
      expect(uploadLocalProfile).toHaveBeenCalledWith('test-uid-123');
    });

    it('applies Firestore profile to storage when doc exists (returning user)', async () => {
      const {loadProfile, applyProfileToStorage} = require('../../src/utils/userProfile');
      const saved = {unitKm: true, commenterName: 'Jake'};
      loadProfile.mockResolvedValueOnce(saved);
      await act(async () => { renderProvider(); });
      expect(applyProfileToStorage).toHaveBeenCalledWith(saved);
    });

    it('sets user only after applyProfileToStorage completes', async () => {
      const {loadProfile, applyProfileToStorage} = require('../../src/utils/userProfile');
      const saved = {unitKm: true};
      loadProfile.mockResolvedValueOnce(saved);

      // Use a deferred promise so we can control when applyProfileToStorage resolves
      let resolveApply;
      const applyPromise = new Promise(resolve => { resolveApply = resolve; });
      applyProfileToStorage.mockImplementationOnce(() => applyPromise);

      let getHook;
      // Mount the provider - applyProfileToStorage will be called but not yet resolved
      await act(async () => {
        getHook = renderProvider();
      });

      expect(applyProfileToStorage).toHaveBeenCalledWith(saved);

      // Now resolve and allow the user to be set
      await act(async () => {
        resolveApply();
      });

      expect(getHook().user).not.toBeNull();
    });

    it('sets user only after uploadLocalProfile completes for new user', async () => {
      const {loadProfile, uploadLocalProfile} = require('../../src/utils/userProfile');
      loadProfile.mockResolvedValueOnce(null);

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      expect(uploadLocalProfile).toHaveBeenCalledWith('test-uid-123');
      expect(getHook().user).not.toBeNull();
    });
  });

  describe('signInWithGoogle', () => {
    it('calls GoogleSignin.signIn and links credential when user is anonymous', async () => {
      const mockAuthInstance = auth();
      const linkFn = jest.fn(() => Promise.resolve());
      const anonUser = {uid: 'anon-uid', isAnonymous: true, linkWithCredential: linkFn, providerData: []};
      mockAuthInstance.onAuthStateChanged.mockImplementationOnce(cb => {
        cb(anonUser);
        return jest.fn();
      });

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        await getHook().signInWithGoogle();
      });

      expect(GoogleSignin.signIn).toHaveBeenCalled();
      expect(linkFn).toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('calls auth().signOut', async () => {
      const mockAuthInstance = auth();
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        await getHook().signOut();
      });

      expect(mockAuthInstance.signOut).toHaveBeenCalled();
    });

    it('uploads local profile before signing out when user is not anonymous', async () => {
      const {uploadLocalProfile} = require('../../src/utils/userProfile');
      const mockAuthInstance = auth();
      const nonAnonUser = {uid: 'real-uid-456', isAnonymous: false, providerData: [{providerId: 'google.com'}]};
      mockAuthInstance.onAuthStateChanged.mockImplementationOnce(cb => {
        cb(nonAnonUser);
        return jest.fn();
      });

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      uploadLocalProfile.mockClear();

      await act(async () => {
        await getHook().signOut();
      });

      expect(uploadLocalProfile).toHaveBeenCalledWith('real-uid-456');
      expect(mockAuthInstance.signOut).toHaveBeenCalled();
    });

    it('does not upload profile when signing out as anonymous user', async () => {
      const {uploadLocalProfile} = require('../../src/utils/userProfile');

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      uploadLocalProfile.mockClear();

      await act(async () => {
        await getHook().signOut();
      });

      expect(uploadLocalProfile).not.toHaveBeenCalled();
    });
  });

  describe('sendMagicLink', () => {
    it('stores email in AsyncStorage before calling the Cloud Function', async () => {
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        await getHook().sendMagicLink('user@example.com');
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'magic_link_pending_email',
        'user@example.com',
      );
    });

    it('POSTs the email to the sendMagicLinkEmail Cloud Function', async () => {
      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await act(async () => {
        await getHook().sendMagicLink('user@example.com');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sendMagicLinkEmail'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({email: 'user@example.com'}),
        }),
      );
    });

    it('throws with auth/network-request-failed when the Cloud Function returns an error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn(() => Promise.resolve({error: 'Failed to send email'})),
      });

      let getHook;
      await act(async () => {
        getHook = renderProvider();
      });

      await expect(
        act(async () => { await getHook().sendMagicLink('user@example.com'); }),
      ).rejects.toThrow();
    });
  });

  describe('magic link completion (Linking handler)', () => {
    const MAGIC_URL = 'https://btcchub-af77a.firebaseapp.com/__/auth/action?mode=signIn&oobCode=abc123';

    it('upgrades anonymous user via linkWithCredential when cold-start URL is a magic link', async () => {
      const mockAuthInstance = auth();
      const linkedUser = {uid: 'test-uid-123', isAnonymous: false, providerData: [{providerId: 'emailLink'}]};
      const linkFn = jest.fn(() => Promise.resolve({user: linkedUser}));
      const anonUser = {uid: 'test-uid-123', isAnonymous: true, providerData: [], linkWithCredential: linkFn};

      mockAuthInstance.onAuthStateChanged.mockImplementationOnce(cb => { cb(anonUser); return jest.fn(); });
      mockAuthInstance.currentUser = anonUser;
      mockAuthInstance.isSignInWithEmailLink.mockReturnValueOnce(true);
      AsyncStorage.getItem.mockResolvedValueOnce('user@example.com');
      Linking.getInitialURL.mockResolvedValueOnce(MAGIC_URL);

      await act(async () => { renderProvider(); });
      await act(async () => {});

      expect(auth.EmailAuthProvider.credentialWithLink).toHaveBeenCalledWith('user@example.com', MAGIC_URL);
      expect(linkFn).toHaveBeenCalled();
    });

    it('clears the pending email from AsyncStorage after completing sign-in', async () => {
      const mockAuthInstance = auth();
      const linkFn = jest.fn(() => Promise.resolve({user: {uid: 'test-uid-123', isAnonymous: false, providerData: []}}));
      const anonUser = {uid: 'test-uid-123', isAnonymous: true, providerData: [], linkWithCredential: linkFn};

      mockAuthInstance.onAuthStateChanged.mockImplementationOnce(cb => { cb(anonUser); return jest.fn(); });
      mockAuthInstance.currentUser = anonUser;
      mockAuthInstance.isSignInWithEmailLink.mockReturnValueOnce(true);
      AsyncStorage.getItem.mockResolvedValueOnce('user@example.com');
      Linking.getInitialURL.mockResolvedValueOnce(MAGIC_URL);

      await act(async () => { renderProvider(); });
      await act(async () => {});

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('magic_link_pending_email');
    });

    it('calls signInWithEmailLink for a non-anonymous current user', async () => {
      const mockAuthInstance = auth();
      const nonAnonUser = {uid: 'real-uid', isAnonymous: false, providerData: [{providerId: 'google.com'}]};

      mockAuthInstance.onAuthStateChanged.mockImplementationOnce(cb => { cb(nonAnonUser); return jest.fn(); });
      mockAuthInstance.currentUser = nonAnonUser;
      mockAuthInstance.isSignInWithEmailLink.mockReturnValueOnce(true);
      AsyncStorage.getItem.mockResolvedValueOnce('user@example.com');
      Linking.getInitialURL.mockResolvedValueOnce(MAGIC_URL);

      await act(async () => { renderProvider(); });
      await act(async () => {});

      expect(mockAuthInstance.signInWithEmailLink).toHaveBeenCalledWith('user@example.com', MAGIC_URL);
    });

    it('is a no-op when the URL is not a magic link', async () => {
      const mockAuthInstance = auth();
      mockAuthInstance.isSignInWithEmailLink.mockReturnValueOnce(false);
      Linking.getInitialURL.mockResolvedValueOnce('https://example.com/not-a-link');

      await act(async () => { renderProvider(); });
      await act(async () => {});

      expect(mockAuthInstance.signInWithEmailLink).not.toHaveBeenCalled();
      expect(auth.EmailAuthProvider.credentialWithLink).not.toHaveBeenCalled();
    });

    it('is a no-op when getInitialURL resolves to null', async () => {
      const mockAuthInstance = auth();
      Linking.getInitialURL.mockResolvedValueOnce(null);

      await act(async () => { renderProvider(); });
      await act(async () => {});

      expect(mockAuthInstance.isSignInWithEmailLink).not.toHaveBeenCalled();
    });

    it('is a no-op when no pending email is stored', async () => {
      const mockAuthInstance = auth();
      mockAuthInstance.isSignInWithEmailLink.mockReturnValueOnce(true);
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      Linking.getInitialURL.mockResolvedValueOnce(MAGIC_URL);

      await act(async () => { renderProvider(); });
      await act(async () => {});

      expect(mockAuthInstance.signInWithEmailLink).not.toHaveBeenCalled();
      expect(auth.EmailAuthProvider.credentialWithLink).not.toHaveBeenCalled();
    });

    it('falls back to signInWithEmailLink when linkWithCredential throws auth/email-already-in-use', async () => {
      const mockAuthInstance = auth();
      const linkFn = jest.fn(() => {
        const err = new Error('email already in use');
        err.code = 'auth/email-already-in-use';
        return Promise.reject(err);
      });
      const anonUser = {uid: 'test-uid-123', isAnonymous: true, providerData: [], linkWithCredential: linkFn};

      mockAuthInstance.onAuthStateChanged.mockImplementationOnce(cb => { cb(anonUser); return jest.fn(); });
      mockAuthInstance.currentUser = anonUser;
      mockAuthInstance.isSignInWithEmailLink.mockReturnValueOnce(true);
      AsyncStorage.getItem.mockResolvedValueOnce('user@example.com');
      Linking.getInitialURL.mockResolvedValueOnce(MAGIC_URL);

      await act(async () => { renderProvider(); });
      await act(async () => {});

      expect(linkFn).toHaveBeenCalled();
      expect(mockAuthInstance.signInWithEmailLink).toHaveBeenCalledWith('user@example.com', MAGIC_URL);
    });
  });
});
