import React, {createContext, useContext, useState, useEffect} from 'react';
import auth from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import {Platform} from 'react-native';
import {Analytics} from '../utils/analytics';

// Set this to the Web OAuth 2.0 Client ID from Firebase Console → Authentication → Google → Web SDK config.
// Google Sign-In must be enabled in the Firebase Console before this will work.
const GOOGLE_WEB_CLIENT_ID = 'TODO_REPLACE_WITH_WEB_CLIENT_ID';

GoogleSignin.configure({webClientId: GOOGLE_WEB_CLIENT_ID});

const AuthContext = createContext({
  user: null,
  isAnonymous: true,
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signOut: async () => {},
});

export function AuthProvider({children}) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async u => {
      if (u) {
        setUser(u);
        const provider = u.isAnonymous ? 'anonymous' : (u.providerData[0]?.providerId || 'unknown');
        Analytics.setAuthUser(u.uid, provider);
      } else {
        try {
          const cred = await auth().signInAnonymously();
          setUser(cred.user);
        } catch {
          setUser(null);
        }
      }
    });
    return unsubscribe;
  }, []);

  async function signInWithGoogle() {
    await GoogleSignin.hasPlayServices();
    const {data} = await GoogleSignin.signIn();
    const credential = auth.GoogleAuthProvider.credential(data.idToken);
    if (user?.isAnonymous) {
      await user.linkWithCredential(credential);
    } else {
      await auth().signInWithCredential(credential);
    }
  }

  async function signInWithApple() {
    const appleReq = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });
    const credential = auth.AppleAuthProvider.credential(
      appleReq.identityToken,
      appleReq.nonce,
    );
    if (user?.isAnonymous) {
      await user.linkWithCredential(credential);
    } else {
      await auth().signInWithCredential(credential);
    }
  }

  async function signOut() {
    await auth().signOut();
  }

  const isAnonymous = user?.isAnonymous ?? true;
  const providerIds = user?.providerData?.map(p => p.providerId) ?? [];

  return (
    <AuthContext.Provider value={{
      user,
      isAnonymous,
      providerIds,
      signInWithGoogle,
      signInWithApple: Platform.OS === 'ios' ? signInWithApple : null,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
