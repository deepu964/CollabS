const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'dtaz4vhxh';
const UPLOAD_PRESET = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) || 'CollabS';

export const isCloudinaryConfigured = () => {
  return Boolean(
    CLOUD_NAME &&
    UPLOAD_PRESET &&
    CLOUD_NAME !== 'your_cloudinary_cloud_name' &&
    UPLOAD_PRESET !== 'your_unsigned_upload_preset'
  );
};

export const getCloudinaryCloudName = () => CLOUD_NAME;

/**
 * Uploads an image or video file to Cloudinary using unsigned upload preset.
 * Supports auto detection (images, videos, animated gifs).
 * @param {File} file - Image or Video file
 * @param {Object} options - Optional { category, title }
 * @returns {Promise<{ url: string, publicId: string, resourceType: string, width: number, height: number, format: string }>}
 */
export async function uploadMediaToCloudinary(file, { category = 'b2b', title = '' } = {}) {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured. Please check VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env file.'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `collabs/${category}`);
  formData.append('tags', `collabs,${category}`);

  if (title) {
    const cleanTitle = title.replace(/[|;=]/g, ' ').trim();
    formData.append('context', `caption=${cleanTitle}|title=${cleanTitle}`);
  }

  // Use auto/upload to accept both images and videos
  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error?.message || 'Failed to upload media to Cloudinary';
    throw new Error(errorMsg);
  }

  const secureUrl = (data.secure_url || data.url || '').replace(/^http:\/\//i, 'https://');

  return {
    url: secureUrl,
    publicId: data.public_id,
    resourceType: data.resource_type || (file.type.startsWith('video/') ? 'video' : 'image'),
    width: data.width,
    height: data.height,
    format: data.format,
    createdAt: data.created_at || new Date().toISOString()
  };
}

// Backward-compatible alias
export const uploadImageToCloudinary = uploadMediaToCloudinary;

/**
 * Ensures optimal Cloudinary image delivery across all browsers with HTTPS and f_auto,q_auto.
 * @param {string} url - Media URL
 * @param {string} resourceType - 'image' or 'video'
 * @returns {string} Optimized URL
 */
export function getOptimizedMediaUrl(url, resourceType = 'image') {
  if (!url || typeof url !== 'string') return '';
  let cleanUrl = url.trim().replace(/^http:\/\//i, 'https://');
  if (
    cleanUrl.includes('res.cloudinary.com') &&
    cleanUrl.includes('/upload/') &&
    !cleanUrl.includes('/f_auto') &&
    resourceType !== 'video' &&
    !cleanUrl.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i)
  ) {
    cleanUrl = cleanUrl.replace('/upload/', '/upload/f_auto,q_auto/');
  }
  return cleanUrl;
}

/**
 * Fetches globally deleted asset IDs recorded on Cloudinary via the collabs_deleted tag list.
 * @returns {Promise<Set<string>>} Set of deleted clean IDs
 */
export async function fetchCloudinaryDeletedIds() {
  if (!isCloudinaryConfigured()) return new Set();

  try {
    const res = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/image/list/collabs_deleted.json?t=${Date.now()}`, {
      cache: 'no-store'
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.resources)) {
        const deletedIds = data.resources.map((r) => {
          return r.public_id.replace('collabs/deleted/', '').replace(/[^a-zA-Z0-9_-]/g, '_');
        });
        return new Set(deletedIds);
      }
    }
  } catch (err) {
    console.debug('Failed to fetch deleted ids marker list:', err);
  }
  return new Set();
}

/**
 * Persists a deletion marker to Cloudinary with tag collabs_deleted.
 * Allows every browser in the world to immediately see that this reference was deleted.
 * @param {string} id - Reference ID
 * @param {string} publicId - Optional Cloudinary publicId
 * @returns {Promise<boolean>}
 */
export async function markCloudinaryAssetAsDeleted(id, publicId = '') {
  if (!isCloudinaryConfigured()) return false;

  const target = (publicId || id || '')
    .replace(/^cld-/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  if (!target) return false;

  try {
    const formData = new FormData();
    // 1x1 transparent png marker
    const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    formData.append('file', blob);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('tags', 'collabs_deleted');
    formData.append('public_id', `collabs/deleted/${target}`);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    });

    return res.ok;
  } catch (err) {
    console.warn('Failed to post deletion marker to Cloudinary:', err);
    return false;
  }
}

/**
 * Retrieves all media items directly from Cloudinary using the collabs tag list JSON.
 * Automatically classifies items into b2b, admin, and driver categories,
 * and strips any assets marked as deleted.
 * @returns {Promise<{ success: boolean, items: Array, requiresSetting?: boolean }>}
 */
export async function fetchAllCloudinaryMedia() {
  if (!isCloudinaryConfigured()) {
    return { success: false, items: [], unconfigured: true };
  }

  const items = [];
  let requiresSetting = false;

  // 1. Fetch globally deleted IDs first
  const globalDeletedSet = await fetchCloudinaryDeletedIds();

  // 2. Fetch collabs global tag list for images
  try {
    const imgRes = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/image/list/collabs.json?t=${Date.now()}`, {
      cache: 'no-store'
    });

    if (imgRes.status === 401 || imgRes.status === 403) {
      requiresSetting = true;
    } else if (imgRes.ok) {
      const data = await imgRes.json();
      if (Array.isArray(data.resources)) {
        data.resources.forEach((res) => {
          // Skip 1x1 test pixels or marker images
          if (res.width <= 10 && res.height <= 10) return;
          if (res.public_id && res.public_id.includes('collabs/deleted/')) return;

          const cleanPublicId = res.public_id.replace(/[^a-zA-Z0-9_-]/g, '_');
          const cleanId = `cld-${cleanPublicId}`;

          // Check if marked as deleted
          if (globalDeletedSet.has(cleanPublicId) || globalDeletedSet.has(cleanId)) {
            return;
          }

          let cat = 'b2b';
          const folder = (res.asset_folder || '').toLowerCase();
          const pub = (res.public_id || '').toLowerCase();

          if (folder.includes('admin') || pub.includes('admin')) cat = 'admin';
          else if (folder.includes('driver') || pub.includes('driver')) cat = 'driver';
          else if (folder.includes('b2b') || pub.includes('b2b')) cat = 'b2b';

          items.push({
            id: cleanId,
            publicId: res.public_id,
            title: res.context?.custom?.caption || res.context?.custom?.title || `${cat.toUpperCase()} Reference`,
            category: cat,
            resourceType: 'image',
            imageUrl: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v${res.version}/${res.public_id}.${res.format}`,
            createdAt: res.created_at,
            isCloudinarySource: true,
          });
        });
      }
    }
  } catch (err) {
    console.debug('Cloudinary collabs tag fetch error:', err);
  }

  // 3. Also check video collabs tag list
  try {
    const vidRes = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/video/list/collabs.json?t=${Date.now()}`, {
      cache: 'no-store'
    });

    if (vidRes.ok) {
      const data = await vidRes.json();
      if (Array.isArray(data.resources)) {
        data.resources.forEach((res) => {
          if (res.public_id && res.public_id.includes('collabs/deleted/')) return;

          const cleanPublicId = res.public_id.replace(/[^a-zA-Z0-9_-]/g, '_');
          const cleanId = `cld-${cleanPublicId}`;

          if (globalDeletedSet.has(cleanPublicId) || globalDeletedSet.has(cleanId)) {
            return;
          }

          let cat = 'b2b';
          const folder = (res.asset_folder || '').toLowerCase();
          const pub = (res.public_id || '').toLowerCase();

          if (folder.includes('admin') || pub.includes('admin')) cat = 'admin';
          else if (folder.includes('driver') || pub.includes('driver')) cat = 'driver';

          items.push({
            id: cleanId,
            publicId: res.public_id,
            title: res.context?.custom?.caption || res.context?.custom?.title || `${cat.toUpperCase()} Video Reference`,
            category: cat,
            resourceType: 'video',
            imageUrl: `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/v${res.version}/${res.public_id}.${res.format}`,
            createdAt: res.created_at,
            isCloudinarySource: true,
          });
        });
      }
    }
  } catch (err) {
    console.debug('Cloudinary video list fetch error:', err);
  }

  return {
    success: items.length > 0,
    items,
    requiresSetting
  };
}

/**
 * Filtered convenience fetch for a specific category.
 * @param {string} category - 'b2b', 'admin', or 'driver'
 * @returns {Promise<{ success: boolean, items: Array, requiresSetting?: boolean }>}
 */
export async function fetchCloudinaryCategoryMedia(category) {
  const all = await fetchAllCloudinaryMedia();
  return {
    success: all.success,
    requiresSetting: all.requiresSetting,
    items: all.items.filter((item) => item.category === category)
  };
}
