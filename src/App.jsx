import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';
import CategoryCardsOverview from './components/CategoryCardsOverview';
import DirectUploadCard from './components/DirectUploadCard';
import MinimalCard from './components/MinimalCard';
import FullscreenLightbox from './components/FullscreenLightbox';
import WorkflowCanvas from './components/WorkflowCanvas';
import { CATEGORIES, INITIAL_REFERENCES } from './data/initialData';
import {
  Sun,
  Moon,
  Building2,
  ShieldCheck,
  Smartphone,
  ChevronLeft,
  RefreshCw,
  Layers,
  LayoutGrid,
  Share2,
  X
} from 'lucide-react';
import {
  isCloudinaryConfigured,
  fetchAllCloudinaryMedia,
  fetchCloudinaryCategoryMedia,
  markCloudinaryAssetAsDeleted
} from './services/cloudinary';
import {
  fetchRemoteSharedState,
  saveRemoteSharedReference,
  deleteRemoteSharedReference
} from './services/cloudSync';

const STORAGE_KEY_REFS = 'collabs_minimal_refs_v2';
const STORAGE_KEY_THEME = 'collabs_theme_v2';

const ICON_MAP = {
  b2b: Building2,
  admin: ShieldCheck,
  driver: Smartphone
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

  // Active Category: null = 3 Cards Main Page; 'b2b' | 'admin' | 'driver' = Category Gallery
  const [activeCategory, setActiveCategory] = useState(null);

  // Category View Mode: 'gallery' | 'workflow'
  const [categoryMode, setCategoryMode] = useState('gallery');

  // References state (cached in localStorage, synced via Cloudinary & Firestore)
  const [references, setReferences] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REFS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out dummy items
          return parsed.filter((item) => !DUMMY_IDS.has(item.id));
        }
      }
    } catch (e) {
      console.error('Failed to load cached references', e);
    }
    return INITIAL_REFERENCES;
  });

  // Lightbox State
  const [selectedReference, setSelectedReference] = useState(null);

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
        setReferences((prev) => prev.filter((r) => r.id !== targetId));
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
    try {
      const current = getDeletedIds();
      current.add(id);
      localStorage.setItem('collabs_deleted_ids_v1', JSON.stringify([...current]));
    } catch (e) {
      console.debug('Failed to cache deleted id', e);
    }
  };

  // Sync from Cloudinary and CloudSync
  const syncLatestMedia = useCallback(async ({ isSilent = false } = {}) => {
    if (!isSilent) {
      setIsRefreshing(true);
    }

    try {
      const deletedSet = getDeletedIds();

      // 1. Query Cloudinary directly for all team media (with Cloudinary deletedIds filtering)
      if (cloudinaryReady) {
        const res = await fetchAllCloudinaryMedia();
        setCloudinaryNeedsSetting(Boolean(res.requiresSetting));

        if (res.success && Array.isArray(res.items)) {
          setReferences((prev) => {
            const existingIdMap = new Map(prev.map((r) => [r.id, r]));

            // Purge deleted items
            const activePrev = prev.filter(
              (item) => item && item.id && !deletedSet.has(item.id) && !DUMMY_IDS.has(item.id)
            );

            // New items discovered from Cloudinary
            const newCloudItems = res.items.filter(
              (item) => !existingIdMap.has(item.id) && !DUMMY_IDS.has(item.id) && !deletedSet.has(item.id)
            );

            // Stable diff check: if active list length equals prev length and no new items, do NOT touch state!
            if (activePrev.length === prev.length && newCloudItems.length === 0) {
              return prev; // Prevents unnecessary re-render and flickering
            }

            return [...newCloudItems, ...activePrev];
          });
        }
      }

      // 2. Also check CloudSync state for any shared deletedIds
      try {
        const remoteState = await fetchRemoteSharedState();
        const remoteDeleted = remoteState.deletedIds || [];
        if (remoteDeleted.length > 0) {
          remoteDeleted.forEach((id) => markIdAsDeleted(id));
        }
      } catch (e) {
        console.debug('Remote state sync error:', e);
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

  // Cache references to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REFS, JSON.stringify(references));
    } catch (e) {
      console.error('Failed to cache references', e);
    }
  }, [references]);

  // Filter references for active category
  const activeReferences = useMemo(() => {
    if (!activeCategory) return [];
    return references.filter((r) => r.category === activeCategory);
  }, [references, activeCategory]);

  const activeCategoryObj = useMemo(() => {
    return CATEGORIES.find((c) => c.id === activeCategory) || null;
  }, [activeCategory]);

  // Handle adding new reference (from DirectUploadCard)
  const handleAddReference = async (newRef) => {
    // 1. Optimistic local update with unsynced marker
    const optimisticRef = { ...newRef, isLocalUnsynced: true };
    setReferences((prev) => [optimisticRef, ...prev]);
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

    // 3. Immediately persist to Global Shared Cloud Registry (cross-device/browser sync)
    try {
      const saved = await saveRemoteSharedReference(newRef);
      if (saved) {
        setReferences((prev) =>
          prev.map((r) => (r.id === newRef.id ? { ...r, isLocalUnsynced: false } : r))
        );
      }
    } catch (err) {
      console.warn('Failed to sync to cloud registry:', err);
    }
  };

  // Handle deleting reference
  const handleDeleteReference = async (id) => {
    // 1. Mark ID as deleted in local storage to prevent phantom restore
    markIdAsDeleted(id);

    // Locate reference object to obtain its Cloudinary publicId
    const targetRef = references.find((r) => r.id === id);

    // 2. Immediate local state update
    setReferences((prev) => prev.filter((r) => r.id !== id));
    if (selectedReference?.id === id) {
      setSelectedReference(null);
    }
    setLastUpdatedText('just now');

    // 3. Broadcast to other open browser tabs
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('collabs_realtime_bus');
        channel.postMessage({ type: 'DELETE_REFERENCE', id });
        channel.close();
      } catch (err) {
        console.debug('BroadcastChannel error on delete:', err);
      }
    }

    // 4. Record deletion marker on Cloudinary so EVERY OTHER BROWSER knows it is deleted!
    try {
      await markCloudinaryAssetAsDeleted(id, targetRef?.publicId);
    } catch (err) {
      console.warn('Failed to record deletion on Cloudinary:', err);
    }

    // 5. Delete from Global Shared Cloud Registry
    try {
      await deleteRemoteSharedReference(id);
    } catch (err) {
      console.warn('Failed to delete from cloud registry:', err);
    }
  };

  return (
    <div className="minimal-app">
      {/* Top Header */}
      <header className="minimal-header">
        <div className="header-content">
          {/* Brand Logo & Back to Overview */}
          <div className="minimal-brand-group">
            <button
              type="button"
              className="minimal-brand"
              onClick={() => setActiveCategory(null)}
              title="Return to Main Categories Page"
            >
              <span className="brand-dot" />
              <span className="brand-name">CollabS</span>
            </button>

            {activeCategoryObj && (
              <div className="brand-breadcrumb">
                <span className="crumb-slash">/</span>
                <span className="crumb-current">{activeCategoryObj.name}</span>
              </div>
            )}
          </div>

          {/* If inside category, show Back button + Segmented Tabs */}
          {activeCategoryObj ? (
            <nav className="minimal-segmented-nav" aria-label="Category Switcher">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className="segmented-tab back-overview-tab"
                title="Return to 3 Cards Overview"
              >
                <Layers size={13} />
                <span className="tab-label">All Pillars</span>
              </button>

              <div className="segmented-divider" />

              {CATEGORIES.map((cat) => {
                const Icon = ICON_MAP[cat.id] || Building2;
                const isActive = activeCategory === cat.id;
                const count = references.filter((r) => r.category === cat.id).length;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`segmented-tab ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={13} className="tab-icon" />
                    <span className="tab-label">{cat.name}</span>
                    <span className="tab-count">{count}</span>
                  </button>
                );
              })}
            </nav>
          ) : (
            <div className="main-nav-pill-indicator">
              <span className="pill-dot" />
              <span>3 Product Pillars</span>
            </div>
          )}

          {/* Right Header Actions */}
          <div className="minimal-header-actions">
            {/* Live Cloud Status */}
            <div
              className={`cloud-status-chip ${cloudinaryReady ? 'synced' : 'local'}`}
              title={
                cloudinaryReady
                  ? 'Cloudinary CDN active: Uploads are hosted in the cloud'
                  : 'Local Mode: Add Cloudinary keys in .env'
              }
            >
              <span className="status-dot" />
              <span className="status-label">
                {cloudinaryReady ? 'Cloudinary Live' : 'Local Mode'}
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

      {/* Main Content Viewport */}
      <main className="minimal-main">
        {/* VIEW 1: 3 Cards Main Page Navigation */}
        {!activeCategory ? (
          <CategoryCardsOverview
            categories={CATEGORIES}
            references={references}
            darkMode={darkMode}
            onSelectCategory={(catId) => setActiveCategory(catId)}
            onRefresh={() => syncLatestMedia({ isSilent: false })}
            isRefreshing={isRefreshing}
            lastUpdatedText={lastUpdatedText}
          />
        ) : (
          /* VIEW 2: Inside the selected Category Area */
          <div className="category-area-viewport">
            {/* Section Header */}
            <div className="section-heading-row">
              <div className="heading-left">
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className="category-back-btn"
                >
                  <ChevronLeft size={16} />
                  <span>All Pillars</span>
                </button>
                <div className="category-titles-stack">
                  <h1 className="category-title">{activeCategoryObj.name}</h1>
                  <p className="category-subtitle">{activeCategoryObj.description}</p>
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
              <div className="three-column-grid">
                {/* Card 1: Inline zero-friction upload card */}
                <DirectUploadCard
                  category={activeCategory}
                  onUploadSuccess={handleAddReference}
                />

                {/* Uploaded references in this category */}
                {activeReferences.map((ref) => (
                  <MinimalCard
                    key={ref.id}
                    reference={ref}
                    onSelect={(r) => setSelectedReference(r)}
                    onDelete={handleDeleteReference}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Full-Viewport Lightbox (Images & Videos) */}
      {selectedReference && (
        <FullscreenLightbox
          reference={selectedReference}
          allCategoryReferences={activeReferences}
          onClose={() => setSelectedReference(null)}
          onSelectReference={(ref) => setSelectedReference(ref)}
          onDelete={handleDeleteReference}
        />
      )}
    </div>
  );
}
