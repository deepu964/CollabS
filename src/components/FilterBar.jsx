import React from 'react';
import { 
  SlidersHorizontal, 
  Grid, 
  List, 
  Monitor, 
  Smartphone, 
  Heart, 
  Sparkles, 
  ArrowUpDown, 
  X,
  Building2,
  ShieldCheck
} from 'lucide-react';

export default function FilterBar({
  categories,
  selectedCategory,
  onSelectCategory,
  deviceFilter,
  setDeviceFilter,
  selectedTag,
  setSelectedTag,
  allTags,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  showFavoritesOnly,
  setShowFavoritesOnly,
  totalResults,
  onResetFilters
}) {
  const isAnyFilterActive = 
    selectedCategory !== 'all' || 
    deviceFilter !== 'all' || 
    selectedTag !== '' || 
    showFavoritesOnly;

  return (
    <div className="apple-filter-hub">
      {/* Primary Category Segmented Control (Apple HIG standard) */}
      <div className="segmented-control-container">
        <div className="apple-segmented-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all' && !showFavoritesOnly}
            onClick={() => {
              setShowFavoritesOnly(false);
              onSelectCategory('all');
            }}
            className={`segment-btn ${selectedCategory === 'all' && !showFavoritesOnly ? 'active' : ''}`}
          >
            <span>All Pillars</span>
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat.id && !showFavoritesOnly}
              onClick={() => {
                setShowFavoritesOnly(false);
                onSelectCategory(cat.id);
              }}
              className={`segment-btn ${selectedCategory === cat.id && !showFavoritesOnly ? 'active' : ''}`}
            >
              <span>{cat.shortName}</span>
            </button>
          ))}

          <button
            type="button"
            role="tab"
            aria-selected={showFavoritesOnly}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`segment-btn favorites-btn ${showFavoritesOnly ? 'active' : ''}`}
          >
            <Heart size={13} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
            <span>Saved</span>
          </button>
        </div>

        {/* View Switcher: Grid vs List */}
        <div className="view-mode-toggle">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            title="Card Grid View"
            aria-label="Grid view"
          >
            <Grid size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            title="Dense List View"
            aria-label="List view"
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Secondary Bar: Device Filters, Tags & Sort Controls */}
      <div className="secondary-controls-bar">
        {/* Device Segment Pills */}
        <div className="device-pills-group">
          <button
            type="button"
            onClick={() => setDeviceFilter('all')}
            className={`device-pill ${deviceFilter === 'all' ? 'active' : ''}`}
          >
            <span>All Devices</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceFilter('Desktop')}
            className={`device-pill ${deviceFilter === 'Desktop' ? 'active' : ''}`}
          >
            <Monitor size={13} />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceFilter('Mobile')}
            className={`device-pill ${deviceFilter === 'Mobile' ? 'active' : ''}`}
          >
            <Smartphone size={13} />
            <span>Mobile</span>
          </button>
        </div>

        {/* Sort & Results Count */}
        <div className="sort-and-meta">
          <span className="results-counter">
            <strong>{totalResults}</strong> {totalResults === 1 ? 'item' : 'items'}
          </span>

          <div className="sort-dropdown-wrapper">
            <ArrowUpDown size={13} className="sort-icon" />
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="apple-select"
            >
              <option value="popular">Most Liked</option>
              <option value="newest">Newest First</option>
              <option value="discussed">Most Discussed</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>

          {isAnyFilterActive && (
            <button
              type="button"
              onClick={onResetFilters}
              className="reset-filters-btn"
              title="Reset all filters"
            >
              <span>Reset</span>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Pattern Tags Chips Bar */}
      <div className="tags-chips-wrapper">
        <div className="tags-scrollable">
          <button
            type="button"
            onClick={() => setSelectedTag('')}
            className={`tag-chip ${selectedTag === '' ? 'active' : ''}`}
          >
            All Tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
              className={`tag-chip ${selectedTag === tag ? 'active' : ''}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
