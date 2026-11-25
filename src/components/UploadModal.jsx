import React, { useState, useEffect, useRef } from 'react';
import { X, UploadCloud, Link2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { uploadImageToCloudinary, isCloudinaryConfigured } from '../services/cloudinary';

const SAMPLE_PRESETS = [
  {
    name: 'Driver Route & Dispatch',
    category: 'driver',
    deviceType: 'Mobile',
    url: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&auto=format&fit=crop&q=80',
    sourceUrl: 'https://uber.com/drive'
  },
  {
    name: 'Admin Telemetry Matrix',
    category: 'admin',
    deviceType: 'Desktop',
    url: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1200&auto=format&fit=crop&q=80',
    sourceUrl: 'https://datadoghq.com'
  },
  {
    name: 'B2B Invoice Ledger',
    category: 'b2b',
    deviceType: 'Desktop',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&auto=format&fit=crop&q=80',
    sourceUrl: 'https://stripe.com'
  },
  {
    name: 'Driver Shift Earnings',
    category: 'driver',
    deviceType: 'Mobile',
    url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&auto=format&fit=crop&q=80',
    sourceUrl: 'https://lyft.com'
  }
];

export default function UploadModal({
  isOpen,
  onClose,
  onAddReference,
  onError,
  defaultCategory = 'all',
  projectSides = [],
  projectId = ''
}) {
  const [title, setTitle] = useState('');
  const fallbackSideId = projectSides[0]?.id || 'general';
  const [category, setCategory] = useState(() => (defaultCategory === 'all' || !defaultCategory ? fallbackSideId : defaultCategory));
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const cloudinaryReady = isCloudinaryConfigured();

  useEffect(() => {
    if (!defaultCategory || defaultCategory === 'all') {
      setCategory(projectSides[0]?.id || 'general');
    } else {
      setCategory(defaultCategory);
    }
  }, [defaultCategory, isOpen, projectSides]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleFileUpload = (file) => {
    if (!file) return;

    const fileIsVideo = file.type.startsWith('video/');
    const fileIsImage = file.type.startsWith('image/');

    if (!fileIsVideo && !fileIsImage) {
      setError('Please upload a valid image or video file (PNG, JPG, WebP, MP4, WebM)');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setImageUrl('');
    setError('');

    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleClearImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setImageUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile && !imageUrl.trim()) {
      setError('Please provide an image file or enter an image URL');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      let finalImageUrl = imageUrl.trim();

      let uploadedPublicId = '';
      const effectiveCategory = (!category || category === 'all') ? fallbackSideId : category;
      const fileIsVideo = selectedFile?.type?.startsWith('video/') || false;
      let resourceType = fileIsVideo ? 'video' : 'image';

      // If user uploaded a local image or video file
      if (selectedFile) {
        if (cloudinaryReady) {
          setStatusText('Uploading to Cloudinary...');
          try {
            const uploadRes = await uploadImageToCloudinary(selectedFile, {
              category: effectiveCategory,
              title: title.trim(),
              projectId
            });
            finalImageUrl = (uploadRes.url || '').replace(/^http:\/\//i, 'https://');
            uploadedPublicId = uploadRes.publicId || '';
            resourceType = uploadRes.resourceType || resourceType;
          } catch (cldErr) {
            console.warn('Cloudinary upload issue, saving locally:', cldErr);
            setStatusText('Processing local file...');
            finalImageUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (event) => resolve(event.target.result);
              reader.onerror = reject;
              reader.readAsDataURL(selectedFile);
            });
          }
        } else {
          // Fallback to base64 if Cloudinary is not configured yet
          setStatusText('Processing local file...');
          finalImageUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });
        }
      }

      setStatusText('Saving reference...');
      const finalTitle =
        title.trim() ||
        `${effectiveCategory.toUpperCase()} Reference #${Math.floor(Math.random() * 900 + 100)}`;

      await onAddReference({
        id: uploadedPublicId
          ? `cld-${uploadedPublicId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
          : `ref-${Date.now()}`,
        projectId: projectId || undefined,
        publicId: uploadedPublicId,
        title: finalTitle,
        category: effectiveCategory,
        imageUrl: finalImageUrl.replace(/^http:\/\//i, 'https://'),
        resourceType,
        sourceUrl: sourceUrl.trim() || '',
        deviceType: effectiveCategory === 'driver' ? 'Mobile' : 'Desktop',
        createdAt: new Date().toISOString(),
        isLocalUnsynced: true,
        isCloudinarySource: Boolean(uploadedPublicId)
      });

      // Reset and close
      handleClearImage();
      setTitle('');
      setSourceUrl('');
      setError('');
      onClose();
    } catch (err) {
      console.error('Submit error:', err);
      const msg = err.message || 'Failed to upload image. Please verify your Cloudinary settings.';
      setError(msg);
      if (onError) onError(msg);
    } finally {
      setIsSubmitting(false);
      setStatusText('');
    }
  };

  return (
    <div className="upload-overlay" onClick={isSubmitting ? undefined : onClose} role="dialog" aria-modal="true">
      <div className="upload-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="upload-header">
          <div className="upload-header-text">
            <h2 className="upload-heading">Add UI Reference</h2>
            <span className="upload-subheading">Share design screens across your team</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="upload-close-btn"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Configuration Notice if Cloudinary is not set up */}
        {!cloudinaryReady && (
          <div className="cloud-notice-banner">
            <AlertCircle size={14} className="notice-icon" />
            <div className="notice-text">
              <strong>Cloudinary not configured:</strong> Images will only be stored locally in this browser. Configure Cloudinary in <code>.env</code> / Vercel to make uploads visible to everyone.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="upload-form">
          {/* Project Side Selector */}
          {projectSides && projectSides.length > 0 && (
            <div className="upload-field">
              <label className="upload-label">Project Side / Pillar</label>
              <div className="upload-pillar-tabs">
                {projectSides.map((side) => (
                  <button
                    key={side.id}
                    type="button"
                    className={`pillar-tab ${category === side.id ? 'active' : ''}`}
                    onClick={() => setCategory(side.id)}
                    disabled={isSubmitting}
                  >
                    {side.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Media Input Area (File Drop or URL) */}
          <div className="upload-field">
            <label className="upload-label">UI Screenshot or Video</label>

            {previewUrl || imageUrl ? (
              <div className="image-preview-box">
                {selectedFile?.type?.startsWith('video/') ? (
                  <video src={previewUrl} className="preview-img" autoPlay muted loop playsInline />
                ) : (
                  <img src={previewUrl || imageUrl} alt="Preview" className="preview-img" />
                )}
                <button
                  type="button"
                  onClick={handleClearImage}
                  disabled={isSubmitting}
                  className="remove-img-btn"
                  title="Remove media"
                >
                  <X size={13} />
                  <span>Replace</span>
                </button>
              </div>
            ) : (
              <div
                className={`dropzone ${dragActive ? 'active' : ''}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                  disabled={isSubmitting}
                />
                <UploadCloud size={24} className="dropzone-icon" />
                <p className="dropzone-text">Click to choose image or video, or drag & drop</p>
                <span className="dropzone-sub">
                  {cloudinaryReady
                    ? 'Uploaded directly to Cloudinary CDN'
                    : 'PNG, JPG, WebP, MP4, WebM supported'}
                </span>
              </div>
            )}

            {/* Direct URL input */}
            <div className="url-input-wrap">
              <Link2 size={13} className="url-icon" />
              <input
                type="url"
                placeholder="Or paste public image URL..."
                value={previewUrl ? '' : imageUrl}
                disabled={isSubmitting}
                onChange={(e) => {
                  if (previewUrl) handleClearImage();
                  setImageUrl(e.target.value);
                  setError('');
                }}
                className="upload-input"
              />
            </div>

            {/* Quick Presets */}
            <div className="sample-presets">
              <span className="sample-label">Quick samples:</span>
              <div className="sample-chips">
                {SAMPLE_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={isSubmitting}
                    className="sample-chip"
                    onClick={() => {
                      handleClearImage();
                      setImageUrl(p.url);
                      setTitle(p.name);
                      setCategory(p.category);
                      setSourceUrl(p.sourceUrl);
                      setError('');
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {error && <span className="upload-error">{error}</span>}
          </div>

          {/* Reference Title */}
          <div className="upload-field">
            <label className="upload-label">Title / Screen Name</label>
            <input
              type="text"
              placeholder="e.g. Live Route Navigation Screen"
              value={title}
              disabled={isSubmitting}
              onChange={(e) => setTitle(e.target.value)}
              className="upload-input"
            />
          </div>

          {/* Source Link (Optional) */}
          <div className="upload-field">
            <label className="upload-label">Source URL (Optional)</label>
            <input
              type="url"
              placeholder="https://..."
              value={sourceUrl}
              disabled={isSubmitting}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="upload-input"
            />
          </div>

          {/* Footer Submit */}
          <div className="upload-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="upload-btn cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="upload-btn primary"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="spin-animation" />
                  <span>{statusText || 'Uploading...'}</span>
                </>
              ) : (
                <span>Add Reference</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
