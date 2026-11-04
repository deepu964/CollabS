/**
 * Email Notification Service for CollabS
 * Triggers privacy-preserving email alerts when a team member / developer is mentioned.
 * Uses EmailJS (client-side email dispatcher) - Zero backend required.
 */

import emailjs from '@emailjs/browser';
import { chatService, TEAM_ROLES } from './chatService';

const STORAGE_KEY_EMAILS = 'collabs_team_role_emails_v1';
const STORAGE_KEY_LAST_SENT = 'collabs_email_throttle_v1';

// Throttle emails to the same recipient (15 seconds cooldown) to prevent accidental double-sends while allowing testing
const THROTTLE_COOLDOWN_MS = 15 * 1000;

class EmailService {
  constructor() {
    this.serviceId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_SERVICE_ID) || '';
    this.templateId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_TEMPLATE_ID) || '';
    this.publicKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_PUBLIC_KEY) || '';

    // Initialize EmailJS if public key is available
    if (this.publicKey && typeof emailjs !== 'undefined') {
      try {
        emailjs.init(this.publicKey);
      } catch (err) {
        console.warn('[EmailService] Failed to initialize EmailJS SDK', err);
      }
    }
  }

  // Check if EmailJS configuration is ready
  isConfigured() {
    return Boolean(this.serviceId && this.templateId && this.publicKey);
  }

  // Get configured emails for all team roles
  getAllRoleEmails() {
    const defaults = {
      admin: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAIL_ADMIN) || '',
      backend: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAIL_BACKEND) || '',
      b2b: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAIL_B2B) || '',
      driver: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAIL_DRIVER) || '',
      qa: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAIL_QA) || ''
    };

    if (typeof window === 'undefined') return defaults;

    try {
      const stored = localStorage.getItem(STORAGE_KEY_EMAILS);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaults, ...parsed };
      }
    } catch {
      // ignore
    }
    return defaults;
  }

  // Save / Update email for a specific role
  setRoleEmail(roleId, email) {
    if (typeof window === 'undefined') return;
    const current = this.getAllRoleEmails();
    current[roleId] = (email || '').trim().toLowerCase();
    try {
      localStorage.setItem(STORAGE_KEY_EMAILS, JSON.stringify(current));
    } catch (e) {
      console.warn('Failed to save role email', e);
    }
  }

  // Register email on this laptop and broadcast to entire team
  registerUserEmail(roleId, email, name = '') {
    if (!roleId || !email) return;
    const cleanEmail = email.trim().toLowerCase();
    this.setRoleEmail(roleId, cleanEmail);

    try {
      chatService.broadcastRosterUpdate(roleId, cleanEmail, name);
    } catch (err) {
      console.debug('[EmailService] Could not broadcast roster update:', err);
    }
  }

  // Get email for a specific role
  getRoleEmail(roleId) {
    const emails = this.getAllRoleEmails();
    return emails[roleId] || '';
  }

  // Check throttle timestamp
  isThrottled(roleId) {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LAST_SENT);
      if (raw) {
        const parsed = JSON.parse(raw);
        const lastSent = parsed[roleId];
        if (lastSent && Date.now() - lastSent < THROTTLE_COOLDOWN_MS) {
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  recordEmailSent(roleId) {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LAST_SENT);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[roleId] = Date.now();
      localStorage.setItem(STORAGE_KEY_LAST_SENT, JSON.stringify(parsed));
    } catch {
      // ignore
    }
  }

  /**
   * Dispatches email notifications to mentioned team members.
   * Note: As per privacy guidelines, this sends a reminder notification ONLY,
   * without leaking the actual chat message text.
   */
  async notifyMentionedRoles({ mentions = [], sender, roomId = 'general', channelName = '' }) {
    if (!Array.isArray(mentions) || mentions.length === 0) return [];

    const senderRole = sender?.role || '';
    const senderName = sender?.name || 'A team member';
    const channelDisplay = channelName || roomId || 'general';
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://collabs.vercel.app';

    // Find all unique roles targeted by the mentions
    const targetRoleIds = new Set();
    const hasAllBroadcast = mentions.some((m) => m.id === 'all' || m.isBroadcast);

    if (hasAllBroadcast) {
      // Mentioned @all: notify all authorized roles except the sender
      TEAM_ROLES.filter((r) => !r.isBroadcast && r.id !== senderRole).forEach((r) => {
        targetRoleIds.add(r.id);
      });
    } else {
      // Explicit @role mentions: notify the targeted role (allows self-testing as well)
      mentions.forEach((m) => {
        if (m.type === 'role' && m.id && m.id !== 'all') {
          targetRoleIds.add(m.id);
        }
      });
    }

    if (targetRoleIds.size === 0) return [];

    const results = [];
    const roleEmails = this.getAllRoleEmails();

    for (const roleId of targetRoleIds) {
      const roleObj = TEAM_ROLES.find((r) => r.id === roleId);
      const recipientName = roleObj?.displayName || roleObj?.name || roleId;
      const recipientEmail = roleEmails[roleId];

      if (!recipientEmail) {
        results.push({
          roleId,
          recipientName,
          sent: false,
          reason: 'No email address configured for this role'
        });
        continue;
      }

      // Check anti-spam throttle
      if (this.isThrottled(roleId)) {
        results.push({
          roleId,
          recipientName,
          recipientEmail,
          sent: false,
          reason: 'Cooldown active (alert already sent recently)'
        });
        continue;
      }

      const templateParams = {
        to_email: recipientEmail,
        email: recipientEmail,
        recipient_email: recipientEmail,
        reply_to: recipientEmail,
        to_name: recipientName,
        name: recipientName,
        sender_name: senderName,
        channel_name: channelDisplay,
        app_url: appUrl,
        notification_message: `${senderName} mentioned you in #${channelDisplay} on CollabS. Could you please check the application to follow up?`
      };

      if (!this.isConfigured()) {
        // Simulated / development mode: Log clearly so developer knows the mention was triggered
        console.info(
          `[EmailService: Simulated Alert] Would dispatch email to ${recipientEmail} (${recipientName}): "${senderName} mentioned you in #${channelDisplay}"`
        );
        this.recordEmailSent(roleId);
        results.push({
          roleId,
          recipientName,
          recipientEmail,
          sent: true,
          simulated: true,
          message: `Simulated: Mention email triggered for ${recipientName} (${recipientEmail})`
        });
        continue;
      }

      try {
        await emailjs.send(this.serviceId, this.templateId, templateParams, this.publicKey);
        this.recordEmailSent(roleId);
        results.push({
          roleId,
          recipientName,
          recipientEmail,
          sent: true,
          simulated: false
        });
      } catch (err) {
        const errorMsg = err?.text || err?.message || 'Email delivery failed';
        console.error(`[EmailService] Failed to send email to ${recipientEmail}:`, errorMsg);
        results.push({
          roleId,
          recipientName,
          recipientEmail,
          sent: false,
          error: errorMsg
        });
      }
    }

    return results;
  }
}

export const emailService = new EmailService();
