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
  Cloud,
  ChevronLeft,
  RefreshCw,
  Layers,
  LayoutGrid,
  Share2,
  CheckCircle2
} from 'lucide-react';
import {
  subscribeToReferences,
  saveReferenceToFirestore,
  deleteReferenceFromFirestore,
  isFirebaseConfigured
} from './services/firebase';
import {
  isCloudinaryConfigured,
  fetchCloudinaryCategoryMedia
} from './services/cloudinary';
import {
  fetchRemoteSharedReferences,
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

  const firebaseReady = isFirebaseConfigured();
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

  // Sync from Global Cloud Registry, Cloudinary tag lists & Firestore
  const syncLatestMedia = useCallback(async () => {
    setIsRefreshing(true);
    const deletedSet = getDeletedIds();

    try {
      // 1. Fetch from Global Shared Cloud Registry (cross-browser / cross-device)
      const remoteShared = await fetchRemoteSharedReferences();
      if (Array.isArray(remoteShared)) {
        setReferences((prev) => {
          const remoteClean = remoteShared.filter(
            (item) => item && item.id && !DUMMY_IDS.has(item.id) && !deletedSet.has(item.id)
          );
          const remoteIdSet = new Set(remoteClean.map((r) => r.id));

          // Keep any unpushed local items (e.g. uploaded moments ago)
          const unpushedLocal = prev.filter(
            (l) => l && l.id && !DUMMY_IDS.has(l.id) && !deletedSet.has(l.id) && !remoteIdSet.has(l.id)
          );

          // If there are unpushed items in local state, sync them up to the cloud registry
          if (unpushedLocal.length > 0) {
            unpushedLocal.forEach((item) => {
              saveRemoteSharedReference(item).catch(() => {});
            });
          }

          return [...unpushedLocal, ...remoteClean];
        });
      }

      // 2. Also check Cloudinary tag lists if enabled in Cloudinary console
      if (cloudinaryReady) {
        for (const cat of CATEGORIES) {
          const res = await fetchCloudinaryCategoryMedia(cat.id);
          if (res.success && res.items.length > 0) {
            setReferences((prev) => {
              const existingIds = new Set(prev.map((r) => r.id));
              const newItems = res.items.filter(
                (item) => !existingIds.has(item.id) && !DUMMY_IDS.has(item.id) && !deletedSet.has(item.id)
              );
              if (newItems.length > 0) {
                // Mirror newly discovered Cloudinary items to the global cloud registry
                newItems.forEach((item) => saveRemoteSharedReference(item).catch(() => {}));
                return [...newItems, ...prev];
              }
              return prev;
            });
          }
        }
      }
    } catch (err) {
      console.warn('Sync check error:', err);
    } finally {
      const now = new Date();
      setLastUpdatedText(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setIsRefreshing(false);
    }
  }, [cloudinaryReady]);

  // Initial sync & interval polling when active
  useEffect(() => {
    syncLatestMedia();

    // Re-check whenever tab becomes visible / focused
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncLatestMedia();
      }
    };
    window.addEventListener('focus', syncLatestMedia);
    document.addEventListener('visibilitychange', handleVisibility);

    // Responsive light polling every 10 seconds while page is open
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncLatestMedia();
      }
    }, 10000);

    return () => {
      window.removeEventListener('focus', syncLatestMedia);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [syncLatestMedia]);

  // Real-time synchronization with Firestore (if configured)
  useEffect(() => {
    if (!firebaseReady) return;

    const unsubscribe = subscribeToReferences((remoteRefs) => {
      if (remoteRefs && remoteRefs.length > 0) {
        const remoteIds = new Set(remoteRefs.map((r) => r.id));
        const merged = [
          ...remoteRefs,
          ...INITIAL_REFERENCES.filter((r) => !remoteIds.has(r.id))
        ];
        setReferences(merged);
        setLastUpdatedText('just now');
      }
    });

    return () => unsubscribe();
  }, [firebaseReady]);

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
    // 1. Optimistic local update
    setReferences((prev) => [newRef, ...prev]);
    setLastUpdatedText('just now');

    // 2. Broadcast to other open browser tabs on same device
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('collabs_realtime_bus');
        channel.postMessage({ type: 'ADD_REFERENCE', reference: newRef });
        channel.close();
      } catch (err) {
        console.debug('BroadcastChannel error:', err);
      }
    }

    // 3. Immediately persist to Global Shared Cloud Registry (cross-device sync)
    try {
      await saveRemoteSharedReference(newRef);
    } catch (err) {
      console.warn('Failed to sync to cloud registry:', err);
    }

    // 4. Save to Firebase Firestore if configured
    if (firebaseReady) {
      try {
        await saveReferenceToFirestore(newRef);
      } catch (err) {
        console.error('Failed to sync reference to Firestore:', err);
      }
    }
  };

  // Handle deleting reference
  const handleDeleteReference = async (id) => {
    // 1. Mark ID as deleted in local storage to prevent phantom restore
    markIdAsDeleted(id);

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

    // 4. Delete from Global Shared Cloud Registry
    try {
      await deleteRemoteSharedReference(id);
    } catch (err) {
      console.warn('Failed to delete from cloud registry:', err);
    }

    // 5. Delete from Firebase Firestore if configured
    if (firebaseReady) {
      try {
        await deleteReferenceFromFirestore(id);
      } catch (err) {
        console.error('Failed to delete from Firestore:', err);
      }
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
              onClick={syncLatestMedia}
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

      {/* Main Content Viewport */}
      <main className="minimal-main">
        {/* VIEW 1: 3 Cards Main Page Navigation */}
        {!activeCategory ? (
          <CategoryCardsOverview
            categories={CATEGORIES}
            references={references}
            darkMode={darkMode}
            onSelectCategory={(catId) => setActiveCategory(catId)}
            onRefresh={syncLatestMedia}
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
