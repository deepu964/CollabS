import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = () => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== 'your_firebase_api_key' &&
    firebaseConfig.projectId !== 'your_project_id'
  );
};

let db = null;
if (isFirebaseConfigured()) {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
  } catch (err) {
    console.error('Firebase initialization error:', err);
  }
}

export { db };

/**
 * Subscribes to real-time updates from Firestore 'references' collection.
 * @param {Function} onUpdate - Callback receiving array of references
 * @param {Function} onError - Optional error callback
 * @returns {Function} Unsubscribe function
 */
export function subscribeToReferences(onUpdate, onError) {
  if (!db) {
    return () => {};
  }

  const q = query(collection(db, 'references'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt || new Date().toISOString(),
        };
      });
      onUpdate(items);
    },
    (err) => {
      console.warn('Firestore subscription error (check Firestore rules):', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Saves a new reference item to Firestore.
 * @param {Object} reference - Reference object to add
 * @returns {Promise<Object>} Added item with Firestore ID
 */
export async function saveReferenceToFirestore(reference) {
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }

  const payload = {
    ...reference,
    createdAt: reference.createdAt || new Date().toISOString(),
  };

  // Remove undefined fields to prevent Firestore serialization errors
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  const docRef = await addDoc(collection(db, 'references'), payload);
  return { id: docRef.id, ...payload };
}

/**
 * Deletes a reference item from Firestore.
 * @param {string} id - Firestore document ID
 */
export async function deleteReferenceFromFirestore(id) {
  if (!db || !id) return;
  try {
    await deleteDoc(doc(db, 'references', id));
  } catch (err) {
    console.warn('Failed to delete reference from Firestore:', err);
  }
}

