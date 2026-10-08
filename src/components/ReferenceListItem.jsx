import React from 'react';
import { 
  Heart, 
  MessageSquare, 
  ExternalLink, 
  Monitor, 
  Smartphone, 
  Maximize2,
  ChevronRight
} from 'lucide-react';

export default function ReferenceListItem({
  reference,
  category,
  onOpenDetail,
  onToggleLike,
  isLiked
}) {
  const commentCount = reference.comments ? reference.comments.length : 0;
  const domain = reference.sourceUrl ? new URL(reference.sourceUrl).hostname.replace('www.', '') : '';

  return (
    <div 
      className="apple-list-row"
      onClick={() => onOpenDetail(reference)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onOpenDetail(reference);
        }
      }}
    >
      {/* Thumbnail */}
      <div className="list-thumb-wrapper">
        <img 
          src={reference.imageUrl} 
          alt={reference.title} 
          loading="lazy"
          className="list-thumb-img"
        />
      </div>

      {/* Main Info */}
      <div className="list-main-info">
        <div className="list-title-row">
          <h4 className="list-title">{reference.title}</h4>
          {reference.sourceUrl && (
            <a 
              href={reference.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="list-source-link"
              onClick={(e) => e.stopPropagation()}
            >
              <span>{domain}</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>
        <p className="list-desc-clamp">{reference.description}</p>
      </div>

      {/* Category & Device Badge */}
      <div className="list-pill-col">
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

      {/* Author & Date */}
      <div className="list-author-col">
        <div className="author-info">
          <img 
            src={reference.authorAvatar} 
            alt={reference.author} 
            className="author-avatar small" 
          />
          <span className="author-name">{reference.author.split(' ')[0]}</span>
        </div>
        <span className="list-date">
          {new Date(reference.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })}
        </span>
      </div>

      {/* Tags */}
      <div className="list-tags-col">
        {reference.tags?.slice(0, 2).map((tag) => (
          <span key={tag} className="card-tag">
            #{tag}
          </span>
        ))}
      </div>

      {/* Counters & Action */}
      <div className="list-actions-col" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onToggleLike(reference.id)}
          className={`card-interaction-btn like-btn ${isLiked ? 'liked' : ''}`}
        >
          <Heart 
            size={13} 
            fill={isLiked ? 'currentColor' : 'none'} 
            strokeWidth={isLiked ? 2.5 : 2}
          />
          <span>{reference.likes + (isLiked ? 1 : 0)}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenDetail(reference)}
          className="card-interaction-btn comment-btn"
        >
          <MessageSquare size={13} />
          <span>{commentCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenDetail(reference)}
          className="list-chevron-btn"
          title="Open detail"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
