import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import { verifyToken, requireProjectAccess, requireProjectLead } from '../middleware/auth.js';

const router = express.Router();

/**
 * Sanitize project object by stripping sensitive fields (password hash)
 */
function sanitizeProject(project) {
  if (!project) return null;
  const { passwordHash, ...safeProject } = project;
  return {
    ...safeProject,
    hasPassword: Boolean(passwordHash)
  };
}

/**
 * GET /api/projects
 * List all projects the authenticated user created or belongs to.
 */
router.get('/', verifyToken, (req, res) => {
  try {
    const projects = db.getProjectsForUser(req.user.id, req.user.email);
    const sanitized = projects.map(sanitizeProject);

    return res.status(200).json({
      success: true,
      projects: sanitized
    });
  } catch (err) {
    console.error('[Projects API] Error listing projects:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve projects.'
    });
  }
});

/**
 * POST /api/projects
 * Create a new independent project. Authenticated user becomes Project Lead.
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, password, color, coverIcon } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Project name is required (at least 2 characters).'
      });
    }

    let passwordHash = null;
    if (password && password.trim().length > 0) {
      if (password.trim().length < 4) {
        return res.status(400).json({
          success: false,
          error: 'Project password must be at least 4 characters long.'
        });
      }
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const projectId = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const PRESET_SIDE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
    let initialTeams = [];

    const rawSides = req.body.sides || req.body.customSides;
    if (Array.isArray(rawSides) && rawSides.length > 0) {
      initialTeams = rawSides
        .map((s, idx) => {
          const sideName = typeof s === 'string' ? s.trim() : (s.name || '').trim();
          if (!sideName) return null;
          return {
            id: `side-${Date.now()}-${idx}`,
            name: sideName,
            description: typeof s === 'object' && s.description ? s.description.trim() : `${sideName} resources`,
            color: (typeof s === 'object' && s.color) || PRESET_SIDE_COLORS[idx % PRESET_SIDE_COLORS.length]
          };
        })
        .filter(Boolean);
    } else if (typeof rawSides === 'string' && rawSides.trim().length > 0) {
      initialTeams = rawSides
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((sideName, idx) => ({
          id: `side-${Date.now()}-${idx}`,
          name: sideName,
          description: `${sideName} resources`,
          color: PRESET_SIDE_COLORS[idx % PRESET_SIDE_COLORS.length]
        }));
    }

    // If no custom sides provided, start with a single clean "General" side instead of hardcoded teams
    if (initialTeams.length === 0) {
      initialTeams = [
        { id: 'side-general', name: 'General', description: 'General project resources', color: '#3b82f6' }
      ];
    }

    const newProject = {
      id: projectId,
      name: name.trim(),
      description: description ? description.trim() : '',
      leadId: req.user.id,
      leadName: req.user.name,
      leadEmail: req.user.email,
      passwordHash,
      hasPassword: Boolean(passwordHash),
      color: color || '#3b82f6',
      coverIcon: coverIcon || 'Layers',
      members: [
        {
          userId: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: 'Project Lead',
          team: initialTeams[0].name,
          joinedAt: now
        }
      ],
      teams: initialTeams,
      createdAt: now,
      updatedAt: now
    };

    db.createProject(newProject);

    return res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      project: sanitizeProject(newProject)
    });
  } catch (err) {
    console.error('[Projects API] Error creating project:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create project.'
    });
  }
});

/**
 * GET /api/projects/:id
 * Retrieve single project details.
 */
router.get('/:id', verifyToken, requireProjectAccess, (req, res) => {
  try {
    const project = req.project;
    return res.status(200).json({
      success: true,
      project: sanitizeProject(project)
    });
  } catch (err) {
    console.error('[Projects API] Error fetching project:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to load project details.'
    });
  }
});

/**
 * PUT /api/projects/:id
 * Update project details (Project Lead only).
 */
router.put('/:id', verifyToken, requireProjectLead, async (req, res) => {
  try {
    const project = req.project;
    const { name, description, password, color, coverIcon } = req.body;
    const updates = {};

    if (name && name.trim().length >= 2) {
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = description.trim();
    }
    if (color) {
      updates.color = color;
    }
    if (coverIcon) {
      updates.coverIcon = coverIcon;
    }

    if (password !== undefined) {
      if (password && password.trim().length >= 4) {
        updates.passwordHash = await bcrypt.hash(password.trim(), 10);
        updates.hasPassword = true;
      } else if (password === '' || password === null) {
        // Remove password
        updates.passwordHash = null;
        updates.hasPassword = false;
      }
    }

    const updated = db.updateProject(req.params.id, updates);

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully.',
      project: sanitizeProject(updated)
    });
  } catch (err) {
    console.error('[Projects API] Error updating project:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update project.'
    });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project (Project Lead only).
 */
router.delete('/:id', verifyToken, requireProjectLead, (req, res) => {
  try {
    const project = req.project;
    db.deleteProject(req.params.id);

    return res.status(200).json({
      success: true,
      message: `Project "${project.name}" was deleted successfully.`
    });
  } catch (err) {
    console.error('[Projects API] Error deleting project:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete project.'
    });
  }
});

/**
 * POST /api/projects/:id/verify-password
 * Verify common project password if project is password-protected.
 */
router.post('/:id/verify-password', verifyToken, async (req, res) => {
  try {
    const project = db.findProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found.' });
    }

    if (!project.passwordHash) {
      return res.status(200).json({ success: true, verified: true });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required.' });
    }

    const isMatch = await bcrypt.compare(password.trim(), project.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Incorrect project password.' });
    }

    return res.status(200).json({ success: true, verified: true });
  } catch (err) {
    console.error('[Projects API] Error verifying password:', err);
    return res.status(500).json({ success: false, error: 'Password verification failed.' });
  }
});

// ==========================================
// PHASE 3: TEAMS & MEMBERS MANAGEMENT
// ==========================================

/**
 * GET /api/projects/:id/teams
 * View all teams and their members inside this project.
 */
router.get('/:id/teams', verifyToken, requireProjectAccess, (req, res) => {
  try {
    const project = req.project;
    const teams = project.teams || [];
    const members = project.members || [];

    // Augment teams with current member list
    const teamsWithMembers = teams.map((t) => {
      const assigned = members.filter((m) => m.team?.toLowerCase() === t.name?.toLowerCase());
      return {
        ...t,
        membersCount: assigned.length,
        members: assigned
      };
    });

    return res.status(200).json({
      success: true,
      teams: teamsWithMembers,
      allMembers: members
    });
  } catch (err) {
    console.error('[Projects API] Error fetching teams:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch teams.' });
  }
});

/**
 * POST /api/projects/:id/teams
 * Create a custom team inside this project (Project Lead only).
 */
router.post('/:id/teams', verifyToken, requireProjectLead, (req, res) => {
  try {
    const project = req.project;

    const { name, description, color } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Team name is required (at least 2 characters).' });
    }

    const cleanName = name.trim();
    const teams = project.teams || [];

    // Duplicate team name check within this project
    const duplicate = teams.some((t) => t.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `A team named "${cleanName}" already exists in this project.`
      });
    }

    const newTeam = {
      id: `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      description: description ? description.trim() : '',
      color: color || '#3b82f6',
      createdAt: new Date().toISOString()
    };

    teams.push(newTeam);
    db.updateProject(project.id, { teams });

    return res.status(201).json({
      success: true,
      message: `Team "${cleanName}" created successfully.`,
      team: newTeam,
      teams
    });
  } catch (err) {
    console.error('[Projects API] Error creating team:', err);
    return res.status(500).json({ success: false, error: 'Failed to create team.' });
  }
});

/**
 * PUT /api/projects/:id/teams/:teamId
 * Update team name and description (Project Lead only).
 */
router.put('/:id/teams/:teamId', verifyToken, requireProjectLead, (req, res) => {
  try {
    const project = req.project;
    const { name, description, color } = req.body;
    const teams = project.teams || [];
    const teamIndex = teams.findIndex((t) => t.id === req.params.teamId);

    if (teamIndex === -1) {
      return res.status(404).json({ success: false, error: 'Team not found.' });
    }

    const oldName = teams[teamIndex].name;
    const cleanName = name ? name.trim() : oldName;

    // Check duplicate if name changed
    if (name && cleanName.toLowerCase() !== oldName.toLowerCase()) {
      const duplicate = teams.some(
        (t) => t.id !== req.params.teamId && t.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: `Another team named "${cleanName}" already exists.`
        });
      }
    }

    teams[teamIndex] = {
      ...teams[teamIndex],
      name: cleanName,
      description: description !== undefined ? description.trim() : teams[teamIndex].description,
      color: color || teams[teamIndex].color || '#3b82f6',
      updatedAt: new Date().toISOString()
    };

    // If team name changed, update member records referencing the old team name
    const members = (project.members || []).map((m) => {
      if (m.team?.toLowerCase() === oldName.toLowerCase()) {
        return { ...m, team: cleanName };
      }
      return m;
    });

    db.updateProject(project.id, { teams, members });

    return res.status(200).json({
      success: true,
      message: `Team updated successfully.`,
      team: teams[teamIndex],
      teams,
      members
    });
  } catch (err) {
    console.error('[Projects API] Error updating team:', err);
    return res.status(500).json({ success: false, error: 'Failed to update team.' });
  }
});

/**
 * DELETE /api/projects/:id/teams/:teamId
 * Delete a team (Project Lead only). Protects teams with active members.
 */
router.delete('/:id/teams/:teamId', verifyToken, requireProjectLead, (req, res) => {
  try {
    const project = req.project;
    const teams = project.teams || [];
    const targetTeam = teams.find((t) => t.id === req.params.teamId);

    if (!targetTeam) {
      return res.status(404).json({ success: false, error: 'Team not found.' });
    }

    // Safety rule: Prevent deletion if team has members
    const members = project.members || [];
    const assignedMembers = members.filter(
      (m) => m.team?.toLowerCase() === targetTeam.name?.toLowerCase()
    );

    if (assignedMembers.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete "${targetTeam.name}" because it currently has ${assignedMembers.length} member(s). Please reassign them first.`
      });
    }

    const filteredTeams = teams.filter((t) => t.id !== req.params.teamId);
    db.updateProject(project.id, { teams: filteredTeams });

    return res.status(200).json({
      success: true,
      message: `Team "${targetTeam.name}" was deleted successfully.`,
      teams: filteredTeams
    });
  } catch (err) {
    console.error('[Projects API] Error deleting team:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete team.' });
  }
});

/**
 * PUT /api/projects/:id/members/:memberId/team
 * Reassign a member to a different team (Project Lead only).
 */
router.put('/:id/members/:memberId/team', verifyToken, requireProjectLead, (req, res) => {
  try {
    const project = req.project;
    const { teamName } = req.body;
    if (!teamName) {
      return res.status(400).json({ success: false, error: 'Team name is required.' });
    }

    // Check that target team exists in project
    const teams = project.teams || [];
    const teamExists = teams.some((t) => t.name.toLowerCase() === teamName.trim().toLowerCase());
    if (!teamExists) {
      return res.status(400).json({
        success: false,
        error: `Team "${teamName}" does not exist in this project.`
      });
    }

    const members = project.members || [];
    const memberIndex = members.findIndex(
      (m) => m.userId === req.params.memberId || m.id === req.params.memberId
    );

    if (memberIndex === -1) {
      return res.status(404).json({ success: false, error: 'Member not found in this project.' });
    }

    members[memberIndex] = {
      ...members[memberIndex],
      team: teamName.trim()
    };

    db.updateProject(project.id, { members });

    return res.status(200).json({
      success: true,
      message: `Reassigned ${members[memberIndex].name} to team "${teamName.trim()}".`,
      member: members[memberIndex],
      members
    });
  } catch (err) {
    console.error('[Projects API] Error assigning member team:', err);
    return res.status(500).json({ success: false, error: 'Failed to reassign member.' });
  }
});

export default router;
