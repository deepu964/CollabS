import React from 'react';
import { ExternalLink, Maximize2 } from 'lucide-react';

export default function MinimalCard({ reference, onSelect }) {
  const domain = reference.sourceUrl ? new URL(reference.sourceUrl).hostname.replace('www.', '') : '';

  return (
    <div 
      className="minimal-ref-card"
      onClick={() => onSelect(reference)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(reference);
        }
      }}
    >
      <div className="card-image-frame">
        <img 
          src={reference.imageUrl} 
          alt={reference.title} 
          loading="lazy"
          className="card-preview-image"
        />
        <div className="card-hover-overlay">
          <span className="expand-indicator">
            <Maximize2 size={14} />
            <span>Full View</span>
          </span>
        </div>
      </div>

      <div className="card-caption">
        <h3 className="card-caption-title">{reference.title}</h3>
        <div className="card-caption-meta">
          {domain && <span className="caption-domain">{domain}</span>}
          {reference.deviceType && (
            <span className="caption-device">{reference.deviceType}</span>
          )}
        </div>
      </div>
    </div>
  );
}
