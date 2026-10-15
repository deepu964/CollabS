import React, { useState } from 'react';
import {
  ShieldCheck,
  Database,
  Building2,
  Truck,
  CheckCircle2,
  Lock,
  ArrowRight,
  ChevronLeft,
  KeyRound,
  User,
  AlertCircle
} from 'lucide-react';
import { TEAM_MEMBERS_CONFIG, authService } from '../services/authService';

const ICON_COMPONENTS = {
  ShieldCheck,
  Database,
  Building2,
  Truck,
  CheckCircle2
};

export default function TeamAuthGate({ onAuthenticated }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [pin, setPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    setPin('');
    setErrorMsg('');
    setDisplayName('');
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!selectedRole) return;
    if (!pin.trim()) {
      setErrorMsg('Please enter your 4-digit PIN');
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    setTimeout(() => {
      const result = authService.verifyPin(selectedRole.id, pin, displayName);

      if (result.success) {
        onAuthenticated(result.member);
      } else {
        setErrorMsg(result.error || 'Incorrect PIN');
        triggerShake();
        setIsSubmitting(false);
      }
    }, 250);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div className="collabs-auth-gate-backdrop">
      <div className={`collabs-auth-gate-card ${shake ? 'shake-animation' : ''}`}>
        {/* Brand Header */}
        <div className="auth-gate-header">
          <div className="auth-brand-pill">
            <span className="brand-dot" />
            <span className="auth-brand-text">CollabS Security Gate</span>
          </div>
          <h1 className="auth-gate-title">
            {selectedRole ? `Verify ${selectedRole.name}` : 'Authorized Team Access'}
          </h1>
          <p className="auth-gate-subtitle">
            {selectedRole
              ? 'Enter your 4-digit PIN to authenticate your session'
              : 'This deployment is restricted. Select your assigned pillar to continue.'}
          </p>
        </div>

        {/* STEP 1: Select Role */}
        {!selectedRole ? (
          <div className="auth-roles-grid">
            {TEAM_MEMBERS_CONFIG.map((role) => {
              const IconComponent = ICON_COMPONENTS[role.icon] || ShieldCheck;
              return (
                <button
                  key={role.id}
                  type="button"
                  className="auth-role-card-btn"
                  onClick={() => handleSelectRole(role)}
                  style={{ '--role-color': role.badgeColor }}
                >
                  <div
                    className="role-card-icon-box"
                    style={{ backgroundColor: `${role.badgeColor}18`, color: role.badgeColor }}
                  >
                    <IconComponent size={24} />
                  </div>
                  <div className="role-card-info">
                    <span className="role-card-name">{role.name}</span>
                    <span className="role-card-desc">{role.description}</span>
                  </div>
                  <ArrowRight size={16} className="role-card-arrow" />
                </button>
              );
            })}
          </div>
        ) : (
          /* STEP 2: Enter PIN & Name */
          <form className="auth-pin-form" onSubmit={handleSubmit}>
            <button
              type="button"
              className="auth-back-to-roles-btn"
              onClick={() => {
                setSelectedRole(null);
                setErrorMsg('');
              }}
            >
              <ChevronLeft size={16} />
              <span>Choose different role</span>
            </button>

            {/* Selected Role Badge */}
            <div
              className="auth-selected-role-banner"
              style={{
                backgroundColor: `${selectedRole.badgeColor}15`,
                borderColor: `${selectedRole.badgeColor}40`,
                color: selectedRole.badgeColor
              }}
            >
              <Lock size={15} />
              <span>Authenticating as <strong>{selectedRole.name}</strong></span>
            </div>

            {/* Name Input */}
            <div className="auth-input-group">
              <label htmlFor="auth-name-input">
                <User size={13} />
                <span>Your Name (optional):</span>
              </label>
              <input
                id="auth-name-input"
                type="text"
                className="auth-text-field"
                placeholder={`e.g. Deepak (${selectedRole.shortName})`}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoFocus
              />
            </div>

            {/* PIN Input */}
            <div className="auth-input-group">
              <label htmlFor="auth-pin-input">
                <KeyRound size={13} />
                <span>Enter 4-Digit Security PIN:</span>
              </label>
              <input
                id="auth-pin-input"
                type="password"
                maxLength={8}
                inputMode="numeric"
                className="auth-text-field pin-field"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="auth-error-banner">
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}



            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !pin.trim()}
              className="auth-submit-btn"
              style={{ backgroundColor: selectedRole.badgeColor }}
            >
              {isSubmitting ? 'Verifying...' : 'Unlock CollabS Session'}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
