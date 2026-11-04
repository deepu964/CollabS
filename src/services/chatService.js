/**
 * Chat Service for CollabS
 * Manages rooms (#general, #backend-help, #docs-feedback, #admin-line),
 * user profile, message persistence, real-time multi-tab broadcasting,
 * instant multi-device WebSockets (HiveMQ MQTT over WSS),
 * and global cross-device cloud archive via Cloudinary CDN Tag List.
 */

import Paho from 'paho-mqtt';

const STORAGE_KEY_MESSAGES = 'collabs_chat_messages_v1';
const STORAGE_KEY_USER = 'collabs_chat_user_v1';
const STORAGE_KEY_DELETED = 'collabs_chat_deleted_ids_v1';
const STORAGE_KEY_CLEARED_ROOMS = 'collabs_chat_cleared_rooms_v1';
const BROADCAST_CHANNEL_NAME = 'collabs_chat_bus_v1';

// Global Cloud Sync Settings (Cloudinary Unsigned Tag Listing)
const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'dtaz4vhxh';
const UPLOAD_PRESET = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) || 'CollabS';
const CHAT_TAG = 'collabs_chat';
const CHAT_FOLDER = 'collabs/chat';
const CHAT_LIST_URL = `https://res.cloudinary.com/${CLOUD_NAME}/raw/list/${CHAT_TAG}.json`;
const CHAT_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;

// Live Multi-Device Real-Time WebSocket Broker (Public WSS - Zero Config, Sub-100ms delivery)
const MQTT_BROKER = 'broker.hivemq.com';
const MQTT_PORT = 8884;
const MQTT_PATH = '/mqtt';
const MQTT_TOPIC = 'collabs/v1/team_messages';

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
    this.mqttClient = null;
    this.isMqttConnected = false;
    this.mqttReconnectTimer = null;

    // 1. Same-device multi-tab synchronization via BroadcastChannel
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'NEW_MESSAGE') {
            this.handleLocalBroadcast(event.data.message);
          }
        };
      } catch (err) {
        console.warn('[ChatService] BroadcastChannel unavailable', err);
      }
    }

    // 2. Instant multi-device synchronization via HiveMQ WebSockets (<100ms latency)
    if (typeof window !== 'undefined') {
      this.initMqtt();
    }

    // 3. Cloudinary background sync (backfills history from cloud)
    if (typeof window !== 'undefined') {
      this.fetchRemoteMessages();
      this.pollInterval = setInterval(() => {
        this.fetchRemoteMessages();
      }, 5000);

      window.addEventListener('focus', () => {
        this.fetchRemoteMessages();
        if (!this.isMqttConnected) {
          this.connectMqtt();
        }
      });
    }
  }

  // Initialize MQTT over secure WebSockets
  initMqtt() {
    try {
      const PahoModule = Paho.default || Paho;
      const PahoClient = PahoModule.Client || window?.Paho?.MQTT?.Client;
      if (!PahoClient) {
        console.warn('[ChatService] Paho MQTT client not available');
        return;
      }

      const clientId = 'collabs_' + Math.random().toString(36).substring(2, 10);
      this.mqttClient = new PahoClient(MQTT_BROKER, MQTT_PORT, MQTT_PATH, clientId);

      this.mqttClient.onConnectionLost = (responseObject) => {
        this.isMqttConnected = false;
        if (responseObject.errorCode !== 0) {
          console.debug('[ChatService] Live WS connection lost:', responseObject.errorMessage);
          this.scheduleMqttReconnect();
        }
      };

      this.mqttClient.onMessageArrived = (message) => {
        this.handleIncomingMqttMessage(message.payloadString);
      };

      this.connectMqtt();
    } catch (err) {
      console.warn('[ChatService] MQTT init failed:', err);
    }
  }

  // Connect or reconnect to MQTT broker
  connectMqtt() {
    if (!this.mqttClient || this.isMqttConnected) return;

    try {
      this.mqttClient.connect({
        useSSL: true,
        timeout: 8,
        keepAliveInterval: 30,
        cleanSession: true,
        onSuccess: () => {
          this.isMqttConnected = true;
          console.log('[ChatService] Live WebSocket connected to HiveMQ global channel');
          try {
            this.mqttClient.subscribe(MQTT_TOPIC, { qos: 1 });
          } catch (subErr) {
            console.warn('[ChatService] Subscribe failed:', subErr);
          }
        },
        onFailure: (err) => {
          this.isMqttConnected = false;
          console.debug('[ChatService] Live WS connect attempt failed:', err?.errorMessage || err);
          this.scheduleMqttReconnect();
        }
      });
    } catch (err) {
      console.warn('[ChatService] Error starting MQTT connect:', err);
      this.scheduleMqttReconnect();
    }
  }

  scheduleMqttReconnect() {
    if (this.mqttReconnectTimer) return;
    this.mqttReconnectTimer = setTimeout(() => {
      this.mqttReconnectTimer = null;
      this.connectMqtt();
    }, 4000);
  }

  // Handle incoming live message received via WebSocket from another device
  handleIncomingMqttMessage(payloadString) {
    try {
      const msg = JSON.parse(payloadString);
      if (!msg || !msg.id) return;

      // Handle team roster / email sync packets
      if (msg.type === 'system_roster_update') {
        if (msg.roleId && msg.email) {
          try {
            const raw = localStorage.getItem('collabs_team_role_emails_v1');
            const emails = raw ? JSON.parse(raw) : {};
            emails[msg.roleId] = String(msg.email).trim().toLowerCase();
            localStorage.setItem('collabs_team_role_emails_v1', JSON.stringify(emails));
            console.log(`[ChatService] Synced @${msg.roleId} email across devices: ${msg.email}`);
          } catch (e) {
            console.warn('Failed to cache synced team email', e);
          }
        }
        return;
      }

      // Handle remote chat clear events
      if (msg.type === 'system_chat_clear') {
        if (msg.roomId === 'all') {
          try {
            localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify([]));
          } catch {}
        } else if (msg.roomId) {
          const current = this.getAllMessages();
          const filtered = current.filter((m) => m.roomId !== msg.roomId);
          try {
            localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(filtered));
          } catch {}
        }
        this.notifyListeners();
        return;
      }

      const current = this.getAllMessages();
      const existing = current.find((m) => m.id === msg.id);
      if (existing) return; // Deduplicate

      const updated = [...current, msg].sort(
        (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
      );

      const trimmed = updated.slice(-400);
      try {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(trimmed));
      } catch (e) {
        console.warn('Failed to cache incoming MQTT message', e);
      }

      // Notify UI listeners with the incoming message for alerts & toasts
      this.notifyListeners(msg);
    } catch (err) {
      console.debug('[ChatService] Error processing incoming MQTT packet:', err);
    }
  }

  // Handle local BroadcastChannel (same machine multi-tab)
  handleLocalBroadcast(msg) {
    if (!msg || !msg.id) return;

    // Handle team roster / email sync packets across local tabs
    if (msg.type === 'system_roster_update') {
      if (msg.roleId && msg.email) {
        try {
          const raw = localStorage.getItem('collabs_team_role_emails_v1');
          const emails = raw ? JSON.parse(raw) : {};
          emails[msg.roleId] = String(msg.email).trim().toLowerCase();
          localStorage.setItem('collabs_team_role_emails_v1', JSON.stringify(emails));
        } catch (e) {}
      }
      return;
    }

    // Handle local chat clear events across tabs
    if (msg.type === 'system_chat_clear') {
      if (msg.roomId === 'all') {
        try {
          localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify([]));
        } catch {}
      } else if (msg.roomId) {
        const current = this.getAllMessages();
        const filtered = current.filter((m) => m.roomId !== msg.roomId);
        try {
          localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(filtered));
        } catch {}
      }
      this.notifyListeners();
      return;
    }

    const current = this.getAllMessages();
    if (!current.some((m) => m.id === msg.id)) {
      const updated = [...current, msg];
      try {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(updated.slice(-400)));
      } catch {}
    }
    this.notifyListeners(msg);
  }

  // Broadcast developer email to whole team across WebSockets & local tabs
  broadcastRosterUpdate(roleId, email, senderName = '') {
    if (!roleId || !email) return;
    const packet = {
      id: 'roster_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type: 'system_roster_update',
      roleId,
      email: String(email).trim().toLowerCase(),
      senderName: senderName || 'Team Member',
      timestamp: new Date().toISOString()
    };

    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage(packet);
      }
    } catch {}

    this.publishMqttMessage(packet);
  }

  // Publish message to MQTT broker
  publishMqttMessage(message) {
    if (!this.mqttClient || !this.isMqttConnected) {
      // Reconnect if needed
      this.connectMqtt();
      return;
    }

    try {
      const PahoModule = Paho.default || Paho;
      const PahoMessage = PahoModule.Message || window?.Paho?.MQTT?.Message;
      if (!PahoMessage) return;

      const payload = JSON.stringify(message);
      const mqttMsg = new PahoMessage(payload);
      mqttMsg.destinationName = MQTT_TOPIC;
      mqttMsg.qos = 1;
      this.mqttClient.send(mqttMsg);
    } catch (err) {
      console.warn('[ChatService] Failed to send message over live WS:', err);
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

  // Fetch messages from global Cloudinary CDN tag list (backfill for missed history)
  async fetchRemoteMessages() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const cacheBuster = Date.now();
      const res = await fetch(`${CHAT_LIST_URL}?t=${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        this.isSyncing = false;
        return;
      }

      const data = await res.json();
      const resources = Array.isArray(data?.resources) ? data.resources : [];

      if (resources.length === 0) {
        this.isSyncing = false;
        return;
      }

      const localMessages = this.getAllMessages();
      const localIds = new Set(localMessages.map((m) => m.id));
      const localCloudIds = new Set(localMessages.map((m) => m.cloudPublicId).filter(Boolean));
      const deletedSet = this.getDeletedIds();
      const clearedRooms = this.getClearedRooms();
      const allClearedAt = clearedRooms['all'] || 0;

      // Find resources we haven't fetched into our local cache and haven't deleted
      const missingResources = resources.filter(
        (r) => r.public_id && !localCloudIds.has(r.public_id) && !deletedSet.has(r.public_id)
      );

      if (missingResources.length === 0) {
        this.isSyncing = false;
        return;
      }

      // Fetch the content of newly detected cloud messages (limit to 15 recent)
      const fetchedNew = [];
      for (const r of missingResources.slice(0, 15)) {
        try {
          const fileUrl = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/v${r.version}/${r.public_id}`;
          const msgRes = await fetch(fileUrl, { cache: 'no-store' });
          if (msgRes.ok) {
            const msgJson = await msgRes.json();
            if (msgJson && msgJson.id) {
              if (deletedSet.has(msgJson.id)) continue;
              const roomClearedAt = clearedRooms[msgJson.roomId] || 0;
              const msgTime = new Date(msgJson.timestamp || 0).getTime();
              if (msgTime <= allClearedAt || msgTime <= roomClearedAt) {
                deletedSet.add(msgJson.id);
                continue;
              }

              if (!localIds.has(msgJson.id)) {
                msgJson.cloudPublicId = r.public_id;
                fetchedNew.push(msgJson);
                localIds.add(msgJson.id);
              }
            }
          }
        } catch (fetchErr) {
          console.debug('[ChatService] single message fetch skipped', fetchErr);
        }
      }

      if (fetchedNew.length > 0) {
        const merged = [...localMessages, ...fetchedNew].sort(
          (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
        );

        const trimmed = merged.slice(-400);

        try {
          localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(trimmed));
        } catch (e) {
          console.warn('Failed to cache remote messages', e);
        }

        // Notify UI silently for backfilled messages (DO NOT trigger alert toasts or sound chimes for old history)
        this.notifyListeners();
      }
    } catch (err) {
      // Offline or network error
    } finally {
      this.isSyncing = false;
    }
  }

  // Push an individual message asset to Cloudinary CDN tag list for persistent cloud archive
  async pushMessageToCloud(message) {
    try {
      const payload = JSON.stringify(message);
      const blob = new Blob([payload], { type: 'application/json' });

      const formData = new FormData();
      formData.append('file', blob, 'msg.json');
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('tags', CHAT_TAG);
      formData.append('folder', CHAT_FOLDER);

      // Context metadata for instant listing inspection
      const cleanText = (message.text || '').replace(/[|;=]/g, ' ').slice(0, 120);
      const cleanSender = (message.sender?.name || '').replace(/[|;=]/g, ' ').slice(0, 40);
      formData.append('context', `caption=${cleanText}|sender=${cleanSender}|role=${message.sender?.role || ''}`);

      const res = await fetch(CHAT_UPLOAD_URL, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        message.cloudPublicId = data.public_id;
        const current = this.getAllMessages();
        const updated = current.map((m) => (m.id === message.id ? { ...m, cloudPublicId: data.public_id } : m));
        try {
          localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('[ChatService] Network error pushing message to cloud:', err);
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
            name: parsedAuth.name || 'Team Member',
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
      name: 'Team Member',
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
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse chat messages', e);
    }
    return INITIAL_MESSAGES;
  }

  // Get deleted message IDs
  getDeletedIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DELETED);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {}
    return new Set();
  }

  recordDeleted(ids = []) {
    try {
      const current = this.getDeletedIds();
      ids.forEach((id) => {
        if (id) current.add(id);
      });
      localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify([...current]));
    } catch (e) {
      console.warn('Failed to record deleted chat message IDs', e);
    }
  }

  getClearedRooms() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CLEARED_ROOMS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }

  recordClearedRoom(roomId) {
    try {
      const current = this.getClearedRooms();
      current[roomId] = Date.now();
      localStorage.setItem(STORAGE_KEY_CLEARED_ROOMS, JSON.stringify(current));
    } catch {}
  }

  // Clear messages for a specific room / channel
  clearRoomMessages(roomId) {
    if (!roomId) return;
    const current = this.getAllMessages();
    const toDelete = current.filter((m) => m.roomId === roomId);
    const deletedIds = toDelete.map((m) => m.id);
    const deletedCloudIds = toDelete.map((m) => m.cloudPublicId).filter(Boolean);
    this.recordDeleted([...deletedIds, ...deletedCloudIds]);
    this.recordClearedRoom(roomId);

    const updated = current.filter((m) => m.roomId !== roomId);
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to clear room messages', e);
    }
    this.notifyListeners();
    this.broadcastClearEvent(roomId);
  }

  // Clear all messages across all rooms
  clearAllMessages() {
    const current = this.getAllMessages();
    const deletedIds = current.map((m) => m.id);
    const deletedCloudIds = current.map((m) => m.cloudPublicId).filter(Boolean);
    this.recordDeleted([...deletedIds, ...deletedCloudIds]);
    this.recordClearedRoom('all');
    DEFAULT_CHANNELS.forEach((ch) => this.recordClearedRoom(ch.id));

    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify([]));
    } catch (e) {
      console.warn('Failed to clear all messages', e);
    }
    this.notifyListeners();
    this.broadcastClearEvent('all');
  }

  // Broadcast clear event to other tabs & devices
  broadcastClearEvent(roomId) {
    const packet = {
      id: 'clear_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type: 'system_chat_clear',
      roomId,
      timestamp: new Date().toISOString()
    };
    try {
      if (this.broadcastChannel) this.broadcastChannel.postMessage(packet);
    } catch {}
    this.publishMqttMessage(packet);
  }

  // Upload voice note recording to Cloudinary
  async uploadVoiceNote(audioBlob) {
    if (!audioBlob) throw new Error('No audio data provided');

    const formData = new FormData();
    const ext = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
    const fileName = `voice_${Date.now()}.${ext}`;
    formData.append('file', audioBlob, fileName);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'collabs/voice');
    formData.append('tags', 'collabs,voice,chat');

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to upload voice note');
    }

    return (data.secure_url || data.url || '').replace(/^http:\/\//i, 'https://');
  }

  // Get messages for a specific room
  getRoomMessages(roomId) {
    const all = this.getAllMessages();
    return all.filter((m) => m.roomId === roomId);
  }

  // Send a new message (text or voice)
  sendMessage({ roomId, text, mentions = [], type = 'text', audioUrl = null, duration = 0 }) {
    if (!text && mentions.length === 0 && !audioUrl) return null;

    const user = this.getCurrentUser();
    const newMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      roomId: roomId || 'general',
      sender: {
        id: user.id,
        name: user.name || 'Team Member',
        role: user.role || 'b2b'
      },
      text: (text || '').trim(),
      type: type || (audioUrl ? 'voice' : 'text'),
      audioUrl: audioUrl || null,
      duration: Number(duration) || 0,
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

    // 2. Notify local listeners instantly (Zero lag for sender)
    this.notifyListeners(newMessage);

    // 3. Publish to live WebSockets (<100ms instant delivery to other laptops/phones)
    this.publishMqttMessage(newMessage);

    // 4. Archive to Cloudinary tag listing in background (for permanent cloud history)
    this.pushMessageToCloud(newMessage);

    return newMessage;
  }

  // Get unread counts
  getUnreadCount(currentRoomId = null) {
    return 0;
  }
}

export const chatService = new ChatService();
