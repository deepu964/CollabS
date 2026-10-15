/**
 * Chat Service for CollabS
 * Manages rooms (#general, #backend-help, #docs-feedback, #admin-line),
 * user profile, message persistence, real-time multi-tab broadcasting,
 * and global cross-device cloud synchronization via Cloudinary CDN Registry.
 */

const STORAGE_KEY_MESSAGES = 'collabs_chat_messages_v1';
const STORAGE_KEY_USER = 'collabs_chat_user_v1';
const BROADCAST_CHANNEL_NAME = 'collabs_chat_bus_v1';

// Global Cloud Registry Settings (Syncs across different computers and mobile phones)
const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'dtaz4vhxh';
const UPLOAD_PRESET = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) || 'CollabS';
const CHAT_REGISTRY_PUBLIC_ID = 'collabs_global_chat_registry_v1';
const CHAT_READ_URL = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${CHAT_REGISTRY_PUBLIC_ID}`;
const CHAT_WRITE_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;

// Default team channels
export const DEFAULT_CHANNELS = [
  { id: 'general', name: 'general', description: 'General team discussion & questions', type: 'channel' },
  { id: 'backend-help', name: 'backend-help', description: 'Ask doubts to Backend & API team', type: 'channel' },
  { id: 'docs-feedback', name: 'docs-feedback', description: 'PRD, Docs & Architecture review', type: 'channel' },
  { id: 'admin-line', name: 'admin-line', description: 'Operations & Admin queries', type: 'channel' }
];

// Team roles for tagging & identification (The 5 Authorized Pillars + @all broadcast)
export const TEAM_ROLES = [
  { id: 'all', name: 'all', displayName: 'All Members', badgeColor: '#f97316', isBroadcast: true },
  { id: 'admin', name: 'Admin', displayName: 'Admin / Lead', badgeColor: '#f59e0b' },
  { id: 'backend', name: 'Backend', displayName: 'Backend Engineer', badgeColor: '#10b981' },
  { id: 'b2b', name: 'B2B Client', displayName: 'B2B Wholesale Client', badgeColor: '#3b82f6' },
  { id: 'driver', name: 'Driver', displayName: 'Driver & Logistics', badgeColor: '#ec4899' },
  { id: 'qa', name: 'QA', displayName: 'QA & Testing Lead', badgeColor: '#8b5cf6' }
];

// Initial starter welcome messages
const INITIAL_MESSAGES = [
  {
    id: 'msg-seed-1',
    roomId: 'backend-help',
    sender: { name: 'Admin', role: 'admin' },
    text: 'Welcome to CollabS Team Chat! 👋 You can ask any backend or admin doubts here.',
    mentions: [],
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'msg-seed-2',
    roomId: 'backend-help',
    sender: { name: 'Backend Lead', role: 'backend' },
    text: 'Feel free to type @ to mention any Doc or Image reference when asking questions.',
    mentions: [],
    timestamp: new Date(Date.now() - 3600000).toISOString()
  }
];

class ChatService {
  constructor() {
    this.listeners = new Set();
    this.broadcastChannel = null;
    this.isSyncing = false;
    this.pollInterval = null;

    // 1. Same-device multi-tab synchronization via BroadcastChannel
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'NEW_MESSAGE') {
            this.notifyListeners(event.data.message);
          }
        };
      } catch (err) {
        console.warn('[ChatService] BroadcastChannel unavailable', err);
      }
    }

    // 2. Global cross-device synchronization (polls Cloudinary CDN every 3.5s)
    if (typeof window !== 'undefined') {
      this.fetchRemoteMessages(); // Initial fetch
      this.pollInterval = setInterval(() => {
        this.fetchRemoteMessages();
      }, 3500);

      window.addEventListener('focus', () => {
        this.fetchRemoteMessages();
      });
    }
  }

  // Subscribe to message updates
  subscribe(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(incomingMessage = null) {
    this.listeners.forEach((cb) => {
      try {
        cb(incomingMessage);
      } catch (e) {
        console.error('[ChatService] listener error', e);
      }
    });
  }

  // Fetch messages from global Cloudinary CDN
  async fetchRemoteMessages() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const cacheBuster = Date.now();
      const res = await fetch(`${CHAT_READ_URL}?t=${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });

      if (!res.ok) {
        this.isSyncing = false;
        return;
      }

      const data = await res.json();
      const remoteMessages = Array.isArray(data?.messages) ? data.messages : [];

      if (remoteMessages.length === 0) {
        this.isSyncing = false;
        return;
      }

      const localMessages = this.getAllMessages();
      const localIds = new Set(localMessages.map((m) => m.id));

      // Find incoming messages from other computers
      const incomingNew = remoteMessages.filter((rm) => rm && rm.id && !localIds.has(rm.id));

      if (incomingNew.length > 0) {
        // Merge & preserve chronological order
        const merged = [...localMessages, ...incomingNew].sort(
          (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
        );

        // Keep last 400 messages
        const trimmed = merged.slice(-400);

        try {
          localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(trimmed));
        } catch (e) {
          console.warn('Failed to cache remote messages', e);
        }

        // Notify with the latest incoming message for notifications
        const latestNew = incomingNew[incomingNew.length - 1];
        this.notifyListeners(latestNew);
      }
    } catch (err) {
      // Offline or network error
    } finally {
      this.isSyncing = false;
    }
  }

  // Push updated messages array to Cloudinary CDN
  async pushMessagesToCloud(messages) {
    try {
      const payload = JSON.stringify({
        version: 1,
        lastUpdated: new Date().toISOString(),
        messages: (messages || []).slice(-400)
      });

      const formData = new FormData();
      const blob = new Blob([payload], { type: 'application/json' });
      formData.append('file', blob);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('public_id', CHAT_REGISTRY_PUBLIC_ID);

      await fetch(CHAT_WRITE_URL, {
        method: 'POST',
        body: formData
      });
    } catch (err) {
      console.warn('[ChatService] Failed to push to cloud registry', err);
    }
  }

  // User Profile
  getCurrentUser() {
    try {
      // Prioritize authenticated team member
      const authRaw = localStorage.getItem('collabs_authenticated_member_v2');
      if (authRaw) {
        const parsedAuth = JSON.parse(authRaw);
        if (parsedAuth && parsedAuth.role) {
          return {
            id: parsedAuth.id || 'usr_' + parsedAuth.role,
            name: parsedAuth.name || parsedAuth.shortName || 'Team Member',
            role: parsedAuth.role
          };
        }
      }

      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    const defaultUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: 'B2B Client',
      role: 'b2b'
    };
    this.setCurrentUser(defaultUser);
    return defaultUser;
  }

  setCurrentUser(user) {
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save user profile', e);
    }
    this.notifyListeners();
  }

  // Get all messages
  getAllMessages() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse chat messages', e);
    }
    return INITIAL_MESSAGES;
  }

  // Get messages for a specific room
  getRoomMessages(roomId) {
    const all = this.getAllMessages();
    return all.filter((m) => m.roomId === roomId);
  }

  // Send a new message
  sendMessage({ roomId, text, mentions = [] }) {
    if (!text && mentions.length === 0) return null;

    const user = this.getCurrentUser();
    const newMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      roomId: roomId || 'general',
      sender: {
        id: user.id,
        name: user.name || 'Anonymous',
        role: user.role || 'b2b'
      },
      text: (text || '').trim(),
      mentions: Array.isArray(mentions) ? mentions : [],
      timestamp: new Date().toISOString()
    };

    const current = this.getAllMessages();
    const updated = [...current, newMessage];

    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save message', e);
    }

    // 1. Broadcast across open tabs on this machine
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'NEW_MESSAGE',
        message: newMessage
      });
    }

    // 2. Notify local listeners instantly
    this.notifyListeners(newMessage);

    // 3. Sync to Global Cloud Registry (Sends to teammates across different laptops/phones)
    this.pushMessagesToCloud(updated);

    return newMessage;
  }

  // Get unread counts
  getUnreadCount(currentRoomId = null) {
    return 0;
  }
}

export const chatService = new ChatService();
