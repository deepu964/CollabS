const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

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

  return {
    url: data.secure_url || data.url,
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
 * Attempts to retrieve media items directly from Cloudinary using tag list JSON.
 * Note: Cloudinary requires "Resource list" to be enabled in Security Settings for public tag listing.
 * @param {string} category - 'b2b', 'admin', or 'driver'
 * @returns {Promise<{ success: boolean, items: Array, requiresSetting?: boolean }>}
 */
export async function fetchCloudinaryCategoryMedia(category) {
  if (!isCloudinaryConfigured()) {
    return { success: false, items: [], unconfigured: true };
  }

  const items = [];
  let requiresSetting = false;

  // Try image list
  try {
    const imgRes = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/image/list/${category}.json`, {
      cache: 'no-store'
    });

    if (imgRes.status === 401 || imgRes.status === 403) {
      requiresSetting = true;
    } else if (imgRes.ok) {
      const data = await imgRes.json();
      if (Array.isArray(data.resources)) {
        data.resources.forEach((res) => {
          items.push({
            id: `cld-${res.public_id}`,
            publicId: res.public_id,
            title: res.context?.custom?.caption || res.context?.custom?.title || `${category.toUpperCase()} Reference`,
            category,
            resourceType: 'image',
            imageUrl: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v${res.version}/${res.public_id}.${res.format}`,
            createdAt: res.created_at,
            isCloudinarySource: true,
          });
        });
      }
    }
  } catch (err) {
    console.debug('Cloudinary image list fetch error:', err);
  }

  // Try video list
  try {
    const vidRes = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/video/list/${category}.json`, {
      cache: 'no-store'
    });

    if (vidRes.ok) {
      const data = await vidRes.json();
      if (Array.isArray(data.resources)) {
        data.resources.forEach((res) => {
          items.push({
            id: `cld-${res.public_id}`,
            publicId: res.public_id,
            title: res.context?.custom?.caption || res.context?.custom?.title || `${category.toUpperCase()} Video Reference`,
            category,
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
