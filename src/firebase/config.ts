import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { FIREBASE_CONFIG, FIRESTORE_DATABASE_ID } from '../config/appConfig';

const firebaseConfig = FIREBASE_CONFIG;

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// If a specific database ID was created (e.g. ai-studio-...), use it, otherwise use default
export const db: Firestore = FIRESTORE_DATABASE_ID
  ? getFirestore(app, FIRESTORE_DATABASE_ID)
  : getFirestore(app);

export { app, firebaseConfig };
