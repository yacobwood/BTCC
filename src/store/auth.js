import React, {createContext, useContext, useState, useEffect} from 'react';
import auth from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import {Platform, Linking} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Analytics} from '../utils/analytics';
import {loadProfile, uploadLocalProfile, applyProfileToStorage} from '../utils/userProfile';
import {MAGIC_LINK_URL} from '../config/firebase';

const GOOGLE_WEB_CLIENT_ID = '399066588683-1d1bpqv7616h2f68lg78s4jufl7g528j.apps.googleusercontent.com';
const MAGIC_LINK_EMAIL_KEY = 'magic_link_pending_email';


GoogleSignin.configure({webClientId: GOOGLE_WEB_CLIENT_ID});

const AuthContext = createContext({
  user: null,
  isAnonymous: true,
  sendMagicLink: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signOut: async () => {},
});

export function AuthProvider({children}) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async u => {
      if (u) {
        const provider = u.isAnonymous ? 'anonymous' : (u.providerData[0]?.providerId || 'unknown');
        Analytics.setAuthUser(u.uid, provider);
        const existing = await loadProfile(u.uid);
        if (!existing) {
          await uploadLocalProfile(u.uid);
        } else {
          await applyProfileToStorage(existing);
        }
        setUser(u);
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

  useEffect(() => {
    function unwrapAuthUrl(url) {
      // Firebase wraps the action URL: /__/auth/links?link=/__/auth/action?mode=signIn&oobCode=...
      // Extract the inner URL so the SDK receives the actual sign-in parameters.
      try {
        const parsed = new URL(url);
        const inner = parsed.searchParams.get('link');
        if (inner) {return decodeURIComponent(inner);}
      } catch {}
      return url;
    }

    async function handleUrl(raw) {
      if (!raw) {return;}
      const url = unwrapAuthUrl(raw);
      if (!auth().isSignInWithEmailLink(url)) {return;}
      const email = await AsyncStorage.getItem(MAGIC_LINK_EMAIL_KEY);
      if (!email) {return;}
      try {
        const currentUser = auth().currentUser;
        if (currentUser?.isAnonymous) {
          const credential = auth.EmailAuthProvider.credentialWithLink(email, url);
          try {
            const result = await currentUser.linkWithCredential(credential);
            setUser(result.user);
          } catch (linkErr) {
            if (linkErr.code === 'auth/email-already-in-use') {
              await auth().signInWithEmailLink(email, url);
            } else {
              throw linkErr;
            }
          }
        } else {
          await auth().signInWithEmailLink(email, url);
        }
        await AsyncStorage.removeItem(MAGIC_LINK_EMAIL_KEY);
      } catch (e) {
        console.error('Magic link completion error:', e);
      }
    }
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({url}) => handleUrl(url));
    return () => sub.remove();
  }, []);

  async function sendMagicLink(email) {
    await AsyncStorage.setItem(MAGIC_LINK_EMAIL_KEY, email);
    const res = await fetch(MAGIC_LINK_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email}),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || 'Failed to send magic link');
      err.code = body.error?.startsWith('auth/') ? body.error : 'auth/network-request-failed';
      throw err;
    }
  }

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
    if (user && !user.isAnonymous) {
      await uploadLocalProfile(user.uid);
    }
    await auth().signOut();
  }

  const isAnonymous = user?.isAnonymous ?? true;
  const providerIds = user?.providerData?.map(p => p.providerId) ?? [];

  return (
    <AuthContext.Provider value={{
      user,
      isAnonymous,
      providerIds,
      sendMagicLink,
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
