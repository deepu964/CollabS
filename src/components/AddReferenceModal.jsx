import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Image as ImageIcon, 
  Link2, 
  Tag, 
  Layers, 
  Monitor, 
  Smartphone, 
  Sparkles,
  Check
} from 'lucide-react';

const PRESET_IMAGES = [
  {
    name: 'Analytics Dashboard',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&auto=format&fit=crop&q=80',
    device: 'Desktop'
  },
  {
    name: 'Command Dark Table',
    url: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1200&auto=format&fit=crop&q=80',
    device: 'Desktop'
  },
  {
    name: 'Mobile Delivery Map',
    url: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&auto=format&fit=crop&q=80',
    device: 'Mobile'
  },
  {
    name: 'Mobile Finance Card',
    url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&auto=format&fit=crop&q=80',
    device: 'Mobile'
  },
  {
    name: 'Data Architecture Tree',
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
    device: 'Desktop'
  }
];

export default function AddReferenceModal({
  isOpen,
  onClose,
  onAddReference,
  categories,
  commonTags,
  teamMembers
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0]?.id || 'b2b');
  const [deviceType, setDeviceType] = useState('Desktop');
  const [sourceUrl, setSourceUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [author, setAuthor] = useState(teamMembers[0]?.name || 'Alex Rivera');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = (e) => {
    e.preventDefault();
    const trimmed = customTagInput.trim().replace(/^#/, '');
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
      setCustomTagInput('');
    }
  };

  const validate = () => {
    const errs = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (!imageUrl.trim()) errs.imageUrl = 'Image URL is required';
    if (!description.trim()) errs.description = 'Description is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const authorObj = teamMembers.find(m => m.name === author) || teamMembers[0];

    const newRef = {
      id: `ref-${Date.now()}`,
      title: title.trim(),
      category,
      deviceType,
      sourceUrl: sourceUrl.trim() || 'https://apple.com',
      imageUrl: imageUrl.trim(),
      description: description.trim(),
      notes: notes.trim(),
      tags: selectedTags.length > 0 ? selectedTags : ['UI Benchmark'],
      author: authorObj.name,
      authorAvatar: authorObj.avatar,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: []
    };

    onAddReference(newRef);
    onClose();

    // Reset fields
    setTitle('');
    setDescription('');
    setNotes('');
    setImageUrl('');
    setSourceUrl('');
    setSelectedTags([]);
  };

  return (
    <div className="apple-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="apple-modal-sheet add-modal-sheet" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-sheet-header">
          <div className="modal-header-left">
            <span className="modal-header-title">Add New Design Benchmark</span>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="apple-icon-circle-btn close-btn"
            title="Cancel (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-reference-form">
          <div className="form-scrollable-body">
            {/* Title */}
            <div className="form-group">
              <label className="apple-label">Benchmark Title *</label>
              <input
                type="text"
                placeholder="e.g. Real-Time Telemetry Surges & Fleet Dispatch"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`apple-input ${errors.title ? 'has-error' : ''}`}
              />
              {errors.title && <span className="input-error-msg">{errors.title}</span>}
            </div>

            {/* Category & Device Inset */}
            <div className="form-row-grid">
              <div className="form-group">
                <label className="apple-label">Product Pillar</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="apple-select form-control"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="apple-label">Target Form Factor</label>
                <div className="form-segmented-picker">
                  <button
                    type="button"
                    onClick={() => setDeviceType('Desktop')}
                    className={`form-segment-btn ${deviceType === 'Desktop' ? 'active' : ''}`}
                  >
                    <Monitor size={13} />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceType('Mobile')}
                    className={`form-segment-btn ${deviceType === 'Mobile' ? 'active' : ''}`}
                  >
                    <Smartphone size={13} />
                    <span>Mobile</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Image URL & Quick Presets */}
            <div className="form-group">
              <div className="label-with-hint">
                <label className="apple-label">Screenshot / Preview Image URL *</label>
                <span className="hint-pill">Direct image link</span>
              </div>
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className={`apple-input ${errors.imageUrl ? 'has-error' : ''}`}
              />
              {errors.imageUrl && <span className="input-error-msg">{errors.imageUrl}</span>}

              {/* Presets suggestions */}
              <div className="preset-suggestions">
                <span className="preset-label">Quick Sample Assets:</span>
                <div className="preset-buttons-row">
                  {PRESET_IMAGES.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setImageUrl(preset.url);
                        setDeviceType(preset.device);
                      }}
                      className="preset-pill-btn"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Source URL & Contributor */}
            <div className="form-row-grid">
              <div className="form-group">
                <label className="apple-label">Source Product URL</label>
                <input
                  type="url"
                  placeholder="https://stripe.com or https://linear.app"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="apple-input"
                />
              </div>

              <div className="form-group">
                <label className="apple-label">Curated By</label>
                <select
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="apple-select form-control"
                >
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="apple-label">Pattern Summary / Description *</label>
              <textarea
                rows={2}
                placeholder="Briefly summarize what this screen or interaction pattern achieves..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`apple-textarea ${errors.description ? 'has-error' : ''}`}
              />
              {errors.description && <span className="input-error-msg">{errors.description}</span>}
            </div>

            {/* UX Spec / Design Notes */}
            <div className="form-group">
              <label className="apple-label">Design Rationale / Architectural Spec (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. High-contrast route line with alternating white arrows ensures readability under direct sunlight..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="apple-textarea"
              />
            </div>

            {/* Tags Selection */}
            <div className="form-group">
              <label className="apple-label">Taxonomy & Feature Tags</label>
              <div className="tags-selection-cloud">
                {commonTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`tag-toggle-chip ${isSelected ? 'selected' : ''}`}
                    >
                      {isSelected && <Check size={11} />}
                      <span>#{tag}</span>
                    </button>
                  );
                })}
              </div>

              <div className="custom-tag-row">
                <input
                  type="text"
                  placeholder="Add custom tag (press Enter)"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomTag(e);
                    }
                  }}
                  className="apple-input mini"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTag}
                  className="apple-pill-btn secondary mini"
                >
                  <Plus size={12} />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="modal-form-footer">
            <button
              type="button"
              onClick={onClose}
              className="apple-pill-btn secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="apple-pill-btn primary"
            >
              <Plus size={14} />
              <span>Publish Benchmark</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
