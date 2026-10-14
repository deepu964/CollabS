/**
 * IndexedDB helper for storing and retrieving raw document files (PDFs, docx, etc.)
 * Provides persistent local binary storage so original uploaded files are always
 * available with 100% fidelity even across browser reloads.
 */

const DB_NAME = 'collabs_docs_db_v1';
const DB_VERSION = 1;
const STORE_NAME = 'doc_files';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a document Blob/File to IndexedDB
 * @param {string} id - Document ID
 * @param {Blob|File} fileBlob - Raw file or blob
 * @returns {Promise<boolean>}
 */
export async function saveDocBlob(id, fileBlob) {
  if (!id || !fileBlob) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id,
        blob: fileBlob,
        name: fileBlob.name || 'document',
        type: fileBlob.type || 'application/pdf',
        savedAt: Date.now()
      });

      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn('[DocStorage] Failed to save blob:', req.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.debug('[DocStorage] IndexedDB save error:', err);
    return false;
  }
}

/**
 * Retrieve a document Blob from IndexedDB
 * @param {string} id - Document ID
 * @returns {Promise<Blob|null>}
 */
export async function getDocBlob(id) {
  if (!id) return null;
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.debug('[DocStorage] IndexedDB read error:', err);
    return null;
  }
}

/**
 * Delete a document Blob from IndexedDB
 * @param {string} id - Document ID
 * @returns {Promise<boolean>}
 */
export async function deleteDocBlob(id) {
  if (!id) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.debug('[DocStorage] IndexedDB delete error:', err);
    return false;
  }
}
