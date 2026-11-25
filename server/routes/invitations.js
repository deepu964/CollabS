import express from 'express';
import crypto from 'crypto';
import db from '../db/database.js';
import { verifyToken, requireProjectLead } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

/**
 * Helper to compute status of an invitation
 */
function getInvitationStatus(inv) {
  if (inv.status === 'accepted') return 'accepted';
  if (inv.status === 'revoked') return 'revoked';
  if (new Date(inv.expiresAt) < new Date()) return 'expired';
  return 'pending';
}

/**
 * GET /api/projects/:projectId/invitations
 * List all invitations for a project (Project Lead only).
 */
router.get('/projects/:projectId/invitations', verifyToken, requireProjectLead, (req, res) => {
  try {
    const project = req.project;
    const invitations = db.getInvitationsForProject(project.id).map((inv) => ({
      ...inv,
      computedStatus: getInvitationStatus(inv)
    }));

    return res.status(200).json({
      success: true,
      invitations
    });
  } catch (err) {
    console.error('[Invitations API] Error listing invitations:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve invitations.' });
  }
});

/**
 * POST /api/projects/:projectId/invitations
 * Create & send a member invitation (Project Lead only).
 */
router.post('/projects/:projectId/invitations', verifyToken, requireProjectLead, async (req, res) => {
  try {
    const project = req.project;
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found.' });
    }

    if (project.leadId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Only the Project Lead can invite members.' });
    }

    const { email, name, team } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanTeam = team ? team.trim() : 'Frontend';

    // 1. Verify team exists in this project
    const teams = project.teams || [];
    const teamExists = teams.some((t) => t.name.toLowerCase() === cleanTeam.toLowerCase());
    if (!teamExists) {
      return res.status(400).json({ success: false, error: `Team "${cleanTeam}" does not exist in this project.` });
    }

    // 2. Duplicate Check 1: Is user already a member of this project?
    const members = project.members || [];
    const alreadyMember = members.some((m) => m.email?.toLowerCase() === cleanEmail);
    if (alreadyMember) {
      return res.status(409).json({
        success: false,
        error: `User with email "${cleanEmail}" is already a member of this project.`
      });
    }

    // 3. Duplicate Check 2: Is there already an active pending invitation?
    const existingInvs = db.getInvitationsForProject(project.id);
    const pendingInv = existingInvs.find(
      (inv) => inv.email.toLowerCase() === cleanEmail && getInvitationStatus(inv) === 'pending'
    );
    if (pendingInv) {
      return res.status(409).json({
        success: false,
        error: `An active pending invitation for "${cleanEmail}" already exists. You can resend or copy the existing invite link.`
      });
    }

    // 4. Generate secure unique invitation token & 7-day expiration
    const token = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const invitationLink = `${origin}/?invite=${token}`;

    const newInvitation = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      projectId: project.id,
      projectName: project.name,
      email: cleanEmail,
      name: name ? name.trim() : '',
      team: cleanTeam,
      token,
      inviterId: req.user.id,
      inviterName: req.user.name,
      inviterEmail: req.user.email,
      status: 'pending',
      expiresAt,
      createdAt: now.toISOString()
    };

    db.createInvitation(newInvitation);

    return res.status(201).json({
      success: true,
      message: `Invitation created for ${cleanEmail}.`,
      invitation: {
        ...newInvitation,
        computedStatus: 'pending'
      },
      invitationLink
    });
  } catch (err) {
    console.error('[Invitations API] Error creating invitation:', err);
    return res.status(500).json({ success: false, error: 'Failed to create invitation.' });
  }
});

/**
 * POST /api/invitations/verify
 * Public endpoint: verify invitation token and get project details.
 */
router.post('/invitations/verify', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Invitation token is required.' });
    }

    const invitation = db.findInvitationByToken(token);
    if (!invitation) {
      return res.status(404).json({ success: false, error: 'Invalid or non-existent invitation token.' });
    }

    const status = getInvitationStatus(invitation);
    if (status === 'accepted') {
      return res.status(400).json({ success: false, error: 'This invitation has already been accepted.' });
    }

    if (status === 'expired') {
      return res.status(400).json({ success: false, error: 'This invitation link has expired. Please ask the project lead to resend it.' });
    }

    if (status === 'revoked') {
      return res.status(400).json({ success: false, error: 'This invitation has been revoked by the project lead.' });
    }

    const project = db.findProjectById(invitation.projectId);

    return res.status(200).json({
      success: true,
      valid: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        team: invitation.team,
        projectId: invitation.projectId,
        projectName: project ? project.name : invitation.projectName,
        projectColor: project ? project.color : '#3b82f6',
        inviterName: invitation.inviterName,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (err) {
    console.error('[Invitations API] Error verifying token:', err);
    return res.status(500).json({ success: false, error: 'Failed to verify invitation.' });
  }
});

/**
 * POST /api/invitations/accept
 * Accept an invitation (Authenticated user).
 */
router.post('/invitations/accept', verifyToken, (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Invitation token is required.' });
    }

    const invitation = db.findInvitationByToken(token);
    if (!invitation) {
      return res.status(404).json({ success: false, error: 'Invitation not found.' });
    }

    const status = getInvitationStatus(invitation);
    if (status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Invitation cannot be accepted because it is ${status}.`
      });
    }

    // Safety rule: Verify that the authenticated user's email matches the invited email!
    if (req.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: `This invitation was sent to "${invitation.email}". You are currently signed in as "${req.user.email}". Please sign in with the invited email to accept.`
      });
    }

    const project = db.findProjectById(invitation.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Associated project no longer exists.' });
    }

    const members = project.members || [];
    // Ensure not duplicate
    const alreadyMember = members.some((m) => m.userId === req.user.id || m.email.toLowerCase() === req.user.email.toLowerCase());
    if (!alreadyMember) {
      members.push({
        userId: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: 'Team Member',
        team: invitation.team || 'Frontend',
        joinedAt: new Date().toISOString()
      });
      db.updateProject(project.id, { members });
    }

    // Mark invitation accepted
    db.updateInvitation(invitation.id, {
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      acceptedByUserId: req.user.id
    });

    const updatedProject = db.findProjectById(project.id);

    return res.status(200).json({
      success: true,
      message: `Successfully joined "${project.name}" on team "${invitation.team}"!`,
      project: updatedProject
    });
  } catch (err) {
    console.error('[Invitations API] Error accepting invitation:', err);
    return res.status(500).json({ success: false, error: 'Failed to accept invitation.' });
  }
});

/**
 * POST /api/projects/:projectId/invitations/:id/resend
 * Resend / renew invitation (Project Lead only).
 */
router.post('/projects/:projectId/invitations/:id/resend', verifyToken, requireProjectLead, (req, res) => {
  try {
    const invitation = db.findInvitationById(req.params.id);
    if (!invitation) {
      return res.status(404).json({ success: false, error: 'Invitation not found.' });
    }

    // Extend expiration by 7 days from now
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const invitationLink = `${origin}/?invite=${invitation.token}`;

    const updated = db.updateInvitation(invitation.id, {
      expiresAt,
      status: 'pending',
      updatedAt: now.toISOString()
    });

    return res.status(200).json({
      success: true,
      message: `Invitation for ${invitation.email} renewed for 7 days.`,
      invitation: { ...updated, computedStatus: 'pending' },
      invitationLink
    });
  } catch (err) {
    console.error('[Invitations API] Error resending invitation:', err);
    return res.status(500).json({ success: false, error: 'Failed to resend invitation.' });
  }
});

/**
 * DELETE /api/projects/:projectId/invitations/:id
 * Revoke an invitation (Project Lead only).
 */
router.delete('/projects/:projectId/invitations/:id', verifyToken, requireProjectLead, (req, res) => {
  try {
    db.deleteInvitation(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Invitation revoked successfully.'
    });
  } catch (err) {
    console.error('[Invitations API] Error revoking invitation:', err);
    return res.status(500).json({ success: false, error: 'Failed to revoke invitation.' });
  }
});

export default router;
