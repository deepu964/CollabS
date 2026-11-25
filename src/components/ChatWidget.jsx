import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Paperclip,
  AtSign,
  FileText,
  Image as ImageIcon,
  Shield,
  User,
  Users,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Smile,
  Hash,
  Megaphone,
  Bell,
  Mic,
  Square,
  Trash2,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { chatService, DEFAULT_CHANNELS, TEAM_ROLES } from '../services/chatService';
import VoiceMessagePlayer from './VoiceMessagePlayer';

let sharedAudioCtx = null;
function getAudioContext() {
  if (!sharedAudioCtx && typeof window !== 'undefined') {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export default function ChatWidget({
  references = [],
  activeCategory = null,
  activeReference = null,
  onOpenReference = () => {},
  onOpenDoc = () => {},
  activeProject = null,
  currentUser: propUser = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState('general');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [stagedMentions, setStagedMentions] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => chatService.getCurrentUser());
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionTab, setMentionTab] = useState('roles'); // 'roles' | 'docs' | 'images'
  const [mentionSearch, setMentionSearch] = useState('');
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);

  // Notification States
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeMentionToast, setActiveMentionToast] = useState(null);

  // Voice Note Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const originalTitleRef = useRef(typeof document !== 'undefined' ? document.title : 'CollabS');
  const titleIntervalRef = useRef(null);

  // Voice recorder references
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);

  // Unlock browser audio context on first user click or keypress
  useEffect(() => {
    const unlockAudio = () => {
      getAudioContext();
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Audio Chime Generator (Dual tone Apple notification chime)
  const playNotificationChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      // Note 1 (E5 - 659Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // Note 2 (B5 - 987Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.1);
      gain2.gain.setValueAtTime(0.2, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.42);
    } catch (e) {
      console.debug('[Audio] chime error', e);
    }
  };

  // Browser Tab Title Blinker
  const startTitleBlink = (text) => {
    stopTitleBlink();
    let state = false;
    titleIntervalRef.current = setInterval(() => {
      document.title = state ? text : originalTitleRef.current;
      state = !state;
    }, 1000);
  };

  const stopTitleBlink = () => {
    if (titleIntervalRef.current) {
      clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
    }
    document.title = originalTitleRef.current;
  };

  // Stop blinking on window focus
  useEffect(() => {
    const handleFocus = () => {
      stopTitleBlink();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      stopTitleBlink();
    };
  }, []);

  // Auto-dismiss mention toast after 7s
  useEffect(() => {
    if (!activeMentionToast) return;
    const t = setTimeout(() => {
      setActiveMentionToast(null);
    }, 7000);
    return () => clearTimeout(t);
  }, [activeMentionToast]);

  // Project-Scoped Dynamic Channels (General, Sides / Teams, Docs, Lead Line)
  const projectChannels = useMemo(() => {
    if (!activeProject) return DEFAULT_CHANNELS;
    const base = [
      { id: 'general', name: 'general', description: 'General discussion', type: 'channel' }
    ];
    if (Array.isArray(activeProject.teams)) {
      activeProject.teams.forEach((t) => {
        base.push({
          id: `team-${t.id}`,
          name: t.name.toLowerCase().replace(/\s+/g, '-'),
          description: `${t.name} discussions`,
          type: 'channel',
          teamId: t.id
        });
      });
    }
    base.push(
      { id: 'docs-feedback', name: 'docs-feedback', description: 'Docs review', type: 'channel' },
      { id: 'lead-line', name: 'lead-line', description: 'Lead channel', type: 'channel' }
    );
    return base;
  }, [activeProject]);

  // Project-Scoped Dynamic Mentions List (@all, @lead, custom teams, individual members)
  const projectRoles = useMemo(() => {
    const list = [
      { id: 'all', name: 'all', displayName: 'All Members', badgeColor: '#f97316', isBroadcast: true },
      { id: 'lead', name: 'Lead', displayName: 'Project Lead', badgeColor: '#f59e0b' }
    ];
    if (Array.isArray(activeProject?.teams)) {
      activeProject.teams.forEach((t) => {
        list.push({
          id: `team_${t.id}`,
          name: t.name,
          displayName: `${t.name} Team`,
          badgeColor: '#10b981'
        });
      });
    }
    if (Array.isArray(activeProject?.members)) {
      activeProject.members.forEach((m) => {
        list.push({
          id: `member_${m.userId}`,
          name: m.email?.split('@')[0] || 'member',
          displayName: m.email,
          badgeColor: '#3b82f6',
          isMember: true
        });
      });
    }
    return list;
  }, [activeProject]);

  // Sync active project scope with ChatService
  useEffect(() => {
    if (activeProject) {
      chatService.setProject(activeProject);
      setCurrentUser(chatService.getCurrentUser());
      setMessages(chatService.getRoomMessages(activeRoomId));
    }
  }, [activeProject]);

  // Ensure activeRoomId exists in current project channels
  useEffect(() => {
    if (!projectChannels.some((c) => c.id === activeRoomId)) {
      setActiveRoomId('general');
    }
  }, [projectChannels, activeRoomId]);

  // Subscribe to real-time chat updates & targeted notifications
  useEffect(() => {
    const handleIncoming = (incomingMsg) => {
      setMessages(chatService.getRoomMessages(activeRoomId));

      if (incomingMsg) {
        const isFromMe =
          incomingMsg.sender?.id === currentUser.id ||
          incomingMsg.sender?.name === currentUser.name;

        if (!isFromMe) {
          const myRole = (currentUser.role || '').toLowerCase();
          const myName = (currentUser.name || '').toLowerCase();
          const rawText = (incomingMsg.text || '').toLowerCase();

          // 1. Structured mentions check (Case-insensitive)
          const isMentionedInArray = incomingMsg.mentions?.some((m) => {
            const mId = (m.id || '').toLowerCase();
            const mName = (m.name || '').toLowerCase();
            return (
              mId === myRole ||
              mId === 'all' ||
              mName === myRole ||
              mName === 'all' ||
              (myName && mName === myName) ||
              (myRole.includes('lead') && (mId === 'lead' || mName.includes('lead') || mId === 'admin' || mName.includes('admin'))) ||
              (myRole.includes('admin') && (mId === 'admin' || mName.includes('admin'))) ||
              (myRole === 'backend' && (mId === 'backend' || mName.includes('backend')))
            );
          });

          // 2. Direct text mention check
          const isMentionedInText =
            /(?:^|\s)@all\b/i.test(rawText) ||
            (myRole && new RegExp(`(?:^|\\s)@${myRole}\\b`, 'i').test(rawText)) ||
            (myName && new RegExp(`(?:^|\\s)@${myName}\\b`, 'i').test(rawText)) ||
            (myRole.includes('lead') && /(?:^|\s)@lead\b/i.test(rawText));

          const isDirectRoomMatch =
            (myRole.includes('lead') && incomingMsg.roomId === 'lead-line');

          if (isMentionedInArray || isMentionedInText || isDirectRoomMatch) {
            playNotificationChime();
            setActiveMentionToast(incomingMsg);
            setUnreadCount((prev) => prev + 1);

            const isAll = /(?:^|\s)@all\b/i.test(rawText) || incomingMsg.mentions?.some(m => (m.id || '').toLowerCase() === 'all' || (m.name || '').toLowerCase() === 'all');
            const alertTag = isAll ? '@all' : `@${currentUser.name || myRole}`;
            startTitleBlink(`🔴 (1) New Doubt for ${alertTag} | CollabS`);
          }
        }
      }
    };

    handleIncoming();
    const unsubscribe = chatService.subscribe(handleIncoming);
    return () => unsubscribe();
  }, [activeRoomId, currentUser]);

  // Handle open chat & reset notifications
  const handleOpenChat = (targetRoomId = null) => {
    if (targetRoomId) {
      setActiveRoomId(targetRoomId);
    }
    setIsOpen(true);
    setUnreadCount(0);
    setActiveMentionToast(null);
    stopTitleBlink();
  };

  // Close chat drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setShowRoomDropdown(false);
        setShowProfileModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Scroll to bottom on new message or when opening
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Load docs from localStorage for mentions
  const docsList = useMemo(() => {
    try {
      const raw = localStorage.getItem('collabs_docs_library_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return [
      { id: 'doc-master-prd', title: 'CollabS Master PRD', fileName: 'CollabS-Master-PRD.md' },
      { id: 'doc-auth-spec', title: 'Auth & JWT Flow Architecture', fileName: 'Auth-Flow.md' },
      { id: 'doc-b2b-api', title: 'B2B Wholesale API Specification', fileName: 'B2B-API.md' }
    ];
  }, [isOpen]);

  // Filtered mentions based on query
  const filteredDocs = useMemo(() => {
    return docsList.filter((d) =>
      d.title.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      (d.fileName && d.fileName.toLowerCase().includes(mentionSearch.toLowerCase()))
    );
  }, [docsList, mentionSearch]);

  const filteredReferences = useMemo(() => {
    return references.filter((r) =>
      (r.title || '').toLowerCase().includes(mentionSearch.toLowerCase()) ||
      (r.category || '').toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [references, mentionSearch]);

  const filteredRoles = useMemo(() => {
    return projectRoles.filter((r) =>
      r.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      (r.displayName && r.displayName.toLowerCase().includes(mentionSearch.toLowerCase())) ||
      r.id.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [projectRoles, mentionSearch]);

  const activeChannel = useMemo(() => {
    return projectChannels.find((c) => c.id === activeRoomId) || projectChannels[0];
  }, [projectChannels, activeRoomId]);

  // Handle typing and detecting '@'
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    const lastWord = val.split(/\s+/).pop() || '';
    if (lastWord.startsWith('@')) {
      const query = lastWord.slice(1);
      setShowMentionMenu(true);
      setMentionSearch(query);

      const qLower = query.toLowerCase();
      // Auto-detect best tab based on query:
      if (
        !qLower ||
        TEAM_ROLES.some(
          (r) =>
            r.name.toLowerCase().includes(qLower) ||
            r.id.toLowerCase().includes(qLower) ||
            (r.displayName && r.displayName.toLowerCase().includes(qLower))
        )
      ) {
        setMentionTab('roles');
      } else if (
        docsList.some(
          (d) =>
            d.title.toLowerCase().includes(qLower) ||
            (d.fileName && d.fileName.toLowerCase().includes(qLower))
        )
      ) {
        setMentionTab('docs');
      } else if (
        references.some(
          (r) =>
            (r.title || '').toLowerCase().includes(qLower) ||
            (r.category || '').toLowerCase().includes(qLower)
        )
      ) {
        setMentionTab('images');
      } else {
        setMentionTab('roles');
      }
    } else if (showMentionMenu && !lastWord.startsWith('@')) {
      setShowMentionMenu(false);
      setMentionSearch('');
    }
  };

  // Add mention item
  const handleSelectMention = (item, type) => {
    let mentionObj = null;
    let mentionTag = '';

    if (type === 'doc') {
      mentionObj = { type: 'doc', id: item.id, title: item.title, fileName: item.fileName };
      mentionTag = `@${item.title} `;
    } else if (type === 'image') {
      mentionObj = {
        type: 'image',
        id: item.id,
        title: item.title || 'Referenced Screen',
        imageUrl: item.imageUrl,
        category: item.category
      };
      mentionTag = `@${item.title || 'Screen'} `;
    } else if (type === 'role') {
      mentionObj = {
        type: 'role',
        id: item.id,
        name: item.name,
        isBroadcast: Boolean(item.isBroadcast || item.id === 'all')
      };
      mentionTag = `@${item.name} `;
    }

    if (mentionObj) {
      setStagedMentions((prev) => {
        if (prev.some((m) => m.id === mentionObj.id && m.type === mentionObj.type)) return prev;
        return [...prev, mentionObj];
      });

      // Replace the trailing @query with @Title
      const words = inputText.split(/\s+/);
      if (words[words.length - 1]?.startsWith('@')) {
        words.pop();
      }
      const updatedText = words.join(' ') + (words.length > 0 ? ' ' : '') + mentionTag;
      setInputText(updatedText);
    }

    setShowMentionMenu(false);
    setMentionSearch('');
    inputRef.current?.focus();
  };

  // Quick attach current view
  const handleAttachCurrentView = () => {
    if (activeReference) {
      handleSelectMention(activeReference, 'image');
    } else if (activeCategory === 'docs') {
      if (docsList.length > 0) {
        handleSelectMention(docsList[0], 'doc');
      }
    } else if (activeCategory) {
      const match = references.find((r) => r.category === activeCategory);
      if (match) {
        handleSelectMention(match, 'image');
      }
    }
  };

  // Remove a staged mention chip
  const handleRemoveStagedMention = (index) => {
    setStagedMentions((prev) => prev.filter((_, i) => i !== index));
  };

    // Start voice recording
  const handleStartVoiceRecording = async () => {
    setVoiceError(null);
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Voice recording is not supported in this browser environment.');
      setTimeout(() => setVoiceError(null), 4000);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      let mimeType = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
          else mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to access microphone:', err);
      setVoiceError('Microphone permission denied. Please allow microphone access in your browser.');
      setTimeout(() => setVoiceError(null), 5000);
    }
  };

  // Cancel voice recording without sending
  const handleCancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Finish and upload voice note
  const handleSendVoiceRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    const duration = recordingSeconds || 1;
    setIsRecording(false);
    setIsUploadingVoice(true);

    mediaRecorderRef.current.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorderRef.current.mimeType || 'audio/webm'
        });

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }

        const audioUrl = await chatService.uploadVoiceNote(audioBlob);

        chatService.sendMessage({
          roomId: activeRoomId,
          text: `🎙️ Voice Note (${duration}s)`,
          type: 'voice',
          audioUrl,
          duration,
          mentions: stagedMentions
        });

        setStagedMentions([]);
      } catch (err) {
        console.error('Failed to upload/send voice note:', err);
        setVoiceError('Failed to upload voice note. Please try again.');
        setTimeout(() => setVoiceError(null), 4000);
      } finally {
        setIsUploadingVoice(false);
        setRecordingSeconds(0);
        audioChunksRef.current = [];
      }
    };

    try {
      mediaRecorderRef.current.stop();
    } catch (e) {
      console.warn('Error stopping mediaRecorder', e);
      setIsUploadingVoice(false);
    }
  };

  // Send message
  const handleSendMessage = (e) => {
    e?.preventDefault();
    const rawText = inputText.trim();
    if (!rawText && stagedMentions.length === 0) return;

    // Automatically detect @mentions from text regardless of casing (camelCase, lower, upper)
    const finalMentions = [...stagedMentions];
    const mentionRegex = /(?:^|\s)@([a-zA-Z0-9_-]+)/g;
    let match;

    while ((match = mentionRegex.exec(rawText)) !== null) {
      const tag = match[1].toLowerCase();
      const matchedRole = TEAM_ROLES.find(
        (r) =>
          r.id.toLowerCase() === tag ||
          r.name.toLowerCase() === tag ||
          (r.displayName && r.displayName.toLowerCase().includes(tag))
      );

      if (matchedRole && !finalMentions.some((m) => m.id === matchedRole.id)) {
        finalMentions.push({
          type: 'role',
          id: matchedRole.id,
          name: matchedRole.name,
          isBroadcast: Boolean(matchedRole.isBroadcast || matchedRole.id === 'all')
        });
      }
    }

    chatService.sendMessage({
      roomId: activeRoomId,
      text: rawText,
      mentions: finalMentions
    });

    setInputText('');
    setStagedMentions([]);
    setShowMentionMenu(false);
    setMentionSearch('');
  };

  // Role pill styling helper
  const getRoleBadgeStyle = (roleId) => {
    const found = TEAM_ROLES.find((r) => r.id === roleId);
    return {
      backgroundColor: found ? `${found.badgeColor}22` : '#3b82f622',
      color: found ? found.badgeColor : '#3b82f6',
      borderColor: found ? `${found.badgeColor}44` : '#3b82f644'
    };
  };

  return (
    <>
      {/* Voice Recording Error Toast */}
      {voiceError && (
        <div className="collabs-mention-toast-alert error-toast" role="alert">
          <div className="mention-toast-icon-box error-icon-box">
            <AlertCircle size={16} />
          </div>
          <div className="mention-toast-content">
            <p className="toast-message-snippet">{voiceError}</p>
          </div>
          <button
            type="button"
            className="toast-dismiss-x-btn"
            onClick={() => setVoiceError(null)}
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Floating In-App Mention Toast Alert Banner */}
      {activeMentionToast && (
        <div className="collabs-mention-toast-alert" role="alert">
          <div className="mention-toast-icon-box">
            <Bell size={18} className="mention-toast-bell-icon" />
          </div>
          <div className="mention-toast-content">
            <div className="mention-toast-header">
              <span className="toast-sender-name">{activeMentionToast.sender?.name || 'Teammate'}</span>
              <span className="toast-badge-role">
                tagged {activeMentionToast.mentions?.some(m => m.id === 'all') ? '@all' : `@${currentUser.name}`}
              </span>
            </div>
            <p className="toast-message-snippet">{activeMentionToast.text || 'Referenced a document / screen'}</p>
          </div>
          <div className="mention-toast-actions">
            <button
              type="button"
              className="toast-open-chat-btn"
              onClick={() => handleOpenChat(activeMentionToast.roomId)}
            >
              Reply
            </button>
            <button
              type="button"
              className="toast-dismiss-x-btn"
              onClick={() => setActiveMentionToast(null)}
              aria-label="Dismiss alert"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Floating Trigger Button with Unread Badge */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => handleOpenChat()}
          className={`collabs-chat-fab-trigger ${unreadCount > 0 ? 'has-unreads' : ''}`}
          title="Open Team Chat"
          aria-label="Open team chat"
        >
          <div className="fab-icon-wrapper">
            <MessageSquare size={18} />
            {unreadCount > 0 && (
              <span className="fab-unread-counter-badge">{unreadCount}</span>
            )}
          </div>
          <span className="fab-label">
            {unreadCount > 0 ? `Chat (${unreadCount})` : 'Chat'}
          </span>
        </button>
      )}

      {/* Slide-out / Floating Chat Window */}
      {isOpen && (
        <div className="collabs-chat-drawer-container" aria-label="Team Chat Window">
          {/* Header */}
          <div className="chat-drawer-header">
            <div className="header-room-select-group">
              <button
                type="button"
                className="room-picker-toggle-btn"
                onClick={() => setShowRoomDropdown(!showRoomDropdown)}
                title="Switch channel"
              >
                <Hash size={15} className="room-hash-icon" />
                <span className="room-title-text">{activeChannel.name}</span>
                <ChevronDown size={13} className={`chevron-icon ${showRoomDropdown ? 'rotated' : ''}`} />
              </button>

              {/* Room selector dropdown */}
              {showRoomDropdown && (
                <div className="chat-room-dropdown-menu">
                  <div className="dropdown-section-title">CHANNELS</div>
                  {projectChannels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      className={`dropdown-room-item ${ch.id === activeRoomId ? 'selected' : ''}`}
                      onClick={() => {
                        setActiveRoomId(ch.id);
                        setShowRoomDropdown(false);
                      }}
                    >
                      <Hash size={14} />
                      <div className="dropdown-room-info">
                        <span className="dropdown-room-name">{ch.name}</span>
                        <span className="dropdown-room-desc">{ch.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="header-actions-group">
              {/* Clear Chat Button */}
              <button
                type="button"
                className="chat-clear-trigger-btn"
                onClick={() => setShowClearConfirmModal(true)}
                title="Clear messages"
                aria-label="Clear chat messages"
              >
                <Trash2 size={14} />
              </button>

              {/* Prominent Close / Dismiss Button */}
              <button
                type="button"
                className="chat-close-btn"
                onClick={() => {
                  setIsOpen(false);
                  setShowRoomDropdown(false);
                  setShowProfileModal(false);
                }}
                title="Close chat (Esc)"
                aria-label="Close chat"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Clear Chat Confirmation Modal */}
          {showClearConfirmModal && (
            <div className="chat-clear-dialog-overlay" onClick={() => setShowClearConfirmModal(false)}>
              <div className="chat-clear-dialog-card" onClick={(e) => e.stopPropagation()}>
                <div className="chat-clear-dialog-header">
                  <div className="chat-clear-dialog-icon">
                    <Trash2 size={18} />
                  </div>
                  <div>
                    <h4 className="chat-clear-dialog-title">Clear Chat History</h4>
                    <p className="chat-clear-dialog-subtitle">Free up space and remove conversation messages.</p>
                  </div>
                </div>

                <div className="chat-clear-dialog-actions">
                  <button
                    type="button"
                    className="chat-clear-opt-btn primary"
                    onClick={() => {
                      chatService.clearRoomMessages(activeRoomId);
                      setShowClearConfirmModal(false);
                    }}
                  >
                    Clear #{activeChannel.name} only
                  </button>
                  <button
                    type="button"
                    className="chat-clear-opt-btn danger"
                    onClick={() => {
                      chatService.clearAllMessages();
                      setShowClearConfirmModal(false);
                    }}
                  >
                    Clear all channels
                  </button>
                  <button
                    type="button"
                    className="chat-clear-opt-btn cancel"
                    onClick={() => setShowClearConfirmModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* User Profile Switcher Popover */}
          {showProfileModal && (
            <div className="chat-profile-popover">
              <div className="popover-heading">
                <span>Your Chat Profile</span>
                <button
                  type="button"
                  className="popover-close-btn"
                  onClick={() => setShowProfileModal(false)}
                >
                  <X size={13} />
                </button>
              </div>
              <div className="popover-field">
                <label>Your Name:</label>
                <input
                  type="text"
                  value={currentUser.name}
                  onChange={(e) => {
                    const updated = { ...currentUser, name: e.target.value };
                    setCurrentUser(updated);
                    chatService.setCurrentUser(updated);
                  }}
                  placeholder="e.g. Deepak"
                />
              </div>
              <div className="popover-field">
                <label>Your Role (shows in messages):</label>
                <div className="roles-grid">
                  {TEAM_ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`role-select-chip ${currentUser.role === r.id ? 'active' : ''}`}
                      style={{
                        borderColor: currentUser.role === r.id ? r.badgeColor : undefined,
                        color: currentUser.role === r.id ? r.badgeColor : undefined
                      }}
                      onClick={() => {
                        const updated = { ...currentUser, role: r.id };
                        setCurrentUser(updated);
                        chatService.setCurrentUser(updated);
                      }}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Room Description Banner */}
          <div className="chat-channel-subbar">
            <span>{activeChannel.description}</span>
          </div>

          {/* Messages Feed */}
          <div className="chat-messages-scroll-area">
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <Sparkles size={24} className="empty-sparkle-icon" />
                <p className="empty-title">#{activeChannel.name}</p>
                <p className="empty-subtitle">Send a message or type @ to mention</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender?.id === currentUser.id || msg.sender?.name === currentUser.name;
                const roleStyle = getRoleBadgeStyle(msg.sender?.role);

                // Disambiguate personal name vs role name (avoids B2B Client repeated twice)
                const roleObj = TEAM_ROLES.find((r) => r.id === msg.sender?.role);
                const roleTagText = roleObj?.displayName || roleObj?.name || msg.sender?.role || 'Member';
                const rawSenderName = (msg.sender?.name || '').trim();
                const isDuplicated =
                  !rawSenderName ||
                  rawSenderName.toLowerCase() === (msg.sender?.role || '').toLowerCase() ||
                  rawSenderName.toLowerCase() === roleTagText.toLowerCase();

                const cleanSenderName = isDuplicated ? 'Team Member' : rawSenderName;

                return (
                  <div key={msg.id} className={`chat-message-row ${isMe ? 'own-message' : ''}`}>
                    <div className="message-avatar-indicator">
                      {cleanSenderName.charAt(0).toUpperCase()}
                    </div>
                    <div className="message-content-bundle">
                      <div className="message-meta-header">
                        <span className="sender-name">{cleanSenderName}</span>
                        <span className="sender-role-tag" style={roleStyle}>
                          {roleTagText}
                        </span>
                        <span className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Main Message Bubble */}
                      <div className="message-bubble-body">
                        {msg.type === 'voice' || msg.audioUrl ? (
                          <VoiceMessagePlayer
                            audioUrl={msg.audioUrl}
                            duration={msg.duration}
                            isMe={isMe}
                          />
                        ) : null}

                        {(!msg.type || msg.type === 'text' || (!msg.audioUrl && msg.text)) && (
                          <p className="message-text">
                            {msg.text || (msg.mentions?.filter((m) => m.type === 'role' || m.id === 'all').map((m) => `@${m.name}`).join(' ')) || ''}
                          </p>
                        )}

                        {/* Interactive Mention Chips (Docs / Images) */}
                        {Array.isArray(msg.mentions) &&
                          msg.mentions.filter((m) => m.type === 'doc' || m.type === 'image').length > 0 && (
                          <div className="message-mentions-container">
                            {msg.mentions
                              .filter((m) => m.type === 'doc' || m.type === 'image')
                              .map((m, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className={`mention-interactive-chip chip-${m.type}`}
                                onClick={() => {
                                  if (m.type === 'doc') {
                                    onOpenDoc(m.id);
                                  } else if (m.type === 'image') {
                                    const foundRef = references.find((r) => r.id === m.id) || m;
                                    onOpenReference(foundRef);
                                  }
                                }}
                                title={`Click to view ${m.title || m.name}`}
                              >
                                {m.type === 'doc' ? (
                                  <>
                                    <FileText size={13} className="chip-icon doc-icon" />
                                    <span className="chip-label">{m.title}</span>
                                    <ExternalLink size={11} className="chip-link-icon" />
                                  </>
                                ) : (
                                  <>
                                    <ImageIcon size={13} className="chip-icon img-icon" />
                                    <span className="chip-label">{m.title}</span>
                                    <ExternalLink size={11} className="chip-link-icon" />
                                  </>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Autocomplete Mention Menu */}
          {showMentionMenu && (
            <div className="chat-mention-autocomplete-menu">
              <div className="mention-tabs-bar">
                <button
                  type="button"
                  className={`mention-tab-btn ${mentionTab === 'roles' ? 'active' : ''}`}
                  onClick={() => setMentionTab('roles')}
                >
                  <Users size={12} />
                  <span>Team Roles ({filteredRoles.length})</span>
                </button>
                <button
                  type="button"
                  className={`mention-tab-btn ${mentionTab === 'docs' ? 'active' : ''}`}
                  onClick={() => setMentionTab('docs')}
                >
                  <FileText size={12} />
                  <span>Docs ({filteredDocs.length})</span>
                </button>
                <button
                  type="button"
                  className={`mention-tab-btn ${mentionTab === 'images' ? 'active' : ''}`}
                  onClick={() => setMentionTab('images')}
                >
                  <ImageIcon size={12} />
                  <span>Images / Screens ({filteredReferences.length})</span>
                </button>
              </div>

              <div className="mention-items-list">
                {mentionTab === 'docs' && (
                  filteredDocs.length > 0 ? (
                    filteredDocs.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className="mention-item-row"
                        onClick={() => handleSelectMention(doc, 'doc')}
                      >
                        <FileText size={14} className="mention-row-icon doc" />
                        <div className="mention-row-text">
                          <span className="mention-item-name">{doc.title}</span>
                          <span className="mention-item-detail">{doc.fileName || 'Document'}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="mention-empty-hint">No matching docs found</div>
                  )
                )}

                {mentionTab === 'images' && (
                  filteredReferences.length > 0 ? (
                    filteredReferences.map((ref) => (
                      <button
                        key={ref.id}
                        type="button"
                        className="mention-item-row"
                        onClick={() => handleSelectMention(ref, 'image')}
                      >
                        {ref.imageUrl ? (
                          <img src={ref.imageUrl} alt="" className="mention-thumb-img" />
                        ) : (
                          <ImageIcon size={14} className="mention-row-icon image" />
                        )}
                        <div className="mention-row-text">
                          <span className="mention-item-name">{ref.title || 'Screen Reference'}</span>
                          <span className="mention-item-detail">{ref.category?.toUpperCase() || 'Media'}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="mention-empty-hint">No matching references found</div>
                  )
                )}

                {mentionTab === 'roles' && (
                  filteredRoles.length > 0 ? (
                    filteredRoles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        className={`mention-item-row ${role.isBroadcast ? 'mention-broadcast-row' : ''}`}
                        onClick={() => handleSelectMention(role, 'role')}
                      >
                        {role.isBroadcast ? (
                          <div className="mention-broadcast-badge">
                            <Megaphone size={12} />
                          </div>
                        ) : (
                          <span
                            className="mention-role-dot"
                            style={{ backgroundColor: role.badgeColor }}
                          />
                        )}
                        <div className="mention-row-text">
                          <span className="mention-item-name">@{role.name}</span>
                          <span className="mention-item-detail">
                            {role.isBroadcast
                              ? 'Notify everyone (All 5 Roles)'
                              : `Notify ${role.displayName || role.name} pillar`}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="mention-empty-hint">No matching roles found</div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Staged Mentions Bar (Attached references waiting to be sent) */}
          {stagedMentions.length > 0 && (
            <div className="chat-staged-mentions-bar">
              <span className="staged-label">Attached:</span>
              <div className="staged-chips-list">
                {stagedMentions.map((stg, i) => (
                  <span key={i} className={`staged-mention-tag tag-${stg.type}`}>
                    {stg.type === 'doc' ? (
                      <FileText size={11} />
                    ) : stg.type === 'role' ? (
                      <span className="staged-chip-at">@</span>
                    ) : (
                      <ImageIcon size={11} />
                    )}
                    <span className="staged-text">{stg.title || stg.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStagedMention(i)}
                      className="staged-chip-remove-btn"
                      title="Remove attachment"
                      aria-label="Remove attachment"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Input Footer */}
          {isRecording ? (
            <div className="chat-voice-recording-dock">
              <div className="recording-status-group">
                <span className="recording-pulsing-dot" />
                <span className="recording-timer">
                  {Math.floor(recordingSeconds / 60)}:
                  {(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
                <div className="recording-live-bars">
                  <span className="rec-bar" />
                  <span className="rec-bar" />
                  <span className="rec-bar" />
                  <span className="rec-bar" />
                  <span className="rec-bar" />
                </div>
                <span className="recording-hint-text">Recording voice note...</span>
              </div>

              <div className="recording-actions-group">
                <button
                  type="button"
                  className="voice-cancel-btn"
                  onClick={handleCancelVoiceRecording}
                  title="Discard recording"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  type="button"
                  className="voice-send-btn"
                  onClick={handleSendVoiceRecording}
                  title="Send voice note"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          ) : isUploadingVoice ? (
            <div className="chat-voice-uploading-dock">
              <Loader2 size={16} className="voice-spinner-icon" />
              <span>Uploading & sending voice note...</span>
            </div>
          ) : (
            <form className="chat-input-footer-form" onSubmit={handleSendMessage}>
              <div className="input-toolbar-left">
                {/* @ Mention Trigger Button */}
                <button
                  type="button"
                  className={`chat-tool-btn ${showMentionMenu ? 'active' : ''}`}
                  onClick={() => setShowMentionMenu(!showMentionMenu)}
                  title="Mention doc, image or role (@)"
                >
                  <AtSign size={15} />
                </button>

                {/* Attach Current Page / Ref Button */}
                <button
                  type="button"
                  className="chat-tool-btn"
                  onClick={handleAttachCurrentView}
                  title="Attach current doc or screen"
                >
                  <Paperclip size={15} />
                </button>

                {/* Voice Note Record Trigger Button */}
                <button
                  type="button"
                  className="chat-tool-btn chat-mic-btn"
                  onClick={handleStartVoiceRecording}
                  title="Record voice note (Click to start)"
                >
                  <Mic size={15} />
                </button>
              </div>

              <textarea
                ref={inputRef}
                rows={1}
                className="chat-textarea-input"
                placeholder={`Message #${activeChannel.name}...`}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (showMentionMenu) {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setShowMentionMenu(false);
                      return;
                    }
                    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                      let targetItem = null;
                      let targetType = null;
                      if (mentionTab === 'roles' && filteredRoles.length > 0) {
                        targetItem = filteredRoles[0];
                        targetType = 'role';
                      } else if (mentionTab === 'docs' && filteredDocs.length > 0) {
                        targetItem = filteredDocs[0];
                        targetType = 'doc';
                      } else if (mentionTab === 'images' && filteredReferences.length > 0) {
                        targetItem = filteredReferences[0];
                        targetType = 'image';
                      }

                      if (targetItem && targetType) {
                        e.preventDefault();
                        handleSelectMention(targetItem, targetType);
                        return;
                      }
                    }
                  }

                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />

              <button
                type="submit"
                disabled={!inputText.trim() && stagedMentions.length === 0}
                className="chat-send-submit-btn"
                title="Send message (Enter)"
              >
                <Send size={15} />
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
