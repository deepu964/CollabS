import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'collabs_secure_jwt_secret_key_2026';

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token missing. Please sign in.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = db.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found or session expired.'
      });
    }

    // Attach user without password hash
    const { password: _, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    req.userId = user.id;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please sign in again.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.'
    });
  }
};

/**
 * Phase 5 RBAC Middleware:
 * Verifies that the authenticated user belongs to the project (as Project Lead or Member).
 */
export const requireProjectAccess = (req, res, next) => {
  const projectId = req.params.projectId || req.params.id;
  if (!projectId) {
    return res.status(400).json({ success: false, error: 'Project ID is required.' });
  }

  const project = db.findProjectById(projectId);
  if (!project) {
    return res.status(404).json({ success: false, error: 'Project not found.' });
  }

  const isLead = project.leadId === req.user.id;
  const isMember =
    Array.isArray(project.members) &&
    project.members.some(
      (m) =>
        m.userId === req.user.id ||
        (m.email && m.email.toLowerCase() === req.user.email?.toLowerCase())
    );

  if (!isLead && !isMember) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: You are not a member or lead of this project.'
    });
  }

  req.project = project;
  req.isProjectLead = isLead;
  next();
};

/**
 * Phase 5 RBAC Middleware:
 * Verifies that the authenticated user is strictly the Project Lead.
 */
export const requireProjectLead = (req, res, next) => {
  const projectId = req.params.projectId || req.params.id;
  if (!projectId) {
    return res.status(400).json({ success: false, error: 'Project ID is required.' });
  }

  const project = req.project || db.findProjectById(projectId);
  if (!project) {
    return res.status(404).json({ success: false, error: 'Project not found.' });
  }

  if (project.leadId !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: 'Permission denied: This action requires Project Lead permissions.'
    });
  }

  req.project = project;
  req.isProjectLead = true;
  next();
};
