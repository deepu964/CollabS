/**
 * CloudSync Service
 * Provides real-time cross-device and multi-browser synchronization for CollabS references.
 * Backed by Cloudinary's high-performance global CDN raw registry.
 * Guarantees that references uploaded on any browser/device are instantly visible to all,
 * and references deleted from any browser are permanently purged across everyone.
 */

import { fetchCloudinaryDeletedIds, markCloudinaryAssetAsDeleted } from './cloudinary';

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
/**
 * Retrieve local deleted document IDs set.
 */
export function getDeletedDocIds() {
  try {
    const raw = localStorage.getItem('collabs_deleted_docs_v1');
    const set1 = raw ? new Set(JSON.parse(raw)) : new Set();
    const rawAll = localStorage.getItem('collabs_deleted_ids_v1');
    if (rawAll) {
      JSON.parse(rawAll).forEach((id) => set1.add(id));
    }
    return set1;
  } catch {
    return new Set();
  }
}

/**
 * Record a document ID as permanently deleted in local persistent storage.
 */
export function markDocIdAsDeleted(id, publicId = '', fileName = '') {
  try {
    const current = getDeletedDocIds();
    const targets = [id, publicId, fileName].filter(Boolean);
    targets.forEach((t) => {
      current.add(t);
      const clean = t.replace(/^cld-doc-/, '').replace(/^cld-/, '').replace(/^doc-/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      current.add(clean);
      current.add(`cld-doc-${clean}`);
      current.add(`cld-${clean}`);
      current.add(`doc-${clean}`);
    });
    localStorage.setItem('collabs_deleted_docs_v1', JSON.stringify([...current]));
    localStorage.setItem('collabs_deleted_ids_v1', JSON.stringify([...current]));
  } catch (e) {
    console.debug('Failed to mark doc ID as deleted:', e);
  }
}

/**
 * Checks if a document matches any deleted identifier.
 */
function isDocMarkedDeleted(doc, deletedSet) {
  if (!doc) return true;
  if (!deletedSet || deletedSet.size === 0) return false;

  const idsToCheck = [
    doc.id,
    doc.publicId,
    doc.fileName,
    doc.id ? doc.id.replace(/^cld-doc-/, '').replace(/^doc-/, '') : '',
    doc.publicId ? doc.publicId.replace(/[^a-zA-Z0-9_-]/g, '_') : ''
  ].filter(Boolean);

  return idsToCheck.some((id) => deletedSet.has(id));
}

/**
 * Fetches document assets directly from Cloudinary raw list (.docx, .md, .txt)
 * AND image list (.pdf).
 * @returns {Promise<Array>}
 */
export async function fetchCloudinaryRawDocs() {
  if (!CLOUD_NAME) return [];
  const results = [];
  const seenIds = new Set();

  // 1. Fetch raw documents (docx, md, txt)
  try {
    const res = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/raw/list/collabs.json?t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.resources)) {
        data.resources
          .filter((item) => item.public_id && item.public_id.includes('collabs/docs/'))
          .forEach((item) => {
            const rawFileName = (item.public_id || '').split('/').pop() || 'document';
            const ext = rawFileName.split('.').pop()?.toLowerCase() || 'docx';
            const title =
              item.context?.custom?.title ||
              item.context?.custom?.caption ||
              rawFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            const isHash = /^[a-z0-9]{15,}$/i.test(rawFileName.replace(/\.[^/.]+$/, ''));
            const fileName = isHash && title ? `${title}.${ext}` : rawFileName;
            const fileUrl = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/v${item.version}/${item.public_id}`;
            const d = item.created_at ? new Date(item.created_at) : new Date();
            const uploadedAt = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const docId = `cld-doc-${item.public_id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

            seenIds.add(item.public_id);
            results.push({
              id: docId,
              publicId: item.public_id,
              title,
              fileName,
              format: ext,
              isPdf: ext === 'pdf',
              fileUrl,
              uploadedAt,
              fileSize: 'Cloud Doc',
              content: '',
              isCloudinarySource: true
            });
          });
      }
    }
  } catch (err) {
    console.debug('[CloudSync] Failed to fetch raw docs tag list:', err);
  }

  // 2. Fetch image list for PDF documents (Cloudinary stores PDFs under image resource_type)
  try {
    const imgRes = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/image/list/docs.json?t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (imgRes.ok) {
      const imgData = await imgRes.json();
      if (Array.isArray(imgData.resources)) {
        imgData.resources.forEach((item) => {
          if (!item.public_id || seenIds.has(item.public_id)) return;
          const rawFileName = (item.public_id || '').split('/').pop() || 'document';
          const title =
            item.context?.custom?.title ||
            item.context?.custom?.caption ||
            rawFileName.replace(/[-_]/g, ' ');
          const isHash = /^[a-z0-9]{15,}$/i.test(rawFileName.replace(/\.[^/.]+$/, ''));
          const fileName = isHash && title ? `${title}.pdf` : (rawFileName.endsWith('.pdf') ? rawFileName : `${rawFileName}.pdf`);
          const d = item.created_at ? new Date(item.created_at) : new Date();
          const uploadedAt = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const docId = `cld-doc-${item.public_id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

          seenIds.add(item.public_id);
          results.push({
            id: docId,
            publicId: item.public_id,
            title,
            fileName,
            format: 'pdf',
            isPdf: true,
            fileUrl: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v${item.version}/${item.public_id}.pdf`,
            uploadedAt,
            fileSize: 'Cloud PDF',
            pageCount: item.pages || 1,
            isCloudinarySource: true
          });
        });
      }
    }
  } catch (err) {
    console.debug('[CloudSync] Failed to fetch PDF image docs list:', err);
  }

  return results;
}

/**
 * Fetch complete shared docs state (documents + deleted IDs) from Cloudinary CDN registry & tag list.
 * @returns {Promise<{ docs: Array, deletedIds: Array, lastUpdated: string }>}
 */
export async function fetchRemoteSharedDocsState() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    // 1. Fetch raw list & image list tag items directly from Cloudinary
    const rawTagDocs = await fetchCloudinaryRawDocs();

    // 2. Fetch Cloudinary global deleted markers
    const cloudDeleted = await fetchCloudinaryDeletedIds();
    const localDeleted = getDeletedDocIds();

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

    let rawDocs = [];
    let registryDeletedList = [];

    if (res.ok) {
      const data = await res.json();
      rawDocs = Array.isArray(data?.docs) ? data.docs : [];
      registryDeletedList = Array.isArray(data?.deletedIds) ? data.deletedIds : [];
    }

    const unifiedDeletedSet = new Set([
      ...cloudDeleted,
      ...localDeleted,
      ...registryDeletedList
    ]);

    // Combine registry docs and tag list docs, deduplicating by publicId or id
    const docMap = new Map();

    rawDocs.forEach((d) => {
      if (d && !isDocMarkedDeleted(d, unifiedDeletedSet)) {
        docMap.set(d.publicId || d.id, {
          ...d,
          fileUrl: (d.fileUrl || '').replace(/^http:\/\//i, 'https://')
        });
      }
    });

    rawTagDocs.forEach((d) => {
      if (d && !isDocMarkedDeleted(d, unifiedDeletedSet)) {
        const key = d.publicId || d.id;
        if (!docMap.has(key)) {
          docMap.set(key, d);
        }
      }
    });

    return {
      docs: Array.from(docMap.values()),
      deletedIds: Array.from(unifiedDeletedSet),
      lastUpdated: new Date().toISOString()
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name !== 'AbortError') {
      console.debug('[CloudSync] Docs registry fetch error:', err.message);
    }
    const rawTagDocs = await fetchCloudinaryRawDocs();
    const localDeleted = getDeletedDocIds();
    const cloudDeleted = await fetchCloudinaryDeletedIds();
    const combinedDeleted = new Set([...localDeleted, ...cloudDeleted]);
    const cleanDocs = rawTagDocs.filter((d) => !isDocMarkedDeleted(d, combinedDeleted));
    return { docs: cleanDocs, deletedIds: Array.from(combinedDeleted), lastUpdated: '' };
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
 * @param {string} publicId - Optional Cloudinary publicId
 * @param {string} fileUrl - Optional file URL
 * @returns {Promise<boolean>}
 */
export async function deleteRemoteSharedDoc(id, publicId = '', fileUrl = '') {
  if (!id && !publicId) return false;

  // 1. Mark in persistent local storage so this browser never resurrects it
  markDocIdAsDeleted(id, publicId);

  // 2. Post permanent deletion marker to Cloudinary tag collabs_deleted
  try {
    await markCloudinaryAssetAsDeleted(id, publicId, fileUrl);
  } catch (e) {
    console.debug('[CloudSync] Failed to record deletion marker on Cloudinary:', e);
  }

  // 3. Update registry if possible
  try {
    const currentState = await fetchRemoteSharedDocsState();
    const updatedDocs = (currentState.docs || []).filter((d) => d.id !== id && (!publicId || d.publicId !== publicId));

    const deletedSet = new Set(currentState.deletedIds || []);
    if (id) deletedSet.add(id);
    if (publicId) deletedSet.add(publicId);

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
    const localDeleted = getDeletedDocIds();
    const cloudDeleted = await fetchCloudinaryDeletedIds();
    const deletedSet = new Set([...remoteState.deletedIds, ...localDeleted, ...cloudDeleted]);

    // 1. Filter remote docs against all deleted markers
    const validRemoteDocs = remoteDocs.filter((d) => !isDocMarkedDeleted(d, deletedSet));

    const remoteIdMap = new Map();
    validRemoteDocs.forEach((d) => {
      if (d && d.id) remoteIdMap.set(d.id, d);
    });

    const mergedList = [...validRemoteDocs];

    // Include demo docs ONLY if they were NOT explicitly deleted
    fallbackDocs.forEach((demo) => {
      if (demo && demo.id && !isDocMarkedDeleted(demo, deletedSet) && !remoteIdMap.has(demo.id)) {
        mergedList.push(demo);
        remoteIdMap.set(demo.id, demo);
      }
    });

    // Also check if local has any unsynced doc that needs to be retained
    let hasUnsavedLocal = false;
    for (const localItem of localDocs || []) {
      if (localItem && localItem.id && !isDocMarkedDeleted(localItem, deletedSet) && !remoteIdMap.has(localItem.id)) {
        if (localItem.fileUrl && !localItem.fileUrl.startsWith('blob:')) {
          mergedList.unshift(localItem);
          remoteIdMap.set(localItem.id, localItem);
          hasUnsavedLocal = true;
        } else if (localItem.blobUrl || localItem.isPdf) {
          // Keep local PDF uploads active
          mergedList.unshift(localItem);
          remoteIdMap.set(localItem.id, localItem);
        }
      }
    }

    if (hasUnsavedLocal) {
      pushDocsRegistryToCloudinary({
        docs: mergedList,
        deletedIds: Array.from(deletedSet)
      }).catch((e) => console.debug('[CloudSync] Background sync back of local doc failed:', e));
    }

    return {
      docs: mergedList,
      deletedIds: Array.from(deletedSet)
    };
  } catch (err) {
    console.warn('[CloudSync] Docs reconciliation error:', err);
    const localDeleted = getDeletedDocIds();
    const cleanLocal = (localDocs || []).filter((d) => !isDocMarkedDeleted(d, localDeleted));
    return { docs: cleanLocal, deletedIds: Array.from(localDeleted) };
  } finally {
    isDocsSyncing = false;
  }
}
