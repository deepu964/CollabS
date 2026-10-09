import React from 'react';
import { Maximize2, Play, Film, Cloud, Trash2 } from 'lucide-react';

export default function MinimalCard({ reference, onSelect, onDelete }) {
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
    if (window.confirm(`Delete "${reference.title}"?`)) {
      if (onDelete) onDelete(reference.id);
    }
  };

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
        {isVideo ? (
          <div className="card-video-wrapper">
            <video 
              src={reference.imageUrl} 
              className="card-preview-image video"
              preload="metadata"
              muted
              playsInline
            />
            <div className="video-play-badge">
              <Play size={14} fill="currentColor" />
            </div>
          </div>
        ) : (
          <img 
            src={reference.imageUrl} 
            alt={reference.title} 
            loading="lazy"
            className="card-preview-image"
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
          {reference.isCloudinarySource && (
            <span className="corner-tag cloud-tag" title="Stored on Cloudinary CDN">
              <Cloud size={11} />
            </span>
          )}
        </div>

        {/* Delete action button */}
        {onDelete && (
          <button
            type="button"
            className="card-delete-btn"
            title="Delete this item"
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
