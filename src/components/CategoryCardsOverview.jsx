import React from 'react';
import { ArrowRight, Building2, ShieldCheck, Smartphone, UploadCloud, Plus } from 'lucide-react';
import ProjectDocsSection from './ProjectDocsSection';

const ICON_MAP = {
  b2b: Building2,
  admin: ShieldCheck,
  driver: Smartphone
};

export default function CategoryCardsOverview({
  categories,
  references,
  onSelectCategory,
  onOpenUploadModal,
  darkMode = false
}) {
  return (
    <div className="cards-overview-container">
      {/* Clean, Compact Header */}
      <div className="overview-header-compact">
        <div className="overview-heading-group">
          <h1 className="overview-compact-title">Select a Pillar</h1>
          <p className="overview-compact-sub">
            Explore UI screens or contribute media to B2B, Admin, and Driver
          </p>
        </div>

        {/* Quick Upload Action Strip */}
        <div className="overview-quick-upload-strip">
          <span className="quick-upload-label">
            <UploadCloud size={14} />
            <span>Upload Media to:</span>
          </span>
          <div className="quick-upload-buttons">
            <button
              type="button"
              className="quick-upload-btn btn-b2b"
              onClick={() => onOpenUploadModal && onOpenUploadModal('b2b')}
              title="Upload image/video to B2B Portal"
            >
              <Building2 size={13} />
              <span>+ B2B</span>
            </button>
            <button
              type="button"
              className="quick-upload-btn btn-admin"
              onClick={() => onOpenUploadModal && onOpenUploadModal('admin')}
              title="Upload image/video to Admin Console"
            >
              <ShieldCheck size={13} />
              <span>+ Admin</span>
            </button>
            <button
              type="button"
              className="quick-upload-btn btn-driver"
              onClick={() => onOpenUploadModal && onOpenUploadModal('driver')}
              title="Upload image/video to Driver App"
            >
              <Smartphone size={13} />
              <span>+ Driver</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Balanced Cards Grid */}
      <div className="three-pillar-cards-grid">
        {categories.map((cat, index) => {
          const Icon = ICON_MAP[cat.id] || Building2;
          const catRefs = references.filter((r) => r.category === cat.id);
          const count = catRefs.length;
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
                    {count} {count === 1 ? 'item' : 'items'}
                  </span>

                  <div className="pillar-actions-group">
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

      {/* Directly below 3 Pillars: Project Documentation & PRD Section */}
      <ProjectDocsSection
        onQuickUploadMedia={onOpenUploadModal}
        darkMode={darkMode}
      />
    </div>
  );
}

