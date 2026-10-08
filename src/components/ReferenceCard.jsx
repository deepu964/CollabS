import React from 'react';
import { 
  Heart, 
  MessageSquare, 
  ExternalLink, 
  Monitor, 
  Smartphone, 
  Maximize2,
  Share2
} from 'lucide-react';

export default function ReferenceCard({
  reference,
  category,
  onOpenDetail,
  onToggleLike,
  isLiked,
  onCopyLink
}) {
  const commentCount = reference.comments ? reference.comments.length : 0;
  const domain = reference.sourceUrl ? new URL(reference.sourceUrl).hostname.replace('www.', '') : '';

  return (
    <article 
      className="apple-reference-card"
      onClick={() => onOpenDetail(reference)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onOpenDetail(reference);
        }
      }}
    >
      {/* Image Preview & Hover Actions */}
      <div className="card-media-wrapper">
        <img 
          src={reference.imageUrl} 
          alt={reference.title} 
          loading="lazy"
          className="card-media-img"
        />

        {/* Floating Category & Device Pills */}
        <div className="card-floating-badges">
          {category && (
            <span 
              className="card-category-pill"
              style={{
                backgroundColor: category.badgeBg,
                color: category.color,
                borderColor: category.badgeBorder
              }}
            >
              {category.shortName}
            </span>
          )}
          <span className="card-device-pill">
            {reference.deviceType === 'Mobile' ? (
              <>
                <Smartphone size={11} />
                <span>Mobile</span>
              </>
            ) : (
              <>
                <Monitor size={11} />
                <span>Desktop</span>
              </>
            )}
          </span>
        </div>

        {/* Subtle Quick Actions Overlay on Hover */}
        <div className="card-media-overlay" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onOpenDetail(reference)}
            className="overlay-action-btn"
            title="Inspect Details"
          >
            <Maximize2 size={13} />
            <span>Quick Look</span>
          </button>
          {reference.sourceUrl && (
            <a
              href={reference.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="overlay-action-btn external"
              title={`Visit ${domain}`}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={13} />
              <span>{domain}</span>
            </a>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="card-content-area">
        <div className="card-header-meta">
          <div className="author-info">
            <img 
              src={reference.authorAvatar} 
              alt={reference.author} 
              className="author-avatar"
            />
            <span className="author-name">{reference.author}</span>
          </div>
          <span className="card-date">
            {new Date(reference.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            })}
          </span>
        </div>

        <h4 className="card-title" title={reference.title}>
          {reference.title}
        </h4>

        <p className="card-description">
          {reference.description}
        </p>

        {/* Design Note Callout (Apple Quote Style) */}
        {reference.notes && (
          <div className="card-notes-callout">
            <span className="notes-label">UX Spec:</span>
            <p className="notes-text">"{reference.notes}"</p>
          </div>
        )}

        {/* Tags */}
        <div className="card-tags-list">
          {reference.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="card-tag">
              #{tag}
            </span>
          ))}
          {reference.tags?.length > 3 && (
            <span className="card-tag more">
              +{reference.tags.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="card-footer" onClick={(e) => e.stopPropagation()}>
        <div className="footer-left-actions">
          <button
            type="button"
            onClick={() => onToggleLike(reference.id)}
            className={`card-interaction-btn like-btn ${isLiked ? 'liked' : ''}`}
            title={isLiked ? 'Unlike' : 'Save reference'}
          >
            <Heart 
              size={14} 
              fill={isLiked ? 'currentColor' : 'none'} 
              strokeWidth={isLiked ? 2.5 : 2}
            />
            <span>{reference.likes + (isLiked ? 1 : 0)}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDetail(reference)}
            className="card-interaction-btn comment-btn"
            title="View discussion thread"
          >
            <MessageSquare size={14} strokeWidth={2} />
            <span>{commentCount}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onCopyLink(reference)}
          className="card-interaction-btn share-btn"
          title="Copy link to benchmark"
        >
          <Share2 size={13} />
        </button>
      </div>
    </article>
  );
}
