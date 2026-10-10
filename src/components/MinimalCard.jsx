import React, { useState } from 'react';
import { Maximize2, Play, Film, Cloud, Trash2, AlertCircle, RefreshCw, ImageOff } from 'lucide-react';
import { getOptimizedMediaUrl } from '../services/cloudinary';

export default function MinimalCard({ reference, onSelect, onDelete }) {
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const domain = reference.sourceUrl ? (() => {
    try {
      return new URL(reference.sourceUrl).hostname.replace('www.', '');
    } catch {
      return '';
    }
  })() : '';

  const isVideo = reference.resourceType === 'video' ||
    Boolean(reference.imageUrl && reference.imageUrl.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i));

  const timeFormatted = reference.createdAt ? (() => {
    try {
      const d = new Date(reference.createdAt);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  })() : '';

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${reference.title}"? This will remove it for everyone.`)) {
      if (onDelete) onDelete(reference.id);
    }
  };

  const handleRetry = (e) => {
    e.stopPropagation();
    setHasError(false);
    setRetryKey((prev) => prev + 1);
  };

  const mediaUrl = getOptimizedMediaUrl(reference.imageUrl, reference.resourceType);

  return (
    <div 
      className="minimal-ref-card"
      onClick={() => onSelect(reference)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(reference);
        }
      }}
    >
      <div className="card-image-frame">
        {hasError ? (
          <div className="card-media-error-placeholder" onClick={(e) => e.stopPropagation()}>
            <ImageOff size={24} className="error-icon" />
            <span className="error-msg">Preview unavailable</span>
            <button
              type="button"
              className="error-retry-btn"
              onClick={handleRetry}
              title="Retry loading image"
            >
              <RefreshCw size={12} />
              <span>Retry</span>
            </button>
          </div>
        ) : isVideo ? (
          <div className="card-video-wrapper">
            <video 
              key={`${reference.id}-vid-${retryKey}`}
              src={mediaUrl} 
              className="card-preview-image video"
              preload="metadata"
              muted
              playsInline
              onError={() => setHasError(true)}
            />
            <div className="video-play-badge">
              <Play size={14} fill="currentColor" />
            </div>
          </div>
        ) : (
          <img 
            key={`${reference.id}-img-${retryKey}`}
            src={mediaUrl} 
            alt={reference.title} 
            loading="lazy"
            decoding="async"
            className="card-preview-image"
            onError={() => setHasError(true)}
          />
        )}

        <div className="card-hover-overlay">
          <span className="expand-indicator">
            <Maximize2 size={13} />
            <span>{isVideo ? 'Play Video' : 'Full View'}</span>
          </span>
        </div>

        {/* Media type tag */}
        <div className="card-corner-tags">
          {isVideo && (
            <span className="corner-tag video-tag">
              <Film size={11} />
              <span>Video</span>
            </span>
          )}
          {reference.isCloudinarySource !== false && (
            <span className="corner-tag cloud-tag" title="Hosted on Cloud CDN">
              <Cloud size={11} />
            </span>
          )}
        </div>

        {/* Delete action button */}
        {onDelete && (
          <button
            type="button"
            className="card-delete-btn"
            title="Delete this item (removes for everyone)"
            aria-label="Delete this reference"
            onClick={handleDelete}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="card-caption">
        <h3 className="card-caption-title">{reference.title}</h3>
        <div className="card-caption-meta">
          {domain && <span className="caption-domain">{domain}</span>}
          {timeFormatted && <span className="caption-date">{timeFormatted}</span>}
        </div>
      </div>
    </div>
  );
}
