import React from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Smartphone, 
  Sparkles, 
  BookmarkCheck, 
  Hash, 
  MessageSquare, 
  Users 
} from 'lucide-react';

const ICON_MAP = {
  Building2: Building2,
  ShieldCheck: ShieldCheck,
  Smartphone: Smartphone,
};

export default function HeroSection({ 
  categories, 
  selectedCategory, 
  onSelectCategory,
  stats,
  allReferences
}) {
  return (
    <section className="apple-hero-section">
      <div className="hero-intro">
        <div className="hero-eyebrow">
          <Sparkles size={13} className="eyebrow-icon" />
          <span>Product Interface Architecture & Design Benchmarks</span>
        </div>
        <h1 className="hero-title">
          Unified Experience Standards
        </h1>
        <p className="hero-subtitle">
          A centralized, peer-curated repository of benchmark patterns, interaction paradigms, and production teardowns across B2B, Admin, and Driver ecosystems.
        </p>
      </div>

      {/* Category Overview Cards */}
      <div className="category-overview-grid">
        {categories.map((cat) => {
          const IconComp = ICON_MAP[cat.icon] || Building2;
          const isSelected = selectedCategory === cat.id;
          const count = allReferences.filter(r => r.category === cat.id).length;

          return (
            <div 
              key={cat.id} 
              className={`category-feature-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectCategory(isSelected ? 'all' : cat.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelectCategory(isSelected ? 'all' : cat.id);
                }
              }}
            >
              <div className="cat-card-header">
                <div 
                  className="cat-icon-badge"
                  style={{ 
                    backgroundColor: cat.badgeBg, 
                    color: cat.color,
                    borderColor: cat.badgeBorder 
                  }}
                >
                  <IconComp size={18} strokeWidth={2} />
                </div>
                <span className="cat-count-pill">
                  {count} {count === 1 ? 'pattern' : 'patterns'}
                </span>
              </div>

              <div className="cat-card-content">
                <h3 className="cat-name">{cat.name}</h3>
                <p className="cat-description">{cat.description}</p>
              </div>

              <div className="cat-card-footer">
                <span className="cat-action-hint">
                  {isSelected ? 'Active view • Click to show all' : 'Explore benchmarks →'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subtle Apple Metric Bar */}
      <div className="metrics-strip">
        <div className="metric-item">
          <BookmarkCheck size={14} className="metric-icon" />
          <span className="metric-value">{stats.total}</span>
          <span className="metric-label">Total Benchmarks</span>
        </div>
        <div className="metric-divider" />
        <div className="metric-item">
          <Building2 size={14} className="metric-icon" />
          <span className="metric-value">3</span>
          <span className="metric-label">Product Pillars</span>
        </div>
        <div className="metric-divider" />
        <div className="metric-item">
          <Hash size={14} className="metric-icon" />
          <span className="metric-value">{stats.tagsCount}</span>
          <span className="metric-label">Pattern Tags</span>
        </div>
        <div className="metric-divider" />
        <div className="metric-item">
          <MessageSquare size={14} className="metric-icon" />
          <span className="metric-value">{stats.totalComments}</span>
          <span className="metric-label">Team Insights</span>
        </div>
        <div className="metric-divider" />
        <div className="metric-item">
          <Users size={14} className="metric-icon" />
          <span className="metric-value">{stats.contributors}</span>
          <span className="metric-label">Active Leads</span>
        </div>
      </div>
    </section>
  );
}
