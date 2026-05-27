import React from 'react';
import {act, create} from 'react-test-renderer';
import auth from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {AuthProvider, useAuth} from '../../src/store/auth';

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
