import React, { useState, useEffect, useRef } from 'react';
import { X, UploadCloud, Image as ImageIcon, Link2, Sparkles, Check } from 'lucide-react';

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
  const [sourceUrl, setSourceUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    setCategory(defaultCategory === 'all' ? 'b2b' : defaultCategory);
  }, [defaultCategory, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileUpload = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUrl(e.target.result);
      setError('');
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!imageUrl.trim()) {
      setError('Please provide an image URL or choose a file');
      return;
    }

    const finalTitle = title.trim() || `${category.toUpperCase()} Reference #${Math.floor(Math.random() * 900 + 100)}`;

    onAddReference({
      id: `ref-${Date.now()}`,
      title: finalTitle,
      category,
      imageUrl: imageUrl.trim(),
      sourceUrl: sourceUrl.trim() || '',
      deviceType: category === 'driver' ? 'Mobile' : 'Desktop',
      createdAt: new Date().toISOString()
    });

    // Reset and close
    setTitle('');
    setImageUrl('');
    setSourceUrl('');
    setError('');
    onClose();
  };

  return (
    <div className="upload-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="upload-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="upload-header">
          <h2 className="upload-heading">Add UI Reference</h2>
          <button type="button" onClick={onClose} className="upload-close-btn" aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          {/* Pillar Selector */}
          <div className="upload-field">
            <label className="upload-label">Product Pillar</label>
            <div className="upload-pillar-tabs">
              <button
                type="button"
                className={`pillar-tab ${category === 'b2b' ? 'active' : ''}`}
                onClick={() => setCategory('b2b')}
              >
                B2B Portal
              </button>
              <button
                type="button"
                className={`pillar-tab ${category === 'admin' ? 'active' : ''}`}
                onClick={() => setCategory('admin')}
              >
                Admin Console
              </button>
              <button
                type="button"
                className={`pillar-tab ${category === 'driver' ? 'active' : ''}`}
                onClick={() => setCategory('driver')}
              >
                Driver App
              </button>
            </div>
          </div>

          {/* Image Input Area (File Drop or URL) */}
          <div className="upload-field">
            <label className="upload-label">UI Screenshot</label>
            
            {imageUrl ? (
              <div className="image-preview-box">
                <img src={imageUrl} alt="Preview" className="preview-img" />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
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
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                />
                <UploadCloud size={24} className="dropzone-icon" />
                <p className="dropzone-text">Click to choose image or drag & drop</p>
                <span className="dropzone-sub">PNG, JPG, WebP supported</span>
              </div>
            )}

            {/* Direct URL input */}
            <div className="url-input-wrap">
              <Link2 size={13} className="url-icon" />
              <input
                type="url"
                placeholder="Or paste image URL from web..."
                value={imageUrl.startsWith('data:') ? '' : imageUrl}
                onChange={(e) => {
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
                    className="sample-chip"
                    onClick={() => {
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
              onChange={(e) => setSourceUrl(e.target.value)}
              className="upload-input"
            />
          </div>

          {/* Footer Submit */}
          <div className="upload-footer">
            <button type="button" onClick={onClose} className="upload-btn cancel">
              Cancel
            </button>
            <button type="submit" className="upload-btn primary">
              Add Reference
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
