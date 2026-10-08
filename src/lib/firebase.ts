import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  initializeAuth, 
  indexedDBLocalPersistence, 
  browserLocalPersistence,
  browserPopupRedirectResolver 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize auth with indexedDB and browserLocalPersistence for mobile/WebView storage resilience
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch (e) {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app;
