import React, { useEffect } from 'react';
import { UserCheck, X, LogOut, ArrowRight, Shield } from 'lucide-react';

export default function SwitchRoleModal({
  isOpen,
  member,
  onConfirmSwitch,
  onClose
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !member) return null;

  return (
    <div className="collabs-switch-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="collabs-switch-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          type="button"
          className="switch-modal-close-btn"
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={15} />
        </button>

        {/* Icon Badge */}
        <div
          className="switch-modal-icon-badge"
          style={{
            backgroundColor: `${member.badgeColor || '#3b82f6'}18`,
            color: member.badgeColor || '#3b82f6'
          }}
        >
          <UserCheck size={28} />
        </div>

        {/* Title & Description */}
        <h3 className="switch-modal-title">Switch Team Member Role?</h3>
        <p className="switch-modal-desc">
          You are currently logged in as <strong>{member.name}</strong> ({member.roleName || member.shortName}).
          Switching will lock this session and return you to the 5-role security PIN gate.
        </p>

        {/* Active Session Info Box */}
        <div className="switch-modal-session-card">
          <span
            className="session-role-dot"
            style={{ backgroundColor: member.badgeColor || '#3b82f6' }}
          />
          <div className="session-info-text">
            <span className="session-member-name">{member.name}</span>
            <span className="session-member-role">{member.roleName || member.shortName}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="switch-modal-actions">
          <button
            type="button"
            className="switch-modal-cancel-btn"
            onClick={onClose}
          >
            Stay as {member.shortName}
          </button>
          <button
            type="button"
            className="switch-modal-confirm-btn"
            onClick={onConfirmSwitch}
          >
            <LogOut size={15} />
            <span>Switch Role</span>
          </button>
        </div>
      </div>
    </div>
  );
}
