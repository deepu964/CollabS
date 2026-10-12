import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';
import CategoryCardsOverview from './components/CategoryCardsOverview';
import DirectUploadCard from './components/DirectUploadCard';
import MinimalCard from './components/MinimalCard';
import FullscreenLightbox from './components/FullscreenLightbox';
import WorkflowCanvas from './components/WorkflowCanvas';
import UploadModal from './components/UploadModal';
import DocsPillarView from './components/DocsPillarView';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import NotificationToast from './components/NotificationToast';
import { CATEGORIES, INITIAL_REFERENCES } from './data/initialData';
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
  Plus
} from 'lucide-react';
import {
  isCloudinaryConfigured,
  fetchAllCloudinaryMedia,
  fetchCloudinaryCategoryMedia,
  markCloudinaryAssetAsDeleted
} from './services/cloudinary';

const STORAGE_KEY_REFS = 'collabs_minimal_refs_v2';
const STORAGE_KEY_THEME = 'collabs_theme_v2';

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

            // Authoritative Cloudinary items (filtered against any deleted set)
            const validCloudItems = res.items.filter((item) => {
              if (!item || !item.id) return false;
              if (allDeletedSet.has(item.id)) return false;
              if (item.publicId && allDeletedSet.has(item.publicId)) return false;
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

    // 3. Success Toast Notification
    const catObj = CATEGORIES.find((c) => c.id === newRef.category);
    const catName = catObj?.name || newRef.category?.toUpperCase() || 'Gallery';
    setToast({
      type: 'success',
      message: `Added "${newRef.title || 'Media item'}" to ${catName} successfully`
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
          {activeCategoryObj && (
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
                let count = references.filter((r) => r.category === cat.id).length;
                if (cat.id === 'docs') {
                  try {
                    const saved = localStorage.getItem('collabs_docs_library_v2');
                    count = saved ? JSON.parse(saved).length : 0;
                  } catch {
                    count = 0;
                  }
                }

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
          )}

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
        {/* VIEW 1: 4 Cards Main Page Navigation */}
        {!activeCategory ? (
          <CategoryCardsOverview
            categories={CATEGORIES}
            references={references}
            darkMode={darkMode}
            onSelectCategory={(catId) => setActiveCategory(catId)}
            onOpenUploadModal={(catId) => {
              setUploadModalCategory(catId || 'b2b');
              setIsUploadModalOpen(true);
            }}
            onRefresh={() => syncLatestMedia({ isSilent: false })}
            isRefreshing={isRefreshing}
            lastUpdatedText={lastUpdatedText}
          />
        ) : activeCategory === 'docs' ? (
          /* VIEW 2: Inside Docs & PRD Hub */
          <DocsPillarView
            onBackToOverview={() => setActiveCategory(null)}
          />
        ) : (
          /* VIEW 3: Inside the selected Category Area */
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
              <>
                <div className="three-column-grid">
                  {/* Card 1: Inline zero-friction upload card shown on page 1 */}
                  {currentPage === 1 && (
                    <DirectUploadCard
                      category={activeCategory}
                      onUploadSuccess={handleAddReference}
                      onUploadError={(errMsg) => setToast({ type: 'error', message: errMsg })}
                    />
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

      {/* Global Media Upload Modal (B2B, Admin, Driver) */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onAddReference={handleAddReference}
        onError={(errMsg) => setToast({ type: 'error', message: errMsg })}
        defaultCategory={uploadModalCategory}
      />
    </div>
  );
}
