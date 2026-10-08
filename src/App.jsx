import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import MinimalCard from './components/MinimalCard';
import FullscreenLightbox from './components/FullscreenLightbox';
import UploadModal from './components/UploadModal';
import { CATEGORIES, INITIAL_REFERENCES } from './data/initialData';
import { Plus, Sun, Moon, Layers, Building2, ShieldCheck, Smartphone } from 'lucide-react';

const STORAGE_KEY_REFS = 'collabs_minimal_refs_v1';
const STORAGE_KEY_THEME = 'collabs_theme_v1';

const ICON_MAP = {
  b2b: Building2,
  admin: ShieldCheck,
  driver: Smartphone
};

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved !== null) return JSON.parse(saved);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Active Category: default to 'b2b', or 'driver', or 'admin'
  const [activeCategory, setActiveCategory] = useState('b2b');

  // References state (persisted)
  const [references, setReferences] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REFS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load references', e);
    }
    return INITIAL_REFERENCES;
  });

  // Full-viewport Lightbox State
  const [selectedReference, setSelectedReference] = useState(null);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Synchronize Dark Theme class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
    localStorage.setItem(STORAGE_KEY_THEME, JSON.stringify(darkMode));
  }, [darkMode]);

  // Persist references to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REFS, JSON.stringify(references));
    } catch (e) {
      console.error('Failed to persist references', e);
    }
  }, [references]);

  // Filter references for the active category
  const activeReferences = useMemo(() => {
    return references.filter(r => r.category === activeCategory);
  }, [references, activeCategory]);

  const activeCategoryObj = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];
  const ActiveIcon = ICON_MAP[activeCategory] || Building2;

  // Add new reference handler
  const handleAddReference = (newRef) => {
    setReferences((prev) => [newRef, ...prev]);
    setActiveCategory(newRef.category);
  };

  return (
    <div className="minimal-app">
      {/* Top Apple Navigation Bar */}
      <header className="minimal-header">
        <div className="header-content">
          {/* Brand */}
          <div className="minimal-brand" onClick={() => setActiveCategory('b2b')}>
            <span className="brand-dot" />
            <span className="brand-name">CollabS</span>
          </div>

          {/* Central Category Segmented Control */}
          <nav className="minimal-segmented-nav" aria-label="Product Pillars">
            {CATEGORIES.map((cat) => {
              const Icon = ICON_MAP[cat.id] || Building2;
              const isActive = activeCategory === cat.id;
              const count = references.filter(r => r.category === cat.id).length;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`segmented-tab ${isActive ? 'active' : ''}`}
                >
                  <Icon size={14} className="tab-icon" />
                  <span className="tab-label">{cat.name}</span>
                  <span className="tab-count">{count}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="minimal-header-actions">
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="action-icon-btn"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="action-pill-btn"
            >
              <Plus size={14} strokeWidth={2.4} />
              <span>Upload</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Viewport */}
      <main className="minimal-main">
        {/* Category Header */}
        <div className="section-heading-row">
          <div className="heading-left">
            <h1 className="category-title">{activeCategoryObj.name}</h1>
            <p className="category-subtitle">{activeCategoryObj.description}</p>
          </div>
          <span className="reference-counter">
            {activeReferences.length} {activeReferences.length === 1 ? 'reference' : 'references'}
          </span>
        </div>

        {/* 3-per-row Visual Grid */}
        {activeReferences.length > 0 ? (
          <div className="three-column-grid">
            {activeReferences.map((ref) => (
              <MinimalCard
                key={ref.id}
                reference={ref}
                onSelect={(r) => setSelectedReference(r)}
              />
            ))}
          </div>
        ) : (
          <div className="minimal-empty-state">
            <p className="empty-message">No UI references uploaded for {activeCategoryObj.name} yet.</p>
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="empty-action-btn"
            >
              <Plus size={14} />
              <span>Upload First UI Reference</span>
            </button>
          </div>
        )}
      </main>

      {/* Full-Viewport Zoom Lightbox */}
      {selectedReference && (
        <FullscreenLightbox
          reference={selectedReference}
          allCategoryReferences={activeReferences}
          onClose={() => setSelectedReference(null)}
          onSelectReference={(ref) => setSelectedReference(ref)}
        />
      )}

      {/* Simple Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onAddReference={handleAddReference}
        defaultCategory={activeCategory}
      />
    </div>
  );
}
