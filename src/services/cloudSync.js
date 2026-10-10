/**
 * CloudSync Service
 * Provides real-time cross-device and multi-browser synchronization for CollabS references.
 * Backed by a globally accessible shared cloud registry on restful-api.dev.
 */

const SHARED_REGISTRY_ID = 'ff808181a09d98f701a12288f492318d';
const REGISTRY_URL = `https://api.restful-api.dev/objects/${SHARED_REGISTRY_ID}`;
const REGISTRY_NAME = 'collabs_global_media_registry_v1';

let isSyncing = false;

/**
 * Fetch all shared references from the cloud registry.
 * @returns {Promise<Array>} Array of reference objects
 */
export async function fetchRemoteSharedReferences() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(REGISTRY_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[CloudSync] Registry fetch returned status ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (data?.data?.references && Array.isArray(data.data.references)) {
      return data.data.references;
    }
    return [];
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name !== 'AbortError') {
      console.warn('[CloudSync] Failed to fetch remote references:', err.message);
    }
    return [];
  }
}

/**
 * Save a new reference to the cloud registry so other users/browsers see it.
 * @param {Object} newRef - Reference object
 * @returns {Promise<boolean>}
 */
export async function saveRemoteSharedReference(newRef) {
  if (!newRef || !newRef.id) return false;

  try {
    // 1. Fetch latest remote state to prevent overwriting
    const existing = await fetchRemoteSharedReferences();

    // 2. Filter out duplicates by id or imageUrl
    const filtered = existing.filter(
      (r) => r.id !== newRef.id && (r.imageUrl !== newRef.imageUrl || !newRef.imageUrl)
    );

    const updatedReferences = [newRef, ...filtered];

    // 3. Put back to the global cloud registry
    const res = await fetch(REGISTRY_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: REGISTRY_NAME,
        data: {
          lastUpdated: new Date().toISOString(),
          references: updatedReferences
        }
      })
    });

    return res.ok;
  } catch (err) {
    console.error('[CloudSync] Error saving reference to cloud registry:', err);
    return false;
  }
}

/**
 * Delete a reference from the cloud registry so it disappears for all users.
 * @param {string} id - Reference ID
 * @returns {Promise<boolean>}
 */
export async function deleteRemoteSharedReference(id) {
  if (!id) return false;

  try {
    const existing = await fetchRemoteSharedReferences();
    const updatedReferences = existing.filter((r) => r.id !== id);

    const res = await fetch(REGISTRY_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: REGISTRY_NAME,
        data: {
          lastUpdated: new Date().toISOString(),
          references: updatedReferences
        }
      })
    });

    return res.ok;
  } catch (err) {
    console.error('[CloudSync] Error deleting reference from cloud registry:', err);
    return false;
  }
}

/**
 * Bidirectional reconciliation: merges local references with remote references,
 * ensuring any uploads created on either side are safely shared globally.
 * @param {Array} localRefs - Current references in local state
 * @returns {Promise<Array>} Merged references array
 */
export async function reconcileReferences(localRefs = []) {
  if (isSyncing) return localRefs;
  isSyncing = true;

  try {
    const remoteRefs = await fetchRemoteSharedReferences();

    // Index existing items
    const remoteIdMap = new Map();
    remoteRefs.forEach((r) => {
      if (r && r.id) remoteIdMap.set(r.id, r);
    });

    let hasUnsavedLocal = false;
    const mergedList = [...remoteRefs];

    // If local has references (e.g. from previous uploads) not in remote, add them
    for (const localItem of localRefs) {
      if (localItem && localItem.id && !remoteIdMap.has(localItem.id)) {
        // Only push if it has a real URL (not dummy)
        if (localItem.imageUrl && !localItem.id.startsWith('ref-10') && !localItem.id.startsWith('ref-20') && !localItem.id.startsWith('ref-30')) {
          mergedList.push(localItem);
          hasUnsavedLocal = true;
        }
      }
    }

    // If local had unsynced items, sync the merged set back to remote
    if (hasUnsavedLocal) {
      fetch(REGISTRY_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: REGISTRY_NAME,
          data: {
            lastUpdated: new Date().toISOString(),
            references: mergedList
          }
        })
      }).catch((e) => console.warn('[CloudSync] Background sync back failed:', e));
    }

    return mergedList;
  } catch (err) {
    console.warn('[CloudSync] Reconciliation error:', err);
    return localRefs;
  } finally {
    isSyncing = false;
  }
}
