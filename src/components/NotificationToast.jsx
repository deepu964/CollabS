import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';

export default function NotificationToast({ toast }) {
  if (!toast) return null;

  return (
    <div className="apple-toast-portal">
      <div className="apple-floating-toast">
        {toast.type === 'info' ? (
          <Info size={16} className="toast-icon info" />
        ) : (
          <CheckCircle2 size={16} className="toast-icon success" />
        )}
        <span className="toast-message">{toast.message}</span>
      </div>
    </div>
  );
}
