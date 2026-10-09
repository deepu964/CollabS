import React from 'react';
import { ArrowRight, Building2, ShieldCheck, Smartphone } from 'lucide-react';

const ICON_MAP = {
  b2b: Building2,
  admin: ShieldCheck,
  driver: Smartphone
};

export default function CategoryCardsOverview({
  categories,
  references,
  onSelectCategory,
  darkMode = false
}) {
  return (
    <div className="cards-overview-container">
      {/* Clean, Compact Header */}
      <div className="overview-header-compact">
        <h1 className="overview-compact-title">Select a Pillar</h1>
        <p className="overview-compact-sub">Choose a category to explore UI screens or contribute new media</p>
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
                  
                  <span className="pillar-enter-action">
                    <span>Open {cat.name}</span>
                    <ArrowRight size={13} className="action-arrow" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
