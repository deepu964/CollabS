import React, { useState, useEffect } from 'react';
import { X, ExternalLink, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, Trash2, AlertCircle } from 'lucide-react';
import { getOptimizedMediaUrl } from '../services/cloudinary';

export default function FullscreenLightbox({
  reference,
  allCategoryReferences,
  onClose,
  onSelectReference,
  onDelete
}) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
    setIsZoomed(false);
  }, [reference?.id]);

  const isVideo = reference?.resourceType === 'video' ||
    Boolean(reference?.imageUrl && reference.imageUrl.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i));

  // Keyboard navigation: Escape to close, Arrow keys to navigate
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        navigateNext();
      } else if (e.key === 'ArrowLeft') {
        navigatePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reference, allCategoryReferences]);

  if (!reference) return null;

  const currentIndex = allCategoryReferences.findIndex(r => r.id === reference.id);
  const total = allCategoryReferences.length;

  const navigateNext = () => {
    if (total <= 1) return;
    const nextIdx = (currentIndex + 1) % total;
    onSelectReference(allCategoryReferences[nextIdx]);
    setIsZoomed(false);
  };

  const navigatePrev = () => {
    if (total <= 1) return;
    const prevIdx = (currentIndex - 1 + total) % total;
    onSelectReference(allCategoryReferences[prevIdx]);
    setIsZoomed(false);
  };

  const domain = reference.sourceUrl ? (() => {
    try {
      return new URL(reference.sourceUrl).hostname.replace('www.', '');
    } catch {
      return '';
    }
  })() : '';

  const handleDelete = () => {
    if (window.confirm(`Delete "${reference.title}"?`)) {
      if (onDelete) {
        onDelete(reference.id);
      }
      onClose();
    }
  };

  return (
    <div className="lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true">
      {/* Top Floating Apple Bar */}
      <div className="lightbox-top-bar" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-meta">
          <h2 className="lightbox-title">{reference.title}</h2>
          {total > 0 && currentIndex >= 0 && (
            <span className="lightbox-counter">{currentIndex + 1} of {total}</span>
          )}
        </div>

        <div className="lightbox-actions">
          {domain && (
            <a
              href={reference.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="lightbox-btn"
              title={`Open ${domain}`}
            >
              <span>{domain}</span>
              <ExternalLink size={13} />
            </a>
          )}

          {!isVideo && (
            <button
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              className="lightbox-btn"
              title={isZoomed ? "Fit to screen" : "Actual size zoom"}
            >
              {isZoomed ? <ZoomOut size={15} /> : <ZoomIn size={15} />}
              <span>{isZoomed ? "Fit" : "100%"}</span>
            </button>
          )}

          <a
            href={reference.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="lightbox-btn"
            title="Open / Download original asset"
          >
            <Download size={14} />
          </a>

          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="lightbox-btn delete-btn"
              title="Delete reference"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="lightbox-btn close"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigatePrev();
            }}
            className="lightbox-nav-btn prev"
            aria-label="Previous reference"
            title="Previous (←)"
          >
            <ChevronLeft size={22} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigateNext();
            }}
            className="lightbox-nav-btn next"
            aria-label="Next reference"
            title="Next (→)"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Full-Viewport Media Container */}
      <div 
        className={`lightbox-canvas ${isZoomed ? 'zoomed' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {loadError ? (
          <div className="lightbox-error-msg" onClick={(e) => e.stopPropagation()}>
            <AlertCircle size={32} />
            <p>Failed to load full media file.</p>
            <a
              href={reference.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="lightbox-error-link"
            >
              Open direct URL in new tab
            </a>
          </div>
        ) : isVideo ? (
          <video
            src={getOptimizedMediaUrl(reference.imageUrl, 'video')}
            controls
            autoPlay
            loop
            playsInline
            className="lightbox-full-video"
            onClick={(e) => e.stopPropagation()}
            onError={() => setLoadError(true)}
          />
        ) : (
          <img
            src={getOptimizedMediaUrl(reference.imageUrl, 'image')}
            alt={reference.title}
            className="lightbox-full-img"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(!isZoomed);
            }}
            title="Click to toggle zoom"
            onError={() => setLoadError(true)}
          />
        )}
      </div>
    </div>
  );
}
