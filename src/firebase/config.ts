import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfigRaw from '../../firebase-applet-config.json';

const firebaseConfig = {
  projectId: firebaseConfigRaw.projectId,
  appId: firebaseConfigRaw.appId,
  apiKey: firebaseConfigRaw.apiKey,
  authDomain: firebaseConfigRaw.authDomain,
  storageBucket: firebaseConfigRaw.storageBucket,
  messagingSenderId: firebaseConfigRaw.messagingSenderId,
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// If a specific database ID was created (e.g. ai-studio-...), use it, otherwise use default
export const db: Firestore = (firebaseConfigRaw as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfigRaw as any).firestoreDatabaseId)
  : getFirestore(app);

export { app, firebaseConfig };
