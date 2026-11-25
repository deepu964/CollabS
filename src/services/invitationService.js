import { authService } from './authService';

class InvitationService {
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  // Fetch all invitations for a project (Lead only)
  async fetchInvitations(projectId) {
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to fetch invitations.' };
      }
      return { success: true, invitations: data.invitations || [] };
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  // Create & send invitation
  async sendInvitation(projectId, { email, name, team }) {
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, name, team })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to send invitation.' };
      }
      return {
        success: true,
        invitation: data.invitation,
        invitationLink: data.invitationLink,
        message: data.message
      };
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  // Verify invitation token from URL
  async verifyInvitation(token) {
    try {
      const res = await fetch('/api/invitations/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid invitation.' };
      }
      return { success: true, invitation: data.invitation };
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  // Accept invitation (User must be logged in)
  async acceptInvitation(token) {
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to accept invitation.' };
      }
      return {
        success: true,
        message: data.message,
        project: data.project
      };
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  // Resend invitation
  async resendInvitation(projectId, invitationId) {
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations/${invitationId}/resend`, {
        method: 'POST',
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to renew invitation.' };
      }
      return {
        success: true,
        message: data.message,
        invitation: data.invitation,
        invitationLink: data.invitationLink
      };
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  // Revoke invitation
  async revokeInvitation(projectId, invitationId) {
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to revoke invitation.' };
      }
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  }
}

export const invitationService = new InvitationService();
export default invitationService;
