import React from 'react';
import { 
  Search, 
  Plus, 
  Sun, 
  Moon, 
  Layers, 
  X,
  Users
} from 'lucide-react';

export default function Header({ 
  searchQuery, 
  setSearchQuery, 
  onOpenAddModal, 
  darkMode, 
  setDarkMode,
  teamMembers,
  selectedAuthor,
  setSelectedAuthor,
  totalCount,
  searchRef
}) {
  return (
    <header className="apple-header apple-glass">
      <div className="header-inner">
        {/* Brand / Logo */}
        <div className="brand-group">
          <div className="brand-icon">
            <Layers size={18} strokeWidth={2.2} />
          </div>
          <div className="brand-text">
            <div className="brand-title">
              <span>Collab</span>
              <span className="brand-badge">S</span>
            </div>
            <span className="brand-subtitle">Design Benchmarks</span>
          </div>
        </div>

        {/* Global Search Bar (Apple Style) */}
        <div className="search-container">
          <div className="search-input-wrapper">
            <Search size={15} className="search-icon" />
            <input 
              ref={searchRef}
              type="text" 
              placeholder="Search references, patterns, or tags..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="apple-search-input"
            />
            {searchQuery ? (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="search-clear-btn"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            ) : (
              <div className="search-shortcut">
                <kbd>⌘</kbd>
                <kbd>K</kbd>
              </div>
            )}
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="header-actions">
          {/* Team Members Filter Cluster */}
          <div className="team-cluster" title="Filter by contributor">
            <div className="team-avatars">
              {teamMembers.map((member) => {
                const isSelected = selectedAuthor === member.name;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedAuthor(isSelected ? '' : member.name)}
                    className={`team-avatar-btn ${isSelected ? 'active' : ''}`}
                    title={`${member.name} (${member.role})${isSelected ? ' - Click to reset' : ''}`}
                  >
                    <img src={member.avatar} alt={member.name} />
                  </button>
                );
              })}
            </div>
            {selectedAuthor && (
              <button 
                type="button" 
                onClick={() => setSelectedAuthor('')}
                className="author-clear-badge"
                title="Clear contributor filter"
              >
                <span>{selectedAuthor.split(' ')[0]}</span>
                <X size={11} />
              </button>
            )}
          </div>

          {/* Theme Toggle (Apple Switch) */}
          <button 
            type="button" 
            onClick={() => setDarkMode(!darkMode)}
            className="theme-toggle-btn"
            title={darkMode ? 'Switch to Light Appearance' : 'Switch to Dark Appearance'}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Add Reference Button */}
          <button 
            type="button" 
            onClick={onOpenAddModal}
            className="apple-pill-btn primary add-btn"
          >
            <Plus size={15} strokeWidth={2.4} />
            <span>New Reference</span>
          </button>
        </div>
      </div>
    </header>
  );
}
