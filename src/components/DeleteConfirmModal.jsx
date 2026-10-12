import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

export default function DeleteConfirmModal({
  isOpen,
  item,
  title,
  message,
  onConfirm,
  onCancel,
  isDeleting = false
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, isDeleting]);

  if (!isOpen) return null;

  const itemTitle = item?.title || item?.fileName || 'this item';
  const previewUrl = item?.imageUrl || item?.thumbnailUrl || null;
  const isVideo = item?.resourceType === 'video' || (item?.imageUrl && item?.imageUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i));

  const modalHeading = title || (
    item?.format || item?.isPdf ? 'Delete Document?' :
    isVideo ? 'Delete Video?' : 'Delete Image?'
  );

  return (
    <div
      className="delete-modal-overlay"
      onClick={isDeleting ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="delete-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Icon Button */}
        <button
          type="button"
          className="delete-modal-close"
          onClick={onCancel}
          disabled={isDeleting}
          aria-label="Close"
        >
          <X size={15} />
        </button>

        {/* Warning Icon Badge */}
        <div className="delete-modal-icon-badge">
          <Trash2 size={24} />
        </div>

        {/* Header & Description */}
        <div className="delete-modal-header">
          <h3 className="delete-modal-title">{modalHeading}</h3>
          <p className="delete-modal-text">
            {message || (
              <>
                Are you sure you want to delete <strong>"{itemTitle}"</strong>? This will permanently remove it for all team members.
              </>
            )}
          </p>
        </div>

        {/* Optional Media Preview Thumbnail */}
        {previewUrl && (
          <div className="delete-modal-thumbnail-wrap">
            {isVideo ? (
              <video src={previewUrl} className="delete-modal-thumbnail" muted />
            ) : (
              <img src={previewUrl} alt={itemTitle} className="delete-modal-thumbnail" />
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="delete-modal-actions">
          <button
            type="button"
            className="delete-btn-cancel"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="delete-btn-confirm"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <Trash2 size={14} />
            <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
