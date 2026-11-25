import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const INVITATIONS_FILE = path.join(DATA_DIR, 'invitations.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
}

if (!fs.existsSync(PROJECTS_FILE)) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify([], null, 2), 'utf8');
}

if (!fs.existsSync(INVITATIONS_FILE)) {
  fs.writeFileSync(INVITATIONS_FILE, JSON.stringify([], null, 2), 'utf8');
}

if (!fs.existsSync(MESSAGES_FILE)) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2), 'utf8');
}

/**
 * File-backed atomic JSON database for Users.
 * Thread-safe and persistent across restarts.
 */
class Database {
  readUsers() {
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(data) || [];
    } catch (err) {
      console.error('[Database] Error reading users file:', err);
      return [];
    }
  }

  writeUsers(users) {
    try {
      const tempFile = `${USERS_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(users, null, 2), 'utf8');
      fs.renameSync(tempFile, USERS_FILE);
      return true;
    } catch (err) {
      console.error('[Database] Error writing users file:', err);
      return false;
    }
  }

  findUserByEmail(email) {
    if (!email) return null;
    const users = this.readUsers();
    return users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
  }

  findUserById(id) {
    if (!id) return null;
    const users = this.readUsers();
    return users.find((u) => u.id === id) || null;
  }

  createUser(userData) {
    const users = this.readUsers();
    users.push(userData);
    this.writeUsers(users);
    return userData;
  }

  updateUser(id, updates) {
    const users = this.readUsers();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    users[index] = {
      ...users[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.writeUsers(users);
    return users[index];
  }

  // ==========================================
  // PROJECTS DATABASE
  // ==========================================
  readProjects() {
    try {
      const data = fs.readFileSync(PROJECTS_FILE, 'utf8');
      return JSON.parse(data) || [];
    } catch (err) {
      console.error('[Database] Error reading projects file:', err);
      return [];
    }
  }

  writeProjects(projects) {
    try {
      const tempFile = `${PROJECTS_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(projects, null, 2), 'utf8');
      fs.renameSync(tempFile, PROJECTS_FILE);
      return true;
    } catch (err) {
      console.error('[Database] Error writing projects file:', err);
      return false;
    }
  }

  findProjectById(id) {
    if (!id) return null;
    const projects = this.readProjects();
    return projects.find((p) => p.id === id) || null;
  }

  getProjectsForUser(userId, userEmail = null) {
    if (!userId) return [];
    const projects = this.readProjects();
    const cleanEmail = userEmail ? userEmail.trim().toLowerCase() : null;
    return projects.filter(
      (p) =>
        p.leadId === userId ||
        (cleanEmail && p.leadEmail && p.leadEmail.toLowerCase() === cleanEmail) ||
        (Array.isArray(p.members) &&
          p.members.some(
            (m) =>
              m.userId === userId ||
              (cleanEmail && m.email && m.email.toLowerCase() === cleanEmail)
          ))
    );
  }

  createProject(projectData) {
    const projects = this.readProjects();
    projects.push(projectData);
    this.writeProjects(projects);
    return projectData;
  }

  updateProject(id, updates) {
    const projects = this.readProjects();
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.writeProjects(projects);
    return projects[index];
  }

  deleteProject(id) {
    const projects = this.readProjects();
    const filtered = projects.filter((p) => p.id !== id);
    if (filtered.length === projects.length) return false;
    this.writeProjects(filtered);
    return true;
  }

  // ==========================================
  // INVITATIONS DATABASE
  // ==========================================
  readInvitations() {
    try {
      const data = fs.readFileSync(INVITATIONS_FILE, 'utf8');
      return JSON.parse(data) || [];
    } catch (err) {
      console.error('[Database] Error reading invitations file:', err);
      return [];
    }
  }

  writeInvitations(invitations) {
    try {
      const tempFile = `${INVITATIONS_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(invitations, null, 2), 'utf8');
      fs.renameSync(tempFile, INVITATIONS_FILE);
      return true;
    } catch (err) {
      console.error('[Database] Error writing invitations file:', err);
      return false;
    }
  }

  findInvitationByToken(token) {
    if (!token) return null;
    const invitations = this.readInvitations();
    return invitations.find((inv) => inv.token === token) || null;
  }

  findInvitationById(id) {
    if (!id) return null;
    const invitations = this.readInvitations();
    return invitations.find((inv) => inv.id === id) || null;
  }

  getInvitationsForProject(projectId) {
    if (!projectId) return [];
    const invitations = this.readInvitations();
    return invitations.filter((inv) => inv.projectId === projectId);
  }

  createInvitation(invitationData) {
    const invitations = this.readInvitations();
    invitations.push(invitationData);
    this.writeInvitations(invitations);
    return invitationData;
  }

  updateInvitation(id, updates) {
    const invitations = this.readInvitations();
    const index = invitations.findIndex((inv) => inv.id === id);
    if (index === -1) return null;

    invitations[index] = {
      ...invitations[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.writeInvitations(invitations);
    return invitations[index];
  }

  deleteInvitation(id) {
    const invitations = this.readInvitations();
    const filtered = invitations.filter((inv) => inv.id !== id);
    if (filtered.length === invitations.length) return false;
    this.writeInvitations(filtered);
    return true;
  }

  // ==========================================
  // CHAT MESSAGES DATABASE (SCOPED BY PROJECT)
  // ==========================================
  readMessages() {
    try {
      const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
      return JSON.parse(data) || [];
    } catch (err) {
      console.error('[Database] Error reading messages file:', err);
      return [];
    }
  }

  writeMessages(messages) {
    try {
      const tempFile = `${MESSAGES_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(messages, null, 2), 'utf8');
      fs.renameSync(tempFile, MESSAGES_FILE);
      return true;
    } catch (err) {
      console.error('[Database] Error writing messages file:', err);
      return false;
    }
  }

  getMessagesForProject(projectId, roomId = null) {
    if (!projectId) return [];
    const messages = this.readMessages();
    return messages.filter(
      (m) => m.projectId === projectId && (!roomId || m.roomId === roomId)
    );
  }

  createMessage(messageData) {
    const messages = this.readMessages();
    messages.push(messageData);
    // Keep last 1000 messages in DB
    const trimmed = messages.slice(-1000);
    this.writeMessages(trimmed);
    return messageData;
  }

  clearProjectMessages(projectId, roomId = null) {
    if (!projectId) return false;
    const messages = this.readMessages();
    const filtered = messages.filter((m) => {
      if (m.projectId !== projectId) return true;
      if (roomId && roomId !== 'all') {
        return m.roomId !== roomId;
      }
      return false;
    });
    this.writeMessages(filtered);
    return true;
  }
}

export const db = new Database();
export default db;
