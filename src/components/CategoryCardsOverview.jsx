import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Building2,
  ShieldCheck,
  Smartphone,
  FileText,
  UploadCloud,
  Plus
} from 'lucide-react';

const ICON_MAP = {
  b2b: Building2,
  admin: ShieldCheck,
  driver: Smartphone,
  docs: FileText
};

export default function CategoryCardsOverview({
  categories,
  references,
  onSelectCategory,
  onOpenUploadModal,
  darkMode = false
}) {
  const [docsCount, setDocsCount] = useState(0);

  // Load count of uploaded docs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('collabs_docs_library_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setDocsCount(parsed.length);
        }
      }
    } catch (e) {
      console.debug('Failed to read docs count', e);
    }
  }, []);

  return (
    <div className="cards-overview-container">
      {/* 2 by 2 Balanced Pillar Cards Grid (4 Cards Total) */}
      <div className="four-pillar-cards-grid">
        {categories.map((cat, index) => {
          const Icon = ICON_MAP[cat.id] || Building2;
          const isDocs = cat.id === 'docs';
          const catRefs = references.filter((r) => r.category === cat.id);
          const count = isDocs ? docsCount : catRefs.length;
          const countUnit = isDocs
            ? count === 1 ? 'document' : 'documents'
            : count === 1 ? 'item' : 'items';

          const coverSrc = darkMode
            ? cat.coverDarkImage || cat.coverImage
            : cat.coverLightImage || cat.coverImage;

          return (
            <div
              key={cat.id}
              className={`pillar-main-card pillar-${cat.id}`}
              onClick={() => onSelectCategory(cat.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelectCategory(cat.id);
                }
              }}
            >
              {/* Card Media Preview */}
              <div className="pillar-card-media-wrap">
                <img
                  src={coverSrc}
                  alt={`${cat.name} Preview`}
                  className="pillar-card-img"
                  loading="eager"
                />
                <div className="pillar-card-overlay-gradient" />

                {/* Floating Category Number */}
                <div className="pillar-floating-badge">
                  <span>0{index + 1}</span>
                </div>
              </div>

              {/* Card Content Info */}
              <div className="pillar-card-info">
                <div className="pillar-card-header">
                  <div className="pillar-icon-box">
                    <Icon size={16} />
                  </div>
                  <div className="pillar-text-group">
                    <h2 className="pillar-title">{cat.name}</h2>
                    <span className="pillar-tagline">{cat.tagline || cat.fullName}</span>
                  </div>
                </div>

                <p className="pillar-description">{cat.description}</p>

                <div className="pillar-footer-row">
                  <span className="pillar-count-pill">
                    {count} {countUnit}
                  </span>

                  <div className="pillar-actions-group">
                    {!isDocs ? (
                      <button
                        type="button"
                        className="pillar-card-upload-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenUploadModal) onOpenUploadModal(cat.id);
                        }}
                        title={`Upload image/video to ${cat.name}`}
                      >
                        <Plus size={12} />
                        <span>Upload</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="pillar-card-upload-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCategory('docs');
                        }}
                        title="Upload doc or PRD"
                      >
                        <Plus size={12} />
                        <span>Upload</span>
                      </button>
                    )}

                    <span className="pillar-enter-action">
                      <span>Open {cat.name}</span>
                      <ArrowRight size={13} className="action-arrow" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
