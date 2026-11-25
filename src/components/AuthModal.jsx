import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { authService } from '../services/authService';

export default function AuthModal({ onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleTabSwitch = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Client-side validations
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMsg('Please enter your email address.');
      triggerShake();
      return;
    }

    if (!cleanPassword) {
      setErrorMsg('Please enter your password.');
      triggerShake();
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMsg('Please enter your full name.');
        triggerShake();
        return;
      }

      if (cleanPassword.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        triggerShake();
        return;
      }

      if (cleanPassword !== confirmPassword.trim()) {
        setErrorMsg('Passwords do not match.');
        triggerShake();
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'register') {
        const result = await authService.register({
          name: name.trim(),
          email: cleanEmail,
          password: cleanPassword,
          confirmPassword: confirmPassword.trim()
        });

        if (result.success && result.user) {
          setSuccessMsg('Account created successfully! Signing you in...');
          setTimeout(() => {
            onAuthenticated(result.user);
          }, 400);
        } else {
          setErrorMsg(result.error || 'Registration failed.');
          triggerShake();
        }
      } else {
        const result = await authService.login({
          email: cleanEmail,
          password: cleanPassword
        });

        if (result.success && result.user) {
          setSuccessMsg('Welcome back!');
          setTimeout(() => {
            onAuthenticated(result.user);
          }, 300);
        } else {
          setErrorMsg(result.error || 'Invalid email or password.');
          triggerShake();
        }
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="collabs-auth-gate-backdrop">
      <div className={`collabs-auth-gate-card modern-auth-card ${shake ? 'shake-animation' : ''}`}>
        {/* Brand Header */}
        <div className="auth-gate-header">
          <div className="auth-brand-pill">
            <span className="auth-brand-text">CollabS Modern Platform</span>
          </div>
          <h1 className="auth-gate-title">
            {mode === 'login' ? 'Welcome Back' : 'Create Your Account'}
          </h1>
          <p className="auth-gate-subtitle">
            {mode === 'login'
              ? 'Sign in to access your projects, teams, and collaboration workspaces.'
              : 'Join CollabS to create projects, invite teammates, and collaborate seamlessly.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="auth-mode-segmented-tabs">
          <button
            type="button"
            className={`auth-segment-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-segment-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('register')}
          >
            Create Account
          </button>
        </div>

        {/* Error / Success Banners */}
        {errorMsg && (
          <div className="auth-error-banner" role="alert">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-success-banner" role="status">
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form className="auth-pin-form modern-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="auth-input-group">
              <label htmlFor="reg-name-input">
                <User size={13} />
                <span>Full Name:</span>
              </label>
              <input
                id="reg-name-input"
                type="text"
                className="auth-text-field"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>
          )}

          <div className="auth-input-group">
            <label htmlFor="auth-email-input">
              <Mail size={13} />
              <span>Email Address:</span>
            </label>
            <input
              id="auth-email-input"
              type="email"
              className="auth-text-field"
              placeholder="e.g. alex@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={mode === 'login'}
              required
            />
          </div>

          <div className="auth-input-group">
            <div className="auth-label-row">
              <label htmlFor="auth-password-input">
                <Lock size={13} />
                <span>Password:</span>
              </label>
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <input
              id="auth-password-input"
              type={showPassword ? 'text' : 'password'}
              className="auth-text-field"
              placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {mode === 'register' && (
            <div className="auth-input-group">
              <label htmlFor="reg-confirm-password-input">
                <Lock size={13} />
                <span>Confirm Password:</span>
              </label>
              <input
                id="reg-confirm-password-input"
                type={showPassword ? 'text' : 'password'}
                className="auth-text-field"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="auth-submit-btn modern-submit"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="spinner-icon" />
                <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In to CollabS' : 'Create Account'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="auth-card-footer">
          <ShieldCheck size={13} className="footer-shield-icon" />
          <span>Passwords are securely encrypted with bcrypt. Your session is protected with JWT.</span>
        </div>
      </div>
    </div>
  );
}
