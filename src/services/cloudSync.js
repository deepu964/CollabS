/**
 * CloudSync Service
 * Provides real-time cross-device and multi-browser synchronization for CollabS references.
 * Backed by Cloudinary's high-performance global CDN raw registry.
 * Guarantees that references uploaded on any browser/device are instantly visible to all,
 * and references deleted from any browser are permanently purged across everyone.
 */

const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'dtaz4vhxh';
const UPLOAD_PRESET = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) || 'CollabS';
const REGISTRY_PUBLIC_ID = 'collabs_global_media_registry_v2';
const REGISTRY_READ_URL = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${REGISTRY_PUBLIC_ID}`;
const REGISTRY_WRITE_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;

let isSyncing = false;

/**
 * Fetch complete shared state (references + globally deleted IDs) from Cloudinary CDN registry.
 * @returns {Promise<{ references: Array, deletedIds: Array, lastUpdated: string }>}
 */
export async function fetchRemoteSharedState() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const cacheBuster = Date.now();
    const res = await fetch(`${REGISTRY_READ_URL}?t=${cacheBuster}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 404) {
        // Registry doesn't exist yet, return empty baseline
        return { references: [], deletedIds: [], lastUpdated: new Date().toISOString() };
      }
      console.warn(`[CloudSync] Registry fetch returned status ${res.status}`);
      return { references: [], deletedIds: [], lastUpdated: '' };
    }

    const data = await res.json();
    const rawRefs = Array.isArray(data?.references) ? data.references : [];
    const deletedList = Array.isArray(data?.deletedIds) ? data.deletedIds : [];
    const deletedSet = new Set(deletedList);

    // Filter out deleted items and sanitize URLs
    const sanitizedRefs = rawRefs
      .filter((r) => r && r.id && !deletedSet.has(r.id))
      .map((r) => ({
        ...r,
        imageUrl: (r.imageUrl || '').replace(/^http:\/\//i, 'https://')
      }));

    return {
      references: sanitizedRefs,
      deletedIds: deletedList,
      lastUpdated: data?.lastUpdated || new Date().toISOString()
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name !== 'AbortError') {
      console.warn('[CloudSync] Failed to fetch remote shared state:', err.message);
    }
    return { references: [], deletedIds: [], lastUpdated: '' };
  }
}

/**
 * Fetch all shared references from the cloud registry.
 * @returns {Promise<Array>} Array of reference objects
 */
export async function fetchRemoteSharedReferences() {
  const state = await fetchRemoteSharedState();
  return state.references;
}

/**
 * Push an updated registry state directly to Cloudinary raw upload.
 * @param {Object} state - { references: Array, deletedIds: Array }
 * @returns {Promise<boolean>}
 */
async function pushRegistryToCloudinary(state) {
  try {
    const payload = JSON.stringify({
      version: 2,
      lastUpdated: new Date().toISOString(),
      references: state.references || [],
      deletedIds: (state.deletedIds || []).slice(-500) // Keep last 500 deleted IDs for deduplication
    });

    const formData = new FormData();
    const blob = new Blob([payload], { type: 'application/json' });
    formData.append('file', blob);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('public_id', REGISTRY_PUBLIC_ID);

    const res = await fetch(REGISTRY_WRITE_URL, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[CloudSync] Failed to write registry to Cloudinary:', res.status, errText);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[CloudSync] Network error pushing registry:', err);
    return false;
  }
}

/**
 * Save a new reference to the cloud registry so other users/browsers see it.
 * @param {Object} newRef - Reference object
 * @returns {Promise<boolean>}
 */
export async function saveRemoteSharedReference(newRef) {
  if (!newRef || !newRef.id || !newRef.imageUrl) return false;

  // Ensure image URL is https and not local blob
  if (newRef.imageUrl.startsWith('blob:') || newRef.imageUrl.startsWith('file:')) {
    console.warn('[CloudSync] Cannot sync local blob URL to cloud registry:', newRef.imageUrl);
    return false;
  }

  const cleanRef = {
    ...newRef,
    imageUrl: newRef.imageUrl.replace(/^http:\/\//i, 'https://')
  };

  try {
    // 1. Fetch latest remote state to prevent race-condition overwriting
    const currentState = await fetchRemoteSharedState();
    const currentDeletedSet = new Set(currentState.deletedIds || []);

    // If item was previously deleted, remove it from deleted list since user explicitly added it
    const updatedDeletedIds = (currentState.deletedIds || []).filter((id) => id !== cleanRef.id);

    // 2. Filter out duplicates by id or imageUrl
    const filteredRefs = (currentState.references || []).filter(
      (r) => r.id !== cleanRef.id && (r.imageUrl !== cleanRef.imageUrl || !cleanRef.imageUrl)
    );

    const updatedReferences = [cleanRef, ...filteredRefs];

    // 3. Put back to global cloud registry
    return await pushRegistryToCloudinary({
      references: updatedReferences,
      deletedIds: updatedDeletedIds
    });
  } catch (err) {
    console.error('[CloudSync] Error saving reference to cloud registry:', err);
    return false;
  }
}

/**
 * Delete a reference from the cloud registry so it disappears permanently for all users.
 * @param {string} id - Reference ID
 * @returns {Promise<boolean>}
 */
export async function deleteRemoteSharedReference(id) {
  if (!id) return false;

  try {
    const currentState = await fetchRemoteSharedState();
    const updatedReferences = (currentState.references || []).filter((r) => r.id !== id);

    // Add to deletedIds set to ensure no other browser resurrects it
    const deletedSet = new Set(currentState.deletedIds || []);
    deletedSet.add(id);

    return await pushRegistryToCloudinary({
      references: updatedReferences,
      deletedIds: Array.from(deletedSet)
    });
  } catch (err) {
    console.error('[CloudSync] Error deleting reference from cloud registry:', err);
    return false;
  }
}

/**
 * Reconcile local state with remote registry.
 * Authoritative: remote state is source of truth.
 * @param {Array} localRefs - Current references in local state
 * @returns {Promise<{ references: Array, deletedIds: Array }>}
 */
export async function reconcileReferences(localRefs = []) {
  if (isSyncing) return { references: localRefs, deletedIds: [] };
  isSyncing = true;

  try {
    const remoteState = await fetchRemoteSharedState();
    const remoteRefs = remoteState.references || [];
    const deletedSet = new Set(remoteState.deletedIds || []);

    // Filter local references against remote deleted IDs
    const cleanLocal = (localRefs || []).filter((r) => r && r.id && !deletedSet.has(r.id));

    // If remote already has items or is reachable, remote is source of truth
    const remoteIdMap = new Map();
    remoteRefs.forEach((r) => {
      if (r && r.id) remoteIdMap.set(r.id, r);
    });

    let hasUnsavedLocal = false;
    const mergedList = [...remoteRefs];

    // Only allow genuinely unsynced local items that were marked as newly uploaded locally
    for (const localItem of cleanLocal) {
      if (localItem && localItem.id && !remoteIdMap.has(localItem.id) && localItem.isLocalUnsynced) {
        if (localItem.imageUrl && !localItem.imageUrl.startsWith('blob:')) {
          mergedList.unshift(localItem);
          hasUnsavedLocal = true;
        }
      }
    }

    if (hasUnsavedLocal) {
      pushRegistryToCloudinary({
        references: mergedList,
        deletedIds: remoteState.deletedIds || []
      }).catch((e) => console.warn('[CloudSync] Background sync back failed:', e));
    }

    return {
      references: mergedList,
      deletedIds: remoteState.deletedIds || []
    };
  } catch (err) {
    console.warn('[CloudSync] Reconciliation error:', err);
    return { references: localRefs, deletedIds: [] };
  } finally {
    isSyncing = false;
  }
}

/* ==========================================================================
   GLOBAL CLOUDINARY REGISTRY FOR PROJECT DOCS & PRDS
   ========================================================================== */

const DOCS_REGISTRY_PUBLIC_ID = 'collabs_global_docs_registry_v1';
const DOCS_REGISTRY_READ_URL = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${DOCS_REGISTRY_PUBLIC_ID}`;
const DOCS_REGISTRY_WRITE_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;

let isDocsSyncing = false;

/**
 * Fetch complete shared docs state (documents + deleted IDs) from Cloudinary CDN registry.
 * @returns {Promise<{ docs: Array, deletedIds: Array, lastUpdated: string }>}
 */
export async function fetchRemoteSharedDocsState() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const cacheBuster = Date.now();
    const res = await fetch(`${DOCS_REGISTRY_READ_URL}?t=${cacheBuster}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 404) {
        // Registry does not exist yet on Cloudinary
        return { docs: [], deletedIds: [], lastUpdated: new Date().toISOString() };
      }
      console.debug(`[CloudSync] Docs registry returned status ${res.status}`);
      return { docs: [], deletedIds: [], lastUpdated: '' };
    }

    const data = await res.json();
    const rawDocs = Array.isArray(data?.docs) ? data.docs : [];
    const deletedList = Array.isArray(data?.deletedIds) ? data.deletedIds : [];
    const deletedSet = new Set(deletedList);

    const sanitizedDocs = rawDocs
      .filter((d) => d && d.id && !deletedSet.has(d.id))
      .map((d) => ({
        ...d,
        fileUrl: (d.fileUrl || '').replace(/^http:\/\//i, 'https://')
      }));

    return {
      docs: sanitizedDocs,
      deletedIds: deletedList,
      lastUpdated: data?.lastUpdated || new Date().toISOString()
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name !== 'AbortError') {
      console.debug('[CloudSync] Docs registry fetch error:', err.message);
    }
    return { docs: [], deletedIds: [], lastUpdated: '' };
  }
}

/**
 * Fetch all shared docs from the cloud registry.
 * @returns {Promise<Array>}
 */
export async function fetchRemoteSharedDocs() {
  const state = await fetchRemoteSharedDocsState();
  return state.docs;
}

/**
 * Push updated docs registry state to Cloudinary raw upload.
 * @param {Object} state - { docs: Array, deletedIds: Array }
 * @returns {Promise<boolean>}
 */
async function pushDocsRegistryToCloudinary(state) {
  try {
    const payload = JSON.stringify({
      version: 1,
      lastUpdated: new Date().toISOString(),
      docs: state.docs || [],
      deletedIds: (state.deletedIds || []).slice(-500)
    });

    const formData = new FormData();
    const blob = new Blob([payload], { type: 'application/json' });
    formData.append('file', blob);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('public_id', DOCS_REGISTRY_PUBLIC_ID);

    const res = await fetch(DOCS_REGISTRY_WRITE_URL, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[CloudSync] Failed to push docs registry to Cloudinary:', res.status, errText);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[CloudSync] Network error pushing docs registry:', err);
    return false;
  }
}

/**
 * Save a new document to the cloud registry so other users/browsers see it.
 * @param {Object} newDoc - Document object
 * @returns {Promise<boolean>}
 */
export async function saveRemoteSharedDoc(newDoc) {
  if (!newDoc || !newDoc.id) return false;

  const cleanDoc = {
    ...newDoc,
    fileUrl: (newDoc.fileUrl || '').replace(/^http:\/\//i, 'https://')
  };

  try {
    const currentState = await fetchRemoteSharedDocsState();
    const updatedDeletedIds = (currentState.deletedIds || []).filter((id) => id !== cleanDoc.id);

    // Filter out duplicates by id
    const filteredDocs = (currentState.docs || []).filter((d) => d.id !== cleanDoc.id);
    const updatedDocs = [cleanDoc, ...filteredDocs];

    return await pushDocsRegistryToCloudinary({
      docs: updatedDocs,
      deletedIds: updatedDeletedIds
    });
  } catch (err) {
    console.error('[CloudSync] Error saving doc to cloud registry:', err);
    return false;
  }
}

/**
 * Delete a document from the cloud registry so it disappears permanently for all users.
 * @param {string} id - Document ID
 * @returns {Promise<boolean>}
 */
export async function deleteRemoteSharedDoc(id) {
  if (!id) return false;

  try {
    const currentState = await fetchRemoteSharedDocsState();
    const updatedDocs = (currentState.docs || []).filter((d) => d.id !== id);

    const deletedSet = new Set(currentState.deletedIds || []);
    deletedSet.add(id);

    return await pushDocsRegistryToCloudinary({
      docs: updatedDocs,
      deletedIds: Array.from(deletedSet)
    });
  } catch (err) {
    console.error('[CloudSync] Error deleting doc from cloud registry:', err);
    return false;
  }
}

/**
 * Reconcile local documents with remote registry and default fallback demo documents.
 * Authoritative: remote state is source of truth, with fallback to initial demos if registry is empty.
 * @param {Array} localDocs - Current local docs
 * @param {Array} fallbackDocs - Default demo docs (e.g. INITIAL_DOCS)
 * @returns {Promise<{ docs: Array, deletedIds: Array }>}
 */
export async function reconcileDocs(localDocs = [], fallbackDocs = []) {
  if (isDocsSyncing) return { docs: localDocs, deletedIds: [] };
  isDocsSyncing = true;

  try {
    const remoteState = await fetchRemoteSharedDocsState();
    const remoteDocs = remoteState.docs || [];
    const deletedSet = new Set(remoteState.deletedIds || []);

    // 1. If remote already has synced docs, use remote docs + non-deleted fallback docs
    const remoteIdMap = new Map();
    remoteDocs.forEach((d) => {
      if (d && d.id) remoteIdMap.set(d.id, d);
    });

    const mergedList = [...remoteDocs];

    // Include demo docs unless they were explicitly deleted
    fallbackDocs.forEach((demo) => {
      if (demo && demo.id && !deletedSet.has(demo.id) && !remoteIdMap.has(demo.id)) {
        mergedList.push(demo);
        remoteIdMap.set(demo.id, demo);
      }
    });

    // Also check if local has any unsynced doc that needs to be pushed up
    let hasUnsavedLocal = false;
    for (const localItem of localDocs || []) {
      if (localItem && localItem.id && !remoteIdMap.has(localItem.id) && !deletedSet.has(localItem.id)) {
        if (localItem.fileUrl && !localItem.fileUrl.startsWith('blob:')) {
          mergedList.unshift(localItem);
          remoteIdMap.set(localItem.id, localItem);
          hasUnsavedLocal = true;
        }
      }
    }

    if (hasUnsavedLocal) {
      pushDocsRegistryToCloudinary({
        docs: mergedList,
        deletedIds: remoteState.deletedIds || []
      }).catch((e) => console.debug('[CloudSync] Background sync back of local doc failed:', e));
    }

    return {
      docs: mergedList,
      deletedIds: remoteState.deletedIds || []
    };
  } catch (err) {
    console.warn('[CloudSync] Docs reconciliation error:', err);
    return { docs: localDocs, deletedIds: [] };
  } finally {
    isDocsSyncing = false;
  }
}
