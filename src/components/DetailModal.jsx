import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  Heart, 
  MessageSquare, 
  Monitor, 
  Smartphone, 
  Send, 
  Copy, 
  Check, 
  Calendar, 
  User, 
  Layers, 
  Sparkles,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

export default function DetailModal({
  reference,
  category,
  onClose,
  onToggleLike,
  isLiked,
  onAddComment,
  teamMembers,
  onCopyLink
}) {
  const [commentText, setCommentText] = useState('');
  const [activeAuthor, setActiveAuthor] = useState(teamMembers[0]?.name || 'Alex Rivera');
  const [isZoomed, setIsZoomed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!reference) return null;

  const currentAuthorObj = teamMembers.find(m => m.name === activeAuthor) || teamMembers[0];
  const domain = reference.sourceUrl ? new URL(reference.sourceUrl).hostname.replace('www.', '') : '';

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    onAddComment(reference.id, {
      author: activeAuthor,
      text: commentText.trim(),
      createdAt: new Date().toISOString()
    });

    setCommentText('');
  };

  const handleCopy = () => {
    onCopyLink(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="apple-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="apple-modal-sheet" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Window Header */}
        <div className="modal-sheet-header">
          <div className="modal-header-left">
            <span 
              className="card-category-pill"
              style={{
                backgroundColor: category?.badgeBg,
                color: category?.color,
                borderColor: category?.badgeBorder
              }}
            >
              {category?.name || 'Benchmark'}
            </span>
            <span className="card-device-pill">
              {reference.deviceType === 'Mobile' ? (
                <>
                  <Smartphone size={12} />
                  <span>Mobile UI</span>
                </>
              ) : (
                <>
                  <Monitor size={12} />
                  <span>Desktop UI</span>
                </>
              )}
            </span>
          </div>

          <div className="modal-header-actions">
            {reference.sourceUrl && (
              <a
                href={reference.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="apple-pill-btn secondary small"
                title={`Visit ${reference.sourceUrl}`}
              >
                <span>Visit {domain}</span>
                <ExternalLink size={12} />
              </a>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="apple-icon-circle-btn"
              title="Copy Reference Link"
            >
              {copied ? <Check size={14} className="accent-check" /> : <Copy size={14} />}
            </button>

            <button
              type="button"
              onClick={() => onToggleLike(reference.id)}
              className={`apple-icon-circle-btn ${isLiked ? 'liked' : ''}`}
              title={isLiked ? 'Liked' : 'Like benchmark'}
            >
              <Heart 
                size={14} 
                fill={isLiked ? 'currentColor' : 'none'} 
                strokeWidth={isLiked ? 2.5 : 2} 
              />
            </button>

            <div className="header-divider" />

            <button 
              type="button" 
              onClick={onClose}
              className="apple-icon-circle-btn close-btn"
              title="Close (Esc)"
              aria-label="Close modal"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Modal Body: Split Media & Inspector Panel */}
        <div className="modal-sheet-body">
          {/* Left / Center Visual Preview */}
          <div className="modal-media-canvas">
            <div className={`media-canvas-inner ${isZoomed ? 'zoomed' : ''}`}>
              <img 
                src={reference.imageUrl} 
                alt={reference.title} 
                className="modal-preview-img"
              />
            </div>
            <div className="media-canvas-controls">
              <button
                type="button"
                onClick={() => setIsZoomed(!isZoomed)}
                className="canvas-pill-control"
              >
                {isZoomed ? <ZoomOut size={13} /> : <ZoomIn size={13} />}
                <span>{isZoomed ? 'Fit Screen' : '100% Zoom'}</span>
              </button>
            </div>
          </div>

          {/* Right Inspector & Discussion Pane */}
          <div className="modal-inspector-pane">
            <div className="inspector-content">
              {/* Title & Description */}
              <div className="inspector-section">
                <h2 className="modal-title">{reference.title}</h2>
                <p className="modal-desc">{reference.description}</p>
              </div>

              {/* UX Spec & Design Rationale */}
              {reference.notes && (
                <div className="inspector-callout-box">
                  <div className="callout-header">
                    <Sparkles size={13} />
                    <span>Design Spec & Architectural Notes</span>
                  </div>
                  <p className="callout-body">"{reference.notes}"</p>
                </div>
              )}

              {/* Meta Grid */}
              <div className="inspector-meta-grid">
                <div className="meta-card">
                  <span className="meta-card-label">Curated By</span>
                  <div className="meta-card-value author-row">
                    <img src={reference.authorAvatar} alt={reference.author} className="author-avatar small" />
                    <span>{reference.author}</span>
                  </div>
                </div>

                <div className="meta-card">
                  <span className="meta-card-label">Date Added</span>
                  <div className="meta-card-value">
                    <Calendar size={13} className="meta-icon" />
                    <span>
                      {new Date(reference.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tags Cloud */}
              {reference.tags && reference.tags.length > 0 && (
                <div className="inspector-section">
                  <span className="section-label">Component & Feature Tags</span>
                  <div className="inspector-tags-wrap">
                    {reference.tags.map((tag) => (
                      <span key={tag} className="card-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Discussion Thread */}
              <div className="inspector-discussion-section">
                <div className="discussion-header">
                  <div className="discussion-title-group">
                    <MessageSquare size={14} />
                    <span className="section-label">Team Review & Discussion</span>
                  </div>
                  <span className="comment-count-badge">
                    {reference.comments?.length || 0}
                  </span>
                </div>

                {/* Comment List */}
                <div className="comments-stream">
                  {reference.comments && reference.comments.length > 0 ? (
                    reference.comments.map((comm) => {
                      const commAuthor = teamMembers.find(m => m.name === comm.author);
                      return (
                        <div key={comm.id} className="comment-card">
                          <div className="comment-header">
                            <div className="comment-author-group">
                              {commAuthor?.avatar ? (
                                <img src={commAuthor.avatar} alt={comm.author} className="comment-avatar" />
                              ) : (
                                <div className="comment-avatar fallback">{comm.author.charAt(0)}</div>
                              )}
                              <span className="comment-author-name">{comm.author}</span>
                            </div>
                            <span className="comment-time">
                              {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="comment-body">{comm.text}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-comments">
                      <p>No comments yet. Start the design critique below!</p>
                    </div>
                  )}
                </div>

                {/* Add Comment Form */}
                <form onSubmit={handleSubmitComment} className="add-comment-box">
                  <div className="comment-as-selector">
                    <span className="comment-as-label">Commenting as:</span>
                    <select 
                      value={activeAuthor}
                      onChange={(e) => setActiveAuthor(e.target.value)}
                      className="author-select-mini"
                    >
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name} ({m.role.split(' ')[0]})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="comment-input-row">
                    <input
                      type="text"
                      placeholder="Add an architectural observation or spec note..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="comment-text-input"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim()}
                      className="send-comment-btn"
                      title="Post comment"
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
