import React from 'react';
import {act, create} from 'react-test-renderer';
import auth from '@react-native-firebase/auth';
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
  });
});
