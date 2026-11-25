/**
 * Chat Service for CollabS (Phase 6 - Multi-Project Communication Hub)
 * Manages project-scoped channels (#general, team-specific sides, #docs-feedback, #lead-line),
 * authenticated user profile & project role, persistent backend database storage,
 * real-time multi-tab broadcasting (BroadcastChannel),
 * instant multi-device WebSockets scoped by project (HiveMQ MQTT over WSS),
 * and secondary cross-device cloud archive via Cloudinary CDN Tag List.
 */

import Paho from 'paho-mqtt';

// Cloud Sync Settings (Cloudinary Unsigned Tag Listing)
const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'dtaz4vhxh';
const UPLOAD_PRESET = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) || 'CollabS';
const CHAT_FOLDER = 'collabs/chat';
const CHAT_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;

// Live Multi-Device Real-Time WebSocket Broker (Public WSS - Zero Config, Sub-100ms delivery)
const MQTT_BROKER = 'broker.hivemq.com';
const MQTT_PORT = 8884;
const MQTT_PATH = '/mqtt';

// Default team channels fallback
export const DEFAULT_CHANNELS = [
  { id: 'general', name: 'general', description: 'General project discussion & questions', type: 'channel' },
  { id: 'docs-feedback', name: 'docs-feedback', description: 'PRD, Docs & Architecture review', type: 'channel' },
  { id: 'lead-line', name: 'lead-line', description: 'Project Lead notices & questions', type: 'channel' }
];

// Base team roles for tagging & identification
export const TEAM_ROLES = [
  { id: 'all', name: 'all', displayName: 'All Members', badgeColor: '#f97316', isBroadcast: true },
  { id: 'lead', name: 'Lead', displayName: 'Project Lead', badgeColor: '#f59e0b' },
  { id: 'frontend', name: 'Frontend', displayName: 'Frontend Team', badgeColor: '#3b82f6' },
  { id: 'backend', name: 'Backend', displayName: 'Backend Team', badgeColor: '#10b981' },
  { id: 'qa', name: 'QA', displayName: 'QA & Testing Team', badgeColor: '#8b5cf6' }
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
    this.currentProject = null;
    this.activeSubscribedTopic = null;

    // 1. Same-device multi-tab synchronization via BroadcastChannel
    this.initBroadcastChannel();

    // 2. Instant multi-device synchronization via HiveMQ WebSockets (<100ms latency)
    if (typeof window !== 'undefined') {
      this.initMqtt();
    }

    // 3. Periodic cloud / backend check
    if (typeof window !== 'undefined') {
      this.pollInterval = setInterval(() => {
        if (this.currentProject?.id) {
          this.fetchProjectMessages(this.currentProject.id);
        }
      }, 10000);

      window.addEventListener('focus', () => {
        if (this.currentProject?.id) {
          this.fetchProjectMessages(this.currentProject.id);
        }
        if (!this.isMqttConnected) {
          this.connectMqtt();
        }
      });
    }
  }

  getProjectId() {
    return this.currentProject?.id || 'default';
  }

  getStorageKeyMessages() {
    return `collabs_chat_messages_v2_${this.getProjectId()}`;
  }

  getStorageKeyDeleted() {
    return `collabs_chat_deleted_ids_v2_${this.getProjectId()}`;
  }

  getStorageKeyClearedRooms() {
    return `collabs_chat_cleared_rooms_v2_${this.getProjectId()}`;
  }

  getMqttTopic() {
    return `collabs/v2/projects/${this.getProjectId()}/chat`;
  }

  getBroadcastChannelName() {
    return `collabs_chat_bus_v2_${this.getProjectId()}`;
  }

  getCloudinaryTag() {
    return `collabs_chat_${this.getProjectId()}`;
  }

  initBroadcastChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;

    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.close();
      }
      this.broadcastChannel = new BroadcastChannel(this.getBroadcastChannelName());
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'NEW_MESSAGE') {
          this.handleLocalBroadcast(event.data.message);
        }
      };
    } catch (err) {
      console.warn('[ChatService] BroadcastChannel unavailable', err);
    }
  }

  // Switch the active project and re-scope all communication channels
  setProject(project) {
    if (!project) return;
    const prevId = this.currentProject?.id;
    this.currentProject = project;

    if (prevId === project.id) return;

    console.log(`[ChatService] Switching chat scope to project: "${project.name}" (${project.id})`);

    // 1. Re-initialize BroadcastChannel for the new project
    this.initBroadcastChannel();

    // 2. Re-subscribe MQTT topic to the new project
    if (this.mqttClient && this.isMqttConnected) {
      if (this.activeSubscribedTopic) {
        try {
          this.mqttClient.unsubscribe(this.activeSubscribedTopic);
        } catch {}
      }
      const newTopic = this.getMqttTopic();
      try {
        this.mqttClient.subscribe(newTopic, { qos: 1 });
        this.activeSubscribedTopic = newTopic;
        console.log(`[ChatService] Subscribed to project MQTT topic: ${newTopic}`);
      } catch (subErr) {
        console.warn('[ChatService] Subscribe failed:', subErr);
      }
    }

    // 3. Fetch backend messages for this project
    this.fetchProjectMessages(project.id);

    // 4. Notify UI listeners so rooms and messages update immediately
    this.notifyListeners();
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
        this.activeSubscribedTopic = null;
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
          const topic = this.getMqttTopic();
          console.log('[ChatService] Live WebSocket connected to HiveMQ topic:', topic);
          try {
            this.mqttClient.subscribe(topic, { qos: 1 });
            this.activeSubscribedTopic = topic;
          } catch (subErr) {
            console.warn('[ChatService] Subscribe failed:', subErr);
          }
        },
        onFailure: (err) => {
          this.isMqttConnected = false;
          this.activeSubscribedTopic = null;
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

      // Project scope validation: discard if not for current project
      if (msg.projectId && msg.projectId !== this.getProjectId()) {
        return;
      }

      // Handle remote chat clear events
      if (msg.type === 'system_chat_clear') {
        const key = this.getStorageKeyMessages();
        if (msg.roomId === 'all') {
          try {
            localStorage.setItem(key, JSON.stringify([]));
          } catch {}
        } else if (msg.roomId) {
          const current = this.getAllMessages();
          const filtered = current.filter((m) => m.roomId !== msg.roomId);
          try {
            localStorage.setItem(key, JSON.stringify(filtered));
          } catch {}
        }
        this.notifyListeners();
        return;
      }

      const current = this.getAllMessages();
      const existing = current.find((m) =>
        m.id === msg.id || (
          m.roomId === msg.roomId &&
          m.sender?.id === msg.sender?.id &&
          m.text === msg.text &&
          Math.abs(new Date(m.timestamp || 0) - new Date(msg.timestamp || 0)) < 5000
        )
      );
      if (existing) return; // Deduplicate

      const updated = [...current, msg].sort(
        (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
      );

      const trimmed = updated.slice(-400);
      try {
        localStorage.setItem(this.getStorageKeyMessages(), JSON.stringify(trimmed));
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

    if (msg.projectId && msg.projectId !== this.getProjectId()) {
      return;
    }

    if (msg.type === 'system_chat_clear') {
      const key = this.getStorageKeyMessages();
      if (msg.roomId === 'all') {
        try {
          localStorage.setItem(key, JSON.stringify([]));
        } catch {}
      } else if (msg.roomId) {
        const current = this.getAllMessages();
        const filtered = current.filter((m) => m.roomId !== msg.roomId);
        try {
          localStorage.setItem(key, JSON.stringify(filtered));
        } catch {}
      }
      this.notifyListeners();
      return;
    }

    const current = this.getAllMessages();
    const isDuplicate = current.some((m) =>
      m.id === msg.id || (
        m.roomId === msg.roomId &&
        m.sender?.id === msg.sender?.id &&
        m.text === msg.text &&
        Math.abs(new Date(m.timestamp || 0) - new Date(msg.timestamp || 0)) < 5000
      )
    );
    if (!isDuplicate) {
      const updated = [...current, msg];
      try {
        localStorage.setItem(this.getStorageKeyMessages(), JSON.stringify(updated.slice(-400)));
      } catch {}
    }
    this.notifyListeners(msg);
  }

  // Publish message to MQTT broker scoped by project
  publishMqttMessage(message) {
    if (!this.mqttClient || !this.isMqttConnected) {
      this.connectMqtt();
      return;
    }

    try {
      const PahoModule = Paho.default || Paho;
      const PahoMessage = PahoModule.Message || window?.Paho?.MQTT?.Message;
      if (!PahoMessage) return;

      const payload = JSON.stringify(message);
      const mqttMsg = new PahoMessage(payload);
      mqttMsg.destinationName = this.getMqttTopic();
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

  // Fetch messages from backend for the specified project
  async fetchProjectMessages(projectId = null) {
    const targetId = projectId || this.getProjectId();
    if (!targetId || targetId === 'default') return;

    try {
      const token = localStorage.getItem('collabs_auth_token_v2');
      if (!token) return;

      const res = await fetch(`/api/projects/${targetId}/chat`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) return;

      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        const local = this.getAllMessages();
        const localIds = new Set(local.map((m) => m.id));
        const merged = [...local];
        let hasNew = false;

        data.messages.forEach((msg) => {
          const isDuplicate = localIds.has(msg.id) || merged.some((m) =>
            m.id === msg.id || (
              m.roomId === msg.roomId &&
              m.sender?.id === msg.sender?.id &&
              m.text === msg.text &&
              Math.abs(new Date(m.timestamp || 0) - new Date(msg.timestamp || 0)) < 5000
            )
          );
          if (!isDuplicate) {
            merged.push(msg);
            localIds.add(msg.id);
            hasNew = true;
          }
        });

        if (hasNew) {
          merged.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
          try {
            localStorage.setItem(this.getStorageKeyMessages(), JSON.stringify(merged.slice(-400)));
          } catch {}
          this.notifyListeners();
        }
      }
    } catch (err) {
      console.debug('[ChatService] Backend fetch error:', err);
    }
  }

  // Push an individual message asset to Cloudinary CDN tag list as secondary backup
  async pushMessageToCloud(message) {
    try {
      const payload = JSON.stringify(message);
      const blob = new Blob([payload], { type: 'application/json' });

      const formData = new FormData();
      formData.append('file', blob, 'msg.json');
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('tags', this.getCloudinaryTag());
      formData.append('folder', `${CHAT_FOLDER}/${this.getProjectId()}`);

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
          localStorage.setItem(this.getStorageKeyMessages(), JSON.stringify(updated));
        } catch {}
      }
    } catch (err) {
      console.debug('[ChatService] Cloudinary push skipped/offline:', err);
    }
  }

  // User Profile
  getCurrentUser() {
    try {
      // 1. Prioritize authenticated user from Phase 1
      const userRaw = localStorage.getItem('collabs_auth_user_v2');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        if (u && u.id) {
          let role = 'Member';
          if (this.currentProject) {
            if (this.currentProject.leadId === u.id) {
              role = 'Project Lead';
            } else if (Array.isArray(this.currentProject.members)) {
              const mem = this.currentProject.members.find(
                (m) => m.userId === u.id || (m.email && m.email.toLowerCase() === u.email?.toLowerCase())
              );
              if (mem && mem.team) role = mem.team;
            }
          }
          return {
            id: u.id,
            name: u.name || 'Team Member',
            email: u.email,
            role
          };
        }
      }

      // 2. Legacy fallback
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
    } catch {
      // fallback
    }

    return {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: 'Team Member',
      role: 'Member'
    };
  }

  getInitialMessages() {
    if (!this.currentProject) {
      return [
        {
          id: 'msg-seed-general',
          roomId: 'general',
          sender: { name: 'CollabS Hub', role: 'System' },
          text: 'Welcome to CollabS Team Chat! 👋 Ask any project questions or tag your teammates here.',
          mentions: [],
          timestamp: new Date().toISOString()
        }
      ];
    }
    return [
      {
        id: `msg-seed-${this.getProjectId()}`,
        projectId: this.getProjectId(),
        roomId: 'general',
        sender: { name: 'CollabS Hub', role: 'System' },
        text: `Welcome to ${this.currentProject.name} Chat! 💬 Collaborate with your Project Lead and custom teams here.`,
        mentions: [],
        timestamp: new Date().toISOString()
      }
    ];
  }

  // Get all messages for active project
  getAllMessages() {
    try {
      const raw = localStorage.getItem(this.getStorageKeyMessages());
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse chat messages', e);
    }
    return this.getInitialMessages();
  }

  // Get deleted message IDs
  getDeletedIds() {
    try {
      const raw = localStorage.getItem(this.getStorageKeyDeleted());
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
      localStorage.setItem(this.getStorageKeyDeleted(), JSON.stringify([...current]));
    } catch (e) {
      console.warn('Failed to record deleted chat message IDs', e);
    }
  }

  getClearedRooms() {
    try {
      const raw = localStorage.getItem(this.getStorageKeyClearedRooms());
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }

  recordClearedRoom(roomId) {
    try {
      const current = this.getClearedRooms();
      current[roomId] = Date.now();
      localStorage.setItem(this.getStorageKeyClearedRooms(), JSON.stringify(current));
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
      localStorage.setItem(this.getStorageKeyMessages(), JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to clear room messages', e);
    }

    // Call backend API
    try {
      const token = localStorage.getItem('collabs_auth_token_v2');
      const projectId = this.getProjectId();
      if (token && projectId && projectId !== 'default') {
        fetch(`/api/projects/${projectId}/chat?roomId=${encodeURIComponent(roomId)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
      }
    } catch (e) {}

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

    try {
      localStorage.setItem(this.getStorageKeyMessages(), JSON.stringify([]));
    } catch (e) {
      console.warn('Failed to clear all messages', e);
    }

    // Call backend API
    try {
      const token = localStorage.getItem('collabs_auth_token_v2');
      const projectId = this.getProjectId();
      if (token && projectId && projectId !== 'default') {
        fetch(`/api/projects/${projectId}/chat`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
      }
    } catch (e) {}

    this.notifyListeners();
    this.broadcastClearEvent('all');
  }

  // Broadcast clear event to other tabs & devices
  broadcastClearEvent(roomId) {
    const packet = {
      id: 'clear_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type: 'system_chat_clear',
      projectId: this.getProjectId(),
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
    formData.append('folder', `${CHAT_FOLDER}/${this.getProjectId()}/voice`);
    formData.append('tags', `collabs,voice,chat,${this.getProjectId()}`);

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
    const projectId = this.getProjectId();
    const newMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      projectId,
      roomId: roomId || 'general',
      sender: {
        id: user.id,
        name: user.name || 'Team Member',
        role: user.role || 'Member'
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
      localStorage.setItem(this.getStorageKeyMessages(), JSON.stringify(updated));
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

    // 4. Persist to Backend Express database
    try {
      const token = localStorage.getItem('collabs_auth_token_v2');
      if (token && projectId && projectId !== 'default') {
        fetch(`/api/projects/${projectId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            id: newMessage.id,
            timestamp: newMessage.timestamp,
            roomId: newMessage.roomId,
            text: newMessage.text,
            mentions: newMessage.mentions,
            type: newMessage.type,
            audioUrl: newMessage.audioUrl,
            duration: newMessage.duration
          })
        }).catch((e) => console.debug('[ChatService] Backend chat post error:', e));
      }
    } catch (e) {}

    // 5. Push to secondary Cloudinary cloud archive
    this.pushMessageToCloud(newMessage);

    return newMessage;
  }

  getUnreadCount() {
    return 0;
  }
}

export const chatService = new ChatService();
