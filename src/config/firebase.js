// Firebase project constants  -  same values as google-services.json / GoogleService-Info.plist.
// The Web API key is a restricted public key (Firebase Console → API restrictions).
export const FIREBASE_PROJECT_ID = 'btcchub-af77a';
export const FIREBASE_API_KEY = 'AIzaSyC0blgpkf9ioMa5QgkIwi9S6iCVnphSeHE';
export const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
export const COMMENT_REACT_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/commentReact`;
export const MAGIC_LINK_URL = `https://europe-west1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/sendMagicLinkEmail`;
