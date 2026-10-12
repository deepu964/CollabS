import React from 'react';
import { CheckCircle2, Info, AlertCircle, Trash2, X } from 'lucide-react';

export default function NotificationToast({ toast, onClose }) {
  if (!toast) return null;

  const type = toast.type || 'success';

  return (
    <div className="apple-toast-portal" role="status" aria-live="polite">
      <div className={`apple-floating-toast toast-${type}`}>
        <div className="toast-icon-wrap">
          {type === 'delete' || type === 'trash' ? (
            <Trash2 size={15} className="toast-icon delete" />
          ) : type === 'error' ? (
            <AlertCircle size={15} className="toast-icon error" />
          ) : type === 'info' ? (
            <Info size={15} className="toast-icon info" />
          ) : (
            <CheckCircle2 size={15} className="toast-icon success" />
          )}
        </div>

        <span className="toast-message">{toast.message}</span>

        {onClose && (
          <button
            type="button"
            className="toast-close-btn"
            onClick={onClose}
            aria-label="Dismiss toast"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
