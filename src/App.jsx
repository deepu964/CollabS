import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';
import DirectUploadCard from './components/DirectUploadCard';
import MinimalCard from './components/MinimalCard';
import FullscreenLightbox from './components/FullscreenLightbox';
import WorkflowCanvas from './components/WorkflowCanvas';
import UploadModal from './components/UploadModal';
import DocsPillarView from './components/DocsPillarView';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import NotificationToast from './components/NotificationToast';
import ChatWidget from './components/ChatWidget';
import TeamAuthGate from './components/TeamAuthGate';
import AuthModal from './components/AuthModal';
import SwitchRoleModal from './components/SwitchRoleModal';
import ProjectManagerModal from './components/ProjectManagerModal';
import TeamsManagerModal from './components/TeamsManagerModal';
import AcceptInviteModal from './components/AcceptInviteModal';
import { authService } from './services/authService';
import { projectService } from './services/projectService';
import { invitationService } from './services/invitationService';
import {
  Sun,
  Moon,
  Building2,
  ShieldCheck,
  Smartphone,
  FileText,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Layers,
  LayoutGrid,
  Share2,
  X,
  Plus,
  LogOut,
  User,
  ChevronDown,
  Folder,
  Users,
  PanelLeft,
  PanelLeftClose
} from 'lucide-react';
import {
  isCloudinaryConfigured,
  fetchAllCloudinaryMedia,
  fetchCloudinaryCategoryMedia,
  markCloudinaryAssetAsDeleted
} from './services/cloudinary';

const STORAGE_KEY_REFS = 'collabs_minimal_refs_v2';
const STORAGE_KEY_THEME = 'collabs_theme_v2';

const getProjectRefsKey = (projId) =>
  projId ? `collabs_minimal_refs_v2_${projId}` : STORAGE_KEY_REFS;

// All projects are 100% private and start with clean slate isolation

const ICON_MAP = {
  b2b: Building2,
  admin: ShieldCheck,
  driver: Smartphone,
  docs: FileText
};

const DUMMY_IDS = new Set([
  'ref-101', 'ref-102', 'ref-103',
  'ref-201', 'ref-202', 'ref-203',
  'ref-301', 'ref-302', 'ref-303'
]);

export default function App() {
  // Theme state: dark / light
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved !== null) return JSON.parse(saved);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Individual Authenticated User & Role Member (Phase 1)
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [authenticatedMember, setAuthenticatedMember] = useState(() =>
    authService.getAuthenticatedMember()
  );
  const [isSwitchRoleModalOpen, setIsSwitchRoleModalOpen] = useState(false);

  // Active Multi-Project Workspace (Phase 2 & 3)
  const [activeProject, setActiveProject] = useState(() => projectService.getActiveProject());
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTeamsModalOpen, setIsTeamsModalOpen] = useState(false);

  // Collapsible Left Pillars Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('collabs_sidebar_open_v2');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('collabs_sidebar_open_v2', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Member Invitations Workflow (Phase 4)
  const [pendingInviteToken, setPendingInviteToken] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('invite') || null;
    } catch {
      return null;
    }
  });
  const [verifiedInvitation, setVerifiedInvitation] = useState(null);
  const [isAcceptInviteModalOpen, setIsAcceptInviteModalOpen] = useState(false);

  // Detect & verify invitation token from URL
  useEffect(() => {
    if (!pendingInviteToken) return;
    invitationService.verifyInvitation(pendingInviteToken).then((res) => {
      if (res.success && res.invitation) {
        setVerifiedInvitation(res.invitation);
        setIsAcceptInviteModalOpen(true);
      } else {
        setToast({
          type: 'error',
          message: res.error || 'Invitation is invalid or has expired.'
        });
        window.history.replaceState({}, document.title, window.location.pathname);
        setPendingInviteToken(null);
      }
    });
  }, [pendingInviteToken]);

  const handleInvitationAccepted = (joinedProject) => {
    setIsAcceptInviteModalOpen(false);
    setVerifiedInvitation(null);
    setPendingInviteToken(null);
    window.history.replaceState({}, document.title, window.location.pathname);

    if (joinedProject) {
      setActiveProject(joinedProject);
      projectService.setActiveProject(joinedProject);
      setToast({
        type: 'success',
        message: `Joined project "${joinedProject.name}"!`
      });
    }
  };

  // Verify JWT session on app mount
  useEffect(() => {
    let isMounted = true;
    authService.verifySession().then((user) => {
      if (!isMounted) return;
      if (user) {
        setCurrentUser(user);
        setAuthenticatedMember(authService.getAuthenticatedMember());
      } else {
        setCurrentUser(null);
        setAuthenticatedMember(null);
        setActiveProject(null);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync projects when authenticated
  useEffect(() => {
    if (!currentUser) {
      setActiveProject(null);
      return;
    }

    projectService.fetchProjects().then((res) => {
      if (res.success && Array.isArray(res.projects)) {
        if (res.projects.length === 0) {
          // User has no projects: clean slate, open creation modal
          setActiveProject(null);
          projectService.clearActiveProject();
          setIsProjectModalOpen(true);
          return;
        }

        const saved = projectService.getActiveProject();
        const exists = saved && res.projects.find((p) => p.id === saved.id);
        if (exists) {
          setActiveProject(exists);
        } else {
          setActiveProject(res.projects[0]);
          projectService.setActiveProject(res.projects[0]);
        }
      }
    });
  }, [currentUser]);

  // Phase 5: Dynamic Role-Based Permissions
  const isProjectLead = useMemo(() => {
    return Boolean(activeProject && currentUser && activeProject.leadId === currentUser.id);
  }, [activeProject, currentUser]);

  const userProjectRole = useMemo(() => {
    if (!activeProject || !currentUser) return 'Member';
    if (activeProject.leadId === currentUser.id) return 'Project Lead';
    const member = activeProject.members?.find(
      (m) =>
        m.userId === currentUser.id ||
        (m.email && m.email.toLowerCase() === currentUser.email?.toLowerCase())
    );
    return member?.team ? `${member.team} Member` : 'Team Member';
  }, [activeProject, currentUser]);

  // Synchronize authenticated member role & team context
  useEffect(() => {
    if (currentUser && activeProject) {
      const isLead = activeProject.leadId === currentUser.id;
      const member = activeProject.members?.find(
        (m) =>
          m.userId === currentUser.id ||
          (m.email && m.email.toLowerCase() === currentUser.email?.toLowerCase())
      );
      const teamName = member?.team || (isLead ? 'Management' : 'General');
      const updatedMember = {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: isLead ? 'admin' : teamName.toLowerCase(),
        roleName: isLead ? 'Project Lead' : `${teamName} Member`,
        shortName: currentUser.name.split(' ')[0],
        badgeColor: isLead ? '#f59e0b' : '#3b82f6',
        isLead,
        team: teamName
      };
      setAuthenticatedMember(updatedMember);
      localStorage.setItem('collabs_authenticated_member_v2', JSON.stringify(updatedMember));
    }
  }, [currentUser, activeProject]);

  const handleUserAuthenticated = (user) => {
    setCurrentUser(user);
    setAuthenticatedMember(authService.getAuthenticatedMember());
    setToast({
      type: 'success',
      message: `Welcome to CollabS, ${user.name}!`
    });
  };

  const handleSelectProject = (project) => {
    setActiveProject(project);
    projectService.setActiveProject(project);
    setActiveCategory('all');
    setIsProjectModalOpen(false);
    if (project) {
      setToast({
        type: 'success',
        message: `Switched to project "${project.name}"`
      });
    }
  };

  const handleProjectUpdated = (updatedProject) => {
    if (updatedProject && updatedProject.id === activeProject?.id) {
      setActiveProject(updatedProject);
      projectService.setActiveProject(updatedProject);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setAuthenticatedMember(null);
    setActiveProject(null);
    projectService.clearActiveProject();
    setIsSwitchRoleModalOpen(false);
    setToast({
      type: 'default',
      message: 'Signed out safely.'
    });
  };

  // Active Category: 'all' = All Project Resources directly; 'b2b' | 'admin' | 'driver' = Category Gallery; 'docs' = PRD Hub
  const [activeCategory, setActiveCategory] = useState('all');

  // Category View Mode: 'gallery' | 'workflow'
  const [categoryMode, setCategoryMode] = useState('gallery');

  // References state (cached in localStorage scoped to active project)
  const [references, setReferences] = useState(() => {
    try {
      const curProj = projectService.getActiveProject();
      if (curProj?.id) {
        const key = getProjectRefsKey(curProj.id);
        let saved = localStorage.getItem(key);
        // Fallback to legacy shared storage if active project is HIRE_D platform
        const isHired = curProj.id === 'prj_hired_platform' || curProj.id === 'prj_collabs_b2b_platform' || curProj.name?.toUpperCase().includes('HIRE') || curProj.name?.toLowerCase().includes('b2b');
        if (!saved && isHired) {
          saved = localStorage.getItem(STORAGE_KEY_REFS);
        }
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed.filter((item) => item && item.id && !DUMMY_IDS.has(item.id));
          }
        }
        return [];
      }
    } catch (e) {
      console.error('Failed to load cached references', e);
    }
    return [];
  });

  // Lightbox State
  const [selectedReference, setSelectedReference] = useState(null);

  // Delete Confirmation Modal & Toast State
  const [itemPendingDelete, setItemPendingDelete] = useState(null);
  const [isDeletingMedia, setIsDeletingMedia] = useState(false);
  const [toast, setToast] = useState(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Global Upload Modal State (B2B, Admin, Driver)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadModalCategory, setUploadModalCategory] = useState('b2b');

  // Sync state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedText, setLastUpdatedText] = useState('just now');
  const [cloudinaryNeedsSetting, setCloudinaryNeedsSetting] = useState(false);
  const [showCloudinaryGuide, setShowCloudinaryGuide] = useState(false);

  const cloudinaryReady = isCloudinaryConfigured();

  // Multi-tab sync via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('collabs_realtime_bus');

    channel.onmessage = (event) => {
      if (event.data?.type === 'ADD_REFERENCE') {
        const incoming = event.data.reference;
        setReferences((prev) => {
          if (prev.some((r) => r.id === incoming.id)) return prev;
          return [incoming, ...prev];
        });
        setLastUpdatedText('just now');
      } else if (event.data?.type === 'DELETE_REFERENCE') {
        const targetId = event.data.id;
        const targetPubId = event.data.publicId;
        if (targetId) markIdAsDeleted(targetId);
        if (targetPubId) markIdAsDeleted(targetPubId);
        setReferences((prev) =>
          prev.filter((r) => r.id !== targetId && (!targetPubId || r.publicId !== targetPubId))
        );
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  // Helper: Retrieve locally tracked deleted IDs to prevent ghost restoration
  const getDeletedIds = () => {
    try {
      const raw = localStorage.getItem('collabs_deleted_ids_v1');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  };

  const markIdAsDeleted = (id) => {
    if (!id) return;
    try {
      const current = getDeletedIds();
      current.add(id);
      const clean = id.replace(/^cld-/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      current.add(clean);
      current.add(`cld-${clean}`);
      localStorage.setItem('collabs_deleted_ids_v1', JSON.stringify([...current]));
    } catch (e) {
      console.debug('Failed to cache deleted id', e);
    }
  };

  // Sync from Cloudinary
  const syncLatestMedia = useCallback(async ({ isSilent = false } = {}) => {
    if (!isSilent) {
      setIsRefreshing(true);
    }

    try {
      // Query Cloudinary directly for all team media (with Cloudinary deletedIds filtering)
      if (cloudinaryReady) {
        const res = await fetchAllCloudinaryMedia();
        setCloudinaryNeedsSetting(Boolean(res.requiresSetting));

        if (res.success && Array.isArray(res.items)) {
          // Ingest globally deleted IDs from Cloudinary into persistent local storage
          if (Array.isArray(res.deletedIds) && res.deletedIds.length > 0) {
            res.deletedIds.forEach((dId) => markIdAsDeleted(dId));
          }
          const allDeletedSet = getDeletedIds();

          setReferences((prev) => {
            const cloudItemIds = new Set(res.items.map((it) => it.id));
            const cloudPublicIds = new Set(res.items.map((it) => it.publicId).filter(Boolean));

            // Purge deleted items from prev
            // Keep ONLY local items that are strictly unsynced uploads pending their first Cloudinary indexing
            const pendingLocalUnsynced = prev.filter((item) => {
              if (!item || !item.id) return false;
              if (allDeletedSet.has(item.id)) return false;
              if (item.publicId && allDeletedSet.has(item.publicId)) return false;
              if (DUMMY_IDS.has(item.id)) return false;
              return (
                item.isLocalUnsynced &&
                !cloudItemIds.has(item.id) &&
                (!item.publicId || !cloudPublicIds.has(item.publicId))
              );
            });

            // Authoritative Cloudinary items (filtered to active project workspace)
            const validCloudItems = res.items.filter((item) => {
              if (!item || !item.id) return false;
              if (allDeletedSet.has(item.id)) return false;
              if (item.publicId && allDeletedSet.has(item.publicId)) return false;
              if (DUMMY_IDS.has(item.id)) return false;

              // Enforce project isolation: asset must belong specifically to this active project
              if (activeProject?.id) {
                const isHiredPlatform =
                  activeProject.id === 'prj_hired_platform' ||
                  activeProject.id === 'prj_collabs_b2b_platform' ||
                  activeProject.name?.toUpperCase().includes('HIRE') ||
                  activeProject.name?.toLowerCase().includes('b2b');

                const belongsToProject =
                  item.projectId === activeProject.id ||
                  (item.publicId && item.publicId.includes(`collabs/${activeProject.id}/`)) ||
                  (isHiredPlatform && (!item.projectId || item.publicId?.startsWith('collabs/')));

                if (!belongsToProject) return false;
              }
              return true;
            });

            const reconciled = [...pendingLocalUnsynced, ...validCloudItems];

            // Stable diff check: do not trigger re-render if references array is identical in IDs and length
            if (
              prev.length === reconciled.length &&
              prev.every((item, idx) => item.id === reconciled[idx]?.id)
            ) {
              return prev; // Prevents unnecessary re-render and flickering!
            }

            return reconciled;
          });
        }
      }
    } catch (err) {
      console.warn('Sync check error:', err);
    } finally {
      if (!isSilent) {
        setIsRefreshing(false);
      }
      const now = new Date();
      setLastUpdatedText(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [cloudinaryReady]);

  // Initial sync on component mount
  useEffect(() => {
    syncLatestMedia({ isSilent: true });
  }, [syncLatestMedia]);

  // Sync Dark Theme class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
    localStorage.setItem(STORAGE_KEY_THEME, JSON.stringify(darkMode));
  }, [darkMode]);

  // Reload project-scoped references when active project changes
  useEffect(() => {
    if (!activeProject?.id) {
      setReferences([]);
      return;
    }
    try {
      const key = getProjectRefsKey(activeProject.id);
      let saved = localStorage.getItem(key);
      // Fallback to legacy shared storage if active project is HIRE_D platform
      const isHired = activeProject.id === 'prj_hired_platform' || activeProject.id === 'prj_collabs_b2b_platform' || activeProject.name?.toUpperCase().includes('HIRE') || activeProject.name?.toLowerCase().includes('b2b');
      if (!saved && isHired) {
        saved = localStorage.getItem(STORAGE_KEY_REFS);
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((item) => item && item.id && !DUMMY_IDS.has(item.id));
          setReferences(cleaned);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load project references', e);
    }

    // Clean slate: 0 items for newly created projects
    setReferences([]);
  }, [activeProject?.id]);

  // Cache references to localStorage scoped by project
  useEffect(() => {
    try {
      const key = getProjectRefsKey(activeProject?.id);
      localStorage.setItem(key, JSON.stringify(references));
    } catch (e) {
      console.error('Failed to cache references', e);
    }
  }, [references, activeProject?.id]);

  // Dynamic Project Sides / Pillars (Scoped to Active Project)
  const projectSides = useMemo(() => {
    if (Array.isArray(activeProject?.teams) && activeProject.teams.length > 0) {
      return activeProject.teams.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description || `${t.name} side resources`,
        color: t.color || '#3b82f6'
      }));
    }
    return [{ id: 'general', name: 'General', description: 'General project resources', color: '#3b82f6' }];
  }, [activeProject]);

  // Filter references for active category ('all' = show all project resources)
  const activeReferences = useMemo(() => {
    if (!activeCategory || activeCategory === 'all') return references;
    return references.filter(
      (r) => r.category === activeCategory || r.category?.toLowerCase() === activeCategory?.toLowerCase()
    );
  }, [references, activeCategory]);

  const activeCategoryObj = useMemo(() => {
    if (!activeCategory || activeCategory === 'all') {
      return {
        id: 'all',
        name: 'All Resources',
        description: `All media screens, UI wireframes, and project assets for ${activeProject?.name || 'this project'}.`
      };
    }
    if (activeCategory === 'docs') {
      return {
        id: 'docs',
        name: 'Docs & PRD',
        description: 'Product requirements, specifications, and project documentation.'
      };
    }
    const found = projectSides.find(
      (s) => s.id === activeCategory || s.id.toLowerCase() === activeCategory.toLowerCase() || s.name.toLowerCase() === activeCategory.toLowerCase()
    );
    if (found) return found;
    return {
      id: activeCategory,
      name: activeCategory,
      description: `${activeCategory} side resources.`
    };
  }, [activeCategory, projectSides, activeProject?.name]);

  // Gallery Pagination: 9 cards per page (Page 1 has 1 Upload card + 8 items = 9 cards, Page 2+ has 9 items)
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 on category change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory]);

  const totalPages = useMemo(() => {
    if (activeReferences.length <= 8) return 1;
    return 1 + Math.ceil((activeReferences.length - 8) / 9);
  }, [activeReferences.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  const pagedReferences = useMemo(() => {
    if (currentPage === 1) {
      return activeReferences.slice(0, 8);
    }
    const startIndex = 8 + (currentPage - 2) * 9;
    return activeReferences.slice(startIndex, startIndex + 9);
  }, [activeReferences, currentPage]);

  // Handle adding new reference (from DirectUploadCard & UploadModal)
  const handleAddReference = async (newRef) => {
    if (!newRef) {
      setToast({
        type: 'error',
        message: 'Could not add item: invalid data'
      });
      return;
    }

    // 1. Optimistic local update with immediate project-scoped persistence
    const optimisticRef = { ...newRef, isLocalUnsynced: true };
    setReferences((prev) => {
      const updated = [optimisticRef, ...prev];
      try {
        const key = getProjectRefsKey(activeProject?.id);
        localStorage.setItem(key, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save references to localStorage', e);
      }
      return updated;
    });
    setLastUpdatedText('just now');

    // 2. Broadcast to other open browser tabs on same device
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('collabs_realtime_bus');
        channel.postMessage({ type: 'ADD_REFERENCE', reference: optimisticRef });
        channel.close();
      } catch (err) {
        console.debug('BroadcastChannel error:', err);
      }
    }

    // 3. Success Toast Notification
    const sideObj = projectSides.find((s) => s.id === newRef.category);
    const sideName = sideObj?.name || newRef.category?.toUpperCase() || 'Gallery';
    setToast({
      type: 'success',
      message: `Added "${newRef.title || 'Media item'}" to ${sideName} successfully`
    });
  };

  // Prompt deletion with custom confirmation modal
  const handleRequestDelete = (id, ref) => {
    const targetRef = ref || references.find((r) => r.id === id);
    if (targetRef) {
      setItemPendingDelete(targetRef);
    }
  };

  // Confirmed delete execution
  const handleConfirmDelete = async () => {
    if (!itemPendingDelete) return;
    const targetRef = itemPendingDelete;
    const id = targetRef.id;
    const pubId = targetRef?.publicId || '';
    const imgUrl = targetRef?.imageUrl || '';

    setIsDeletingMedia(true);

    try {
      // 1. Mark as deleted in local storage
      markIdAsDeleted(id);
      if (pubId) markIdAsDeleted(pubId);

      // 2. Immediate local state update
      setReferences((prev) => prev.filter((r) => r.id !== id && (!pubId || r.publicId !== pubId)));
      if (selectedReference?.id === id) {
        setSelectedReference(null);
      }
      setLastUpdatedText('just now');

      // 3. Broadcast to other open browser tabs
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const channel = new BroadcastChannel('collabs_realtime_bus');
          channel.postMessage({ type: 'DELETE_REFERENCE', id, publicId: pubId });
          channel.close();
        } catch (err) {
          console.debug('BroadcastChannel error on delete:', err);
        }
      }

      // 4. Record deletion marker on Cloudinary so EVERY OTHER BROWSER knows it is deleted!
      try {
        await markCloudinaryAssetAsDeleted(id, pubId, imgUrl);
      } catch (err) {
        console.warn('Failed to record deletion on Cloudinary:', err);
      }

      // 5. Close confirmation modal and show Apple toast notification
      setItemPendingDelete(null);
      setToast({
        type: 'delete',
        message: `Deleted "${targetRef.title || 'Image'}" successfully`
      });
    } catch (err) {
      console.error('Delete error:', err);
      setToast({
        type: 'error',
        message: 'Could not delete item. Please try again.'
      });
    } finally {
      setIsDeletingMedia(false);
    }
  };

  return (
    <div className="minimal-app">
      {/* Top Header */}
      <header className="minimal-header">
        <div className="header-content">
          {/* Brand Logo, Sidebar Toggle, Active Project Pill & Breadcrumb */}
          <div className="minimal-brand-group">
            {/* Collapsible Sidebar Toggle Button */}
            <button
              type="button"
              className={`header-sidebar-toggle-btn ${isSidebarOpen ? 'active' : ''}`}
              onClick={toggleSidebar}
              title={isSidebarOpen ? 'Hide Pillars Sidebar (Press to collapse)' : 'Show Pillars Sidebar (Press to open)'}
              aria-label="Toggle Pillars Sidebar"
            >
              <PanelLeft size={16} />
            </button>

            <button
              type="button"
              className="minimal-brand"
              onClick={() => setActiveCategory('all')}
              title="Return to All Resources"
            >
              <span className="brand-name">CollabS</span>
            </button>

            {currentUser && (
              <button
                type="button"
                className="header-project-pill"
                onClick={() => setIsProjectModalOpen(true)}
                title="Switch or manage project workspaces"
              >
                <span className="pill-project-name">
                  {activeProject ? activeProject.name : 'Select Project'}
                </span>
                <ChevronDown size={11} style={{ opacity: 0.7 }} />
              </button>
            )}

            {/* Teams & Sides Pill grouped with project */}
            {currentUser && activeProject && (
              <button
                type="button"
                className="header-teams-pill"
                onClick={() => setIsTeamsModalOpen(true)}
                title="Manage project teams & member assignments"
              >
                <Users size={13} />
                <span>Teams</span>
              </button>
            )}

            {activeCategory && activeCategory !== 'all' && activeCategoryObj && (
              <div className="brand-breadcrumb">
                <span className="crumb-slash">/</span>
                <span className="crumb-current">{activeCategoryObj.name}</span>
              </div>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="minimal-header-actions">
            {/* Quick Upload Screen Button */}
            <button
              type="button"
              onClick={() => {
                setUploadModalCategory(activeCategory || 'b2b');
                setIsUploadModalOpen(true);
              }}
              className="header-upload-pill-btn"
              title="Upload UI image or video to B2B, Admin, or Driver"
            >
              <Plus size={13} />
              <span>Upload Media</span>
            </button>

            {/* Live Cloud Status Indicator */}
            <div
              className={`cloud-status-chip ${cloudinaryReady ? 'synced' : 'local'}`}
              title={
                cloudinaryReady
                  ? 'Cloud Storage Connected & Synchronized (Cloudinary CDN)'
                  : 'Local Storage Mode: Offline'
              }
            >
              <span className="status-label">
                {cloudinaryReady ? 'Live' : 'Local'}
              </span>
            </div>

            {/* Refresh / Sync Button */}
            <button
              type="button"
              onClick={() => syncLatestMedia({ isSilent: false })}
              disabled={isRefreshing}
              className="action-icon-btn"
              title={`Check for new uploads (Last updated: ${lastUpdatedText})`}
              aria-label="Refresh media"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
            </button>

            {/* Authenticated User Profile Pill & Sign Out Button (Phase 1) */}
            {currentUser ? (
              <div className="header-user-profile-group">
                <div
                  className="header-user-avatar-pill"
                  title={`Signed in as ${currentUser.email}`}
                >
                  <span className="auth-member-name">{currentUser.name}</span>
                  <span
                    className="user-role-badge"
                    style={{
                      backgroundColor: isProjectLead
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(59, 130, 246, 0.15)',
                      color: isProjectLead ? '#f59e0b' : '#3b82f6'
                    }}
                  >
                    {userProjectRole}
                  </span>
                </div>
                <button
                  type="button"
                  className="header-signout-btn"
                  onClick={handleLogout}
                  title="Sign out of CollabS"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : authenticatedMember ? (
              <button
                type="button"
                className="header-auth-member-pill"
                onClick={() => setIsSwitchRoleModalOpen(true)}
                title="Click to lock session or switch team role"
              >
                <span className="auth-member-name">{authenticatedMember.name}</span>
                <span className="auth-member-role-label">({authenticatedMember.shortName})</span>
              </button>
            ) : null}

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="action-icon-btn"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      {/* Cloudinary Setup Notice if Resource List is restricted */}
      {cloudinaryNeedsSetting && !showCloudinaryGuide && (
        <div className="cloudinary-setup-banner">
          <div className="setup-banner-content">
            <span className="setup-banner-badge">Cloudinary Sync Notice</span>
            <span className="setup-banner-text">
              To allow all browsers to automatically fetch shared Cloudinary uploads, enable <strong>Resource list</strong> in your Cloudinary Dashboard: <em>Settings &rarr; Security &rarr; Restricted media types &rarr; Enable 'Resource list'</em>.
            </span>
          </div>
          <button
            type="button"
            className="setup-banner-dismiss"
            onClick={() => setShowCloudinaryGuide(true)}
            title="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Workspace Body: Collapsible Pillars Sidebar + Main Viewport */}
      <div className={`app-workspace-body ${isSidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
        {/* Collapsible Left Pillars Sidebar */}
        <aside
          className={`pillars-collapsible-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}
          aria-label="Pillars & Sides Navigation"
        >
          <div className="pillars-sidebar-inner">
            <div className="pillars-sidebar-header">
              <div className="sidebar-header-badge">
                <Layers size={13} />
                <span>Pillars & Sides</span>
              </div>
              <button
                type="button"
                className="sidebar-collapse-btn"
                onClick={toggleSidebar}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>

            <nav className="pillars-sidebar-menu">
              {/* All Resources Button */}
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`sidebar-menu-btn ${!activeCategory || activeCategory === 'all' ? 'active' : ''}`}
                title="Overview of all resources"
              >
                <div className="menu-btn-icon-box">
                  <Layers size={15} />
                </div>
                <span className="menu-btn-title">All Resources</span>
                <span className="menu-btn-count">{references.length}</span>
              </button>

              <div className="sidebar-menu-divider" />

              <div className="sidebar-section-header">PROJECT SIDES</div>

              {projectSides.map((side) => {
                const Icon = ICON_MAP[side.id] || Building2;
                const isActive = activeCategory === side.id;
                let count = references.filter(
                  (r) => r.category === side.id || r.category?.toLowerCase() === side.name.toLowerCase()
                ).length;
                if (side.id === 'docs') {
                  try {
                    const saved = localStorage.getItem('collabs_docs_library_v2');
                    count = saved ? JSON.parse(saved).length : 0;
                  } catch {
                    count = 0;
                  }
                }

                return (
                  <button
                    key={side.id}
                    type="button"
                    onClick={() => setActiveCategory(side.id)}
                    className={`sidebar-menu-btn ${isActive ? 'active' : ''}`}
                    title={`Switch to ${side.name}`}
                  >
                    <div className="menu-btn-icon-box">
                      <Icon size={15} />
                    </div>
                    <span className="menu-btn-title">{side.name}</span>
                    <span className="menu-btn-count">{count}</span>
                  </button>
                );
              })}

              {/* Permanent Docs & PRD Pillar in Sidebar */}
              <div className="sidebar-menu-divider" />
              <button
                type="button"
                onClick={() => setActiveCategory('docs')}
                className={`sidebar-menu-btn ${activeCategory === 'docs' ? 'active' : ''}`}
                title="Project PRDs & Documentation Hub"
              >
                <div className="menu-btn-icon-box">
                  <FileText size={15} />
                </div>
                <span className="menu-btn-title">Docs & PRD</span>
                <span className="menu-btn-count">
                  {(() => {
                    try {
                      const saved = localStorage.getItem('collabs_docs_library_v2');
                      return saved ? JSON.parse(saved).length : 4;
                    } catch {
                      return 4;
                    }
                  })()}
                </span>
              </button>

              {currentUser && activeProject && (
                <button
                  type="button"
                  onClick={() => setIsTeamsModalOpen(true)}
                  className="sidebar-add-side-btn"
                  title="Configure project sides & team members"
                >
                  <Plus size={13} />
                  <span>Manage Sides</span>
                </button>
              )}
            </nav>

            {/* Sidebar Active Project Footer */}
            {activeProject && (
              <div className="pillars-sidebar-project-footer">
                <div className="sidebar-project-chip">
                  <span className="sidebar-project-title">{activeProject.name}</span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="minimal-main">
        {activeCategory === 'docs' ? (
          /* VIEW 1: Inside Docs & PRD Hub */
          <DocsPillarView
            onBackToOverview={() => setActiveCategory('all')}
            activeProject={activeProject}
          />
        ) : (
          /* VIEW 2: Inside the selected Category Area or All Resources directly */
          <div className="category-area-viewport">
            {/* Section Header */}
            <div className="section-heading-row">
              <div className="heading-left">
                {activeCategory && activeCategory !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setActiveCategory('all')}
                    className="category-back-btn"
                  >
                    <ChevronLeft size={16} />
                    <span>All Resources</span>
                  </button>
                )}
                <div className="category-titles-stack">
                  <h1 className="category-title">{activeCategoryObj?.name || 'All Resources'}</h1>
                  <p className="category-subtitle">{activeCategoryObj?.description || 'Browse and collaborate on project references.'}</p>
                </div>
              </div>

              <div className="heading-right">
                {/* View Mode Toggle: Gallery vs Workflow */}
                <div className="view-mode-segmented">
                  <button
                    type="button"
                    onClick={() => setCategoryMode('gallery')}
                    className={`view-mode-pill ${categoryMode === 'gallery' ? 'active' : ''}`}
                    title="Grid gallery view"
                  >
                    <LayoutGrid size={13} />
                    <span>Gallery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryMode('workflow')}
                    className={`view-mode-pill ${categoryMode === 'workflow' ? 'active' : ''}`}
                    title="Interactive workflow flow"
                  >
                    <Share2 size={13} />
                    <span>Workflow</span>
                  </button>
                </div>

                <span className="reference-counter">
                  {activeReferences.length} {activeReferences.length === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>

            {/* Render Workflow Canvas OR Gallery Grid */}
            {categoryMode === 'workflow' ? (
              <WorkflowCanvas
                category={activeCategory}
                categoryObj={activeCategoryObj}
                references={activeReferences}
                onSelectReference={(r) => setSelectedReference(r)}
                onBackToGallery={() => setCategoryMode('gallery')}
              />
            ) : (
              /* Category Grid: FIRST CARD is the Direct Upload Card! */
              <>
                <div className="three-column-grid">
                  {/* Card 1: Inline zero-friction upload card shown on page 1 */}
                  {currentPage === 1 && (
                    <DirectUploadCard
                      category={activeCategory}
                      projectSides={projectSides}
                      projectId={activeProject?.id}
                      onUploadSuccess={handleAddReference}
                      onUploadError={(errMsg) => setToast({ type: 'error', message: errMsg })}
                    />
                  )}

                  {/* Empty state prompt card when project has no items */}
                  {pagedReferences.length === 0 && (
                    <div className="empty-project-prompt-card">
                      <div className="empty-prompt-icon-box">
                        <Folder size={24} />
                      </div>
                      <h4 className="empty-prompt-title">Private Workspace</h4>
                      <p className="empty-prompt-desc">
                        {activeCategory === 'all'
                          ? `Start uploading screenshots or assets to ${activeProject?.name || 'this workspace'}. Only invited collaborators have access.`
                          : `No uploads in the "${activeCategoryObj?.name || activeCategory}" side yet.`}
                      </p>
                    </div>
                  )}

                  {/* Uploaded references in this category (up to 9 slots) */}
                  {pagedReferences.map((ref) => (
                    <MinimalCard
                      key={ref.id}
                      reference={ref}
                      onSelect={(r) => setSelectedReference(r)}
                      onDelete={handleRequestDelete}
                    />
                  ))}
                </div>

                {/* Apple Pagination Controls */}
                {totalPages > 1 && (
                  <div className="apple-pagination-bar" aria-label="Gallery pagination">
                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={14} />
                      <span>Prev</span>
                    </button>

                    <div className="pagination-pages-group">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          className={`pagination-number-pill ${currentPage === pageNum ? 'active' : ''}`}
                          onClick={() => setCurrentPage(pageNum)}
                          aria-label={`Page ${pageNum}`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      aria-label="Next page"
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
      </div>

      {/* Full-Viewport Lightbox (Images & Videos) */}
      {selectedReference && (
        <FullscreenLightbox
          reference={selectedReference}
          allCategoryReferences={activeReferences}
          onClose={() => setSelectedReference(null)}
          onSelectReference={(ref) => setSelectedReference(ref)}
          onDelete={handleRequestDelete}
        />
      )}

      {/* Delete Confirmation Modal for Images & Videos */}
      <DeleteConfirmModal
        isOpen={Boolean(itemPendingDelete)}
        item={itemPendingDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => !isDeletingMedia && setItemPendingDelete(null)}
        isDeleting={isDeletingMedia}
      />

      {/* Floating Apple Toast Notification */}
      <NotificationToast
        toast={toast}
        onClose={() => setToast(null)}
      />

      {/* Global Media Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onAddReference={handleAddReference}
        onError={(errMsg) => setToast({ type: 'error', message: errMsg })}
        defaultCategory={uploadModalCategory}
        projectSides={projectSides}
        projectId={activeProject?.id}
      />

      {/* Floating Team Chat & Q&A Widget (Phase 6 Project Scoped) */}
      {authenticatedMember && (
        <ChatWidget
          references={references}
          activeCategory={activeCategory}
          activeReference={selectedReference}
          onOpenReference={(ref) => setSelectedReference(ref)}
          onOpenDoc={() => setActiveCategory('docs')}
          activeProject={activeProject}
          currentUser={currentUser}
        />
      )}

      {/* Modern Individual User Authentication Modal (Phase 1) */}
      {!currentUser && (
        <AuthModal
          onAuthenticated={handleUserAuthenticated}
        />
      )}

      {/* Multi-Project Manager Modal (Phase 2) */}
      {currentUser && (
        <ProjectManagerModal
          isOpen={isProjectModalOpen || !activeProject}
          onClose={() => setIsProjectModalOpen(false)}
          activeProject={activeProject}
          onSelectProject={handleSelectProject}
          currentUser={currentUser}
          isMandatory={!activeProject}
        />
      )}

      {/* Project Teams & Sides Manager Modal (Phase 3) */}
      {currentUser && activeProject && (
        <TeamsManagerModal
          isOpen={isTeamsModalOpen}
          onClose={() => setIsTeamsModalOpen(false)}
          project={activeProject}
          currentUser={currentUser}
          onProjectUpdated={handleProjectUpdated}
        />
      )}

      {/* Accept Project Invitation Modal (Phase 4) */}
      {isAcceptInviteModalOpen && verifiedInvitation && (
        <AcceptInviteModal
          invitation={verifiedInvitation}
          token={pendingInviteToken}
          currentUser={currentUser}
          onAccepted={handleInvitationAccepted}
          onClose={() => {
            setIsAcceptInviteModalOpen(false);
            setVerifiedInvitation(null);
            setPendingInviteToken(null);
            window.history.replaceState({}, document.title, window.location.pathname);
          }}
          onRequireLogin={() => {
            setIsAcceptInviteModalOpen(false);
          }}
        />
      )}

      {/* Custom Switch Role Confirmation Modal (Replaces browser window.confirm alert) */}
      <SwitchRoleModal
        isOpen={isSwitchRoleModalOpen}
        member={authenticatedMember}
        onConfirmSwitch={() => {
          authService.logout();
          setAuthenticatedMember(null);
          setIsSwitchRoleModalOpen(false);
        }}
        onClose={() => setIsSwitchRoleModalOpen(false)}
      />
    </div>
  );
}
