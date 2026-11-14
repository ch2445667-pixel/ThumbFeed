import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { app } from './firebase';

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
