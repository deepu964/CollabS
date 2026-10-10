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
  defaultCategory = 'b2b'
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(defaultCategory);
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
    setCategory(defaultCategory === 'all' ? 'b2b' : defaultCategory);
  }, [defaultCategory, isOpen]);

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
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
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
      // If user uploaded a local image file
      if (selectedFile) {
        if (cloudinaryReady) {
          setStatusText('Uploading to Cloudinary...');
          const uploadRes = await uploadImageToCloudinary(selectedFile, {
            category,
            title: title.trim()
          });
          finalImageUrl = (uploadRes.url || '').replace(/^http:\/\//i, 'https://');
          uploadedPublicId = uploadRes.publicId || '';
        } else {
          // Fallback to base64 if Cloudinary is not configured yet
          setStatusText('Processing local image...');
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
        `${category.toUpperCase()} Reference #${Math.floor(Math.random() * 900 + 100)}`;

      await onAddReference({
        id: uploadedPublicId
          ? `cld-${uploadedPublicId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
          : `ref-${Date.now()}`,
        publicId: uploadedPublicId,
        title: finalTitle,
        category,
        imageUrl: finalImageUrl.replace(/^http:\/\//i, 'https://'),
        sourceUrl: sourceUrl.trim() || '',
        deviceType: category === 'driver' ? 'Mobile' : 'Desktop',
        createdAt: new Date().toISOString(),
        isLocalUnsynced: true,
        isCloudinarySource: cloudinaryReady
      });

      // Reset and close
      handleClearImage();
      setTitle('');
      setSourceUrl('');
      setError('');
      onClose();
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to upload image. Please verify your Cloudinary settings.');
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
          {/* Pillar Selector */}
          <div className="upload-field">
            <label className="upload-label">Product Pillar</label>
            <div className="upload-pillar-tabs">
              <button
                type="button"
                className={`pillar-tab ${category === 'b2b' ? 'active' : ''}`}
                onClick={() => setCategory('b2b')}
                disabled={isSubmitting}
              >
                B2B Portal
              </button>
              <button
                type="button"
                className={`pillar-tab ${category === 'admin' ? 'active' : ''}`}
                onClick={() => setCategory('admin')}
                disabled={isSubmitting}
              >
                Admin Console
              </button>
              <button
                type="button"
                className={`pillar-tab ${category === 'driver' ? 'active' : ''}`}
                onClick={() => setCategory('driver')}
                disabled={isSubmitting}
              >
                Driver App
              </button>
            </div>
          </div>

          {/* Image Input Area (File Drop or URL) */}
          <div className="upload-field">
            <label className="upload-label">UI Screenshot</label>

            {previewUrl || imageUrl ? (
              <div className="image-preview-box">
                <img src={previewUrl || imageUrl} alt="Preview" className="preview-img" />
                <button
                  type="button"
                  onClick={handleClearImage}
                  disabled={isSubmitting}
                  className="remove-img-btn"
                  title="Remove image"
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
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                  disabled={isSubmitting}
                />
                <UploadCloud size={24} className="dropzone-icon" />
                <p className="dropzone-text">Click to choose image or drag & drop</p>
                <span className="dropzone-sub">
                  {cloudinaryReady
                    ? 'Uploaded directly to Cloudinary CDN'
                    : 'PNG, JPG, WebP supported'}
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
