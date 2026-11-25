import express from 'express';
import db from '../db/database.js';
import { verifyToken, requireProjectAccess } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

/**
 * GET /api/projects/:projectId/chat
 * Get all messages for the specified project, optionally filtered by ?roomId=
 */
router.get('/projects/:projectId/chat', verifyToken, requireProjectAccess, (req, res) => {
  try {
    const { projectId } = req.params;
    const { roomId } = req.query;

    const messages = db.getMessagesForProject(projectId, roomId || null);

    return res.status(200).json({
      success: true,
      projectId,
      roomId: roomId || 'all',
      messages
    });
  } catch (err) {
    console.error('[Chat API] Error fetching messages:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve messages.' });
  }
});

/**
 * POST /api/projects/:projectId/chat
 * Send a message within this project.
 */
router.post('/projects/:projectId/chat', verifyToken, requireProjectAccess, (req, res) => {
  try {
    const { projectId } = req.params;
    const { id, timestamp, roomId, text, mentions, type, audioUrl, duration } = req.body;

    if (!text && (!mentions || mentions.length === 0) && !audioUrl) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    }

    let senderRole = 'Member';
    if (req.isProjectLead) {
      senderRole = 'Project Lead';
    } else if (Array.isArray(req.project.members)) {
      const m = req.project.members.find(
        (mem) => mem.userId === req.user.id || (mem.email && mem.email.toLowerCase() === req.user.email?.toLowerCase())
      );
      if (m && m.team) senderRole = m.team;
    }

    const newMessage = {
      id: id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      projectId,
      roomId: roomId || 'general',
      sender: {
        id: req.user.id,
        name: req.user.name || 'Team Member',
        email: req.user.email,
        role: senderRole
      },
      text: (text || '').trim(),
      type: type || (audioUrl ? 'voice' : 'text'),
      audioUrl: audioUrl || null,
      duration: Number(duration) || 0,
      mentions: Array.isArray(mentions) ? mentions : [],
      timestamp: timestamp || new Date().toISOString()
    };

    db.createMessage(newMessage);

    return res.status(201).json({
      success: true,
      message: newMessage
    });
  } catch (err) {
    console.error('[Chat API] Error posting message:', err);
    return res.status(500).json({ success: false, error: 'Failed to post message.' });
  }
});

/**
 * DELETE /api/projects/:projectId/chat
 * Clear room or all messages in this project.
 */
router.delete('/projects/:projectId/chat', verifyToken, requireProjectAccess, (req, res) => {
  try {
    const { projectId } = req.params;
    const { roomId } = req.query;

    db.clearProjectMessages(projectId, roomId || 'all');

    return res.status(200).json({
      success: true,
      message: `Chat history cleared for ${roomId ? `room "${roomId}"` : 'all rooms'}.`
    });
  } catch (err) {
    console.error('[Chat API] Error clearing chat:', err);
    return res.status(500).json({ success: false, error: 'Failed to clear chat.' });
  }
});

export default router;
