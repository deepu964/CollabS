import React, { useState } from 'react';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  Users,
  AlertCircle,
  Loader2,
  ArrowRight,
  LogOut,
  X
} from 'lucide-react';
import { invitationService } from '../services/invitationService';

export default function AcceptInviteModal({
  invitation,
  token,
  currentUser,
  onAccepted,
  onClose,
  onRequireLogin
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!invitation || !token) return null;

  const isEmailMatching =
    currentUser &&
    currentUser.email.toLowerCase() === invitation.email.toLowerCase();

  const handleAccept = async () => {
    setIsLoading(true);
    setErrorMsg('');

    const res = await invitationService.acceptInvitation(token);
    setIsLoading(false);

    if (res.success && res.project) {
      setSuccessMsg(res.message);
      setTimeout(() => {
        onAccepted(res.project);
      }, 500);
    } else {
      setErrorMsg(res.error || 'Failed to accept invitation.');
    }
  };

  return (
    <div className="collabs-auth-gate-backdrop">
      <div className="collabs-auth-gate-card accept-invite-card">
        {/* Header */}
        <div className="project-modal-header">
          <div className="project-modal-brand-row">
            <div className="auth-brand-pill">
              <span className="auth-brand-text">CollabS Invitation</span>
            </div>
            <button
              type="button"
              className="project-modal-close-btn"
              onClick={onClose}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
          <h2 className="project-modal-title">You've Been Invited!</h2>
          <p className="project-modal-subtitle">
            <strong>{invitation.inviterName}</strong> has invited you to join the workspace for <strong>"{invitation.projectName}"</strong>.
          </p>
        </div>

        {/* Invitation Summary Card */}
        <div className="invite-summary-box">
          <div className="invite-summary-row">
            <span className="summary-label">Project:</span>
            <span className="summary-value project-name" style={{ color: invitation.projectColor || '#3b82f6' }}>
              {invitation.projectName}
            </span>
          </div>
          <div className="invite-summary-row">
            <span className="summary-label">Assigned Team:</span>
            <span className="summary-badge team">
              <Users size={12} />
              <span>{invitation.team}</span>
            </span>
          </div>
          <div className="invite-summary-row">
            <span className="summary-label">Invited Email:</span>
            <span className="summary-value email">{invitation.email}</span>
          </div>
        </div>

        {/* Error / Success alert */}
        {errorMsg && (
          <div className="auth-error-banner" role="alert" style={{ marginBottom: 12 }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-success-banner" role="status" style={{ marginBottom: 12 }}>
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Action Controls based on Authentication state */}
        {!currentUser ? (
          <div className="invite-actions-state">
            <p className="invite-auth-note">
              Please sign in or create an account with <strong>{invitation.email}</strong> to join this project.
            </p>
            <button
              type="button"
              className="auth-submit-btn modern-submit"
              onClick={onRequireLogin}
            >
              <span>Sign In / Register to Accept</span>
              <ArrowRight size={15} />
            </button>
          </div>
        ) : !isEmailMatching ? (
          <div className="invite-actions-state">
            <div className="auth-error-banner" style={{ textAlign: 'left', marginBottom: 14 }}>
              <AlertCircle size={16} />
              <span>
                You are currently signed in as <strong>{currentUser.email}</strong>. This invitation is for <strong>{invitation.email}</strong>.
              </span>
            </div>
            <p className="invite-auth-note">
              Please switch to the invited account to accept access to this workspace.
            </p>
          </div>
        ) : (
          <div className="invite-actions-state">
            <button
              type="button"
              disabled={isLoading}
              className="auth-submit-btn modern-submit"
              onClick={handleAccept}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="spinner-icon" />
                  <span>Joining Project...</span>
                </>
              ) : (
                <>
                  <span>Accept & Enter Project</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
