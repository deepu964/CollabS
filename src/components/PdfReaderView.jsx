import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Loader2,
  Download,
  Layers,
  FileCheck,
  Eye
} from 'lucide-react';
import { getCloudinaryPdfPageUrl } from '../services/cloudinary';

export default function PdfReaderView({ doc, onDownload }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(doc?.pageCount || 1);
  const [zoomLevel, setZoomLevel] = useState(100); // 75, 100, 125, 150, 175
  const [sizingMode, setSizingMode] = useState('fit-page'); // 'fit-page' | 'fit-width' | 'custom'
  const [viewMode, setViewMode] = useState('single'); // 'single' | 'scroll'
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [renderedPages, setRenderedPages] = useState([1]);
  const [useNativeViewer, setUseNativeViewer] = useState(false);
  const scrollContainerRef = useRef(null);

  // If pageCount in doc is updated, sync totalPages
  useEffect(() => {
    if (doc?.pageCount && doc.pageCount > totalPages) {
      setTotalPages(doc.pageCount);
    }
  }, [doc?.pageCount, totalPages]);

  // Track rendered pages for scroll mode
  useEffect(() => {
    if (viewMode === 'scroll') {
      const initialPagesCount = Math.max(totalPages, 5);
      const pages = Array.from({ length: initialPagesCount }, (_, i) => i + 1);
      setRenderedPages(pages);
    }
  }, [viewMode, totalPages]);

  const publicId = doc?.publicId || (doc?.fileUrl ? extractPublicId(doc.fileUrl) : '');
  const hasBlob = Boolean(doc?.blobUrl);

  function extractPublicId(url) {
    if (!url || typeof url !== 'string') return '';
    const match = url.match(/\/upload\/(?:v\d+\/)?([^.]+)/i);
    return match ? match[1] : '';
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setIsPageLoading(true);
      setCurrentPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    setIsPageLoading(true);
    setCurrentPage((p) => {
      const next = p + 1;
      if (next > totalPages) {
        setTotalPages(next);
      }
      return next;
    });
  };

  const handlePageImageError = (failedPage) => {
    setIsPageLoading(false);
    if (failedPage > 1 && failedPage >= totalPages) {
      // Reached end of document
      setTotalPages(failedPage - 1);
      if (currentPage >= failedPage) {
        setCurrentPage(Math.max(1, failedPage - 1));
      }
    }
  };

  const handlePageImageLoad = (loadedPage) => {
    if (loadedPage === currentPage) {
      setIsPageLoading(false);
    }
    if (loadedPage > totalPages) {
      setTotalPages(loadedPage);
    }
  };

  // Zoom handlers
  const zoomIn = () => {
    setSizingMode('custom');
    setZoomLevel((z) => Math.min(175, z + 25));
  };

  const zoomOut = () => {
    setSizingMode('custom');
    setZoomLevel((z) => Math.max(75, z - 25));
  };

  const resetZoom = () => {
    setSizingMode('fit-page');
    setZoomLevel(100);
  };

  const getPageWidth = () => {
    switch (zoomLevel) {
      case 75:
        return 680;
      case 125:
        return 1050;
      case 150:
        return 1250;
      case 175:
        return 1450;
      case 100:
      default:
        return 860;
    }
  };

  // If user selected native viewer and local blob is active
  if (useNativeViewer && hasBlob) {
    return (
      <div className="pdf-reader-wrapper">
        <div className="pdf-reader-toolbar">
          <div className="toolbar-left">
            <span className="reader-badge">Native PDF Preview</span>
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              className="pdf-tool-btn"
              onClick={() => setUseNativeViewer(false)}
            >
              <Eye size={14} />
              <span>Switch to HD Reader</span>
            </button>
          </div>
        </div>
        <div className="pdf-reader-stage">
          <iframe
            src={doc.blobUrl}
            title={doc.title || 'PDF Document'}
            className="fullsize-pdf-frame"
          />
        </div>
      </div>
    );
  }

  // Fallback if no publicId and no blobUrl
  if (!publicId && !hasBlob) {
    return (
      <div className="pdf-fallback-box">
        <FileText size={48} />
        <p>PDF Document: {doc?.fileName || 'document.pdf'}</p>
        <button
          type="button"
          className="doc-action-btn primary"
          onClick={onDownload}
        >
          <Download size={15} />
          <span>Download PDF to View</span>
        </button>
      </div>
    );
  }

  const singlePageUrl = publicId ? getCloudinaryPdfPageUrl(publicId, currentPage, 1800) : '';

  return (
    <div className="pdf-reader-wrapper">
      {/* Reader Control Bar (Sticky at Top) */}
      <div className="pdf-reader-toolbar">
        <div className="toolbar-left">
          {viewMode === 'single' ? (
            <div className="page-nav-pill">
              <button
                type="button"
                className="page-nav-arrow"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="page-counter-text">
                Page <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong>
              </span>

              <button
                type="button"
                className="page-nav-arrow"
                onClick={handleNextPage}
                title="Next page"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div className="page-nav-pill">
              <span className="page-counter-text">
                Continuous Document (<strong>{totalPages}</strong> {totalPages === 1 ? 'Page' : 'Pages'})
              </span>
            </div>
          )}

          {/* Sizing Toggles: Fit Page vs Fit Width */}
          {viewMode === 'single' && (
            <div className="mode-toggle-group">
              <button
                type="button"
                className={`mode-toggle-btn ${sizingMode === 'fit-page' ? 'active' : ''}`}
                onClick={() => setSizingMode('fit-page')}
                title="Fit entire page vertically on screen"
              >
                <Maximize2 size={13} />
                <span>Fit Page</span>
              </button>
              <button
                type="button"
                className={`mode-toggle-btn ${sizingMode === 'fit-width' ? 'active' : ''}`}
                onClick={() => {
                  setSizingMode('fit-width');
                  setZoomLevel(100);
                }}
                title="Fit to comfortable reading width"
              >
                <span>Fit Width</span>
              </button>
            </div>
          )}

          {/* View Mode: Single vs Scroll */}
          <div className="mode-toggle-group">
            <button
              type="button"
              className={`mode-toggle-btn ${viewMode === 'single' ? 'active' : ''}`}
              onClick={() => setViewMode('single')}
              title="Single page view"
            >
              <FileText size={13} />
              <span>Single</span>
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${viewMode === 'scroll' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('scroll');
                setSizingMode('fit-width');
              }}
              title="Continuous scroll view"
            >
              <Layers size={13} />
              <span>Scroll</span>
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          {/* Zoom controls */}
          <div className="zoom-controls-group">
            <button
              type="button"
              className="zoom-btn"
              onClick={zoomOut}
              disabled={zoomLevel <= 75}
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              className="zoom-label-btn"
              onClick={resetZoom}
              title="Reset zoom to Fit Page"
            >
              {sizingMode === 'fit-page' ? 'FIT' : `${zoomLevel}%`}
            </button>
            <button
              type="button"
              className="zoom-btn"
              onClick={zoomIn}
              disabled={zoomLevel >= 175}
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {hasBlob && (
            <button
              type="button"
              className="pdf-tool-btn"
              onClick={() => setUseNativeViewer(true)}
              title="Open in native browser PDF embed"
            >
              <FileCheck size={14} />
              <span>Native PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Reader Stage / Viewport (The ONLY Scroll Area) */}
      <div className="pdf-reader-stage" ref={scrollContainerRef}>
        {viewMode === 'single' ? (
          <div
            className={`pdf-single-page-container ${sizingMode === 'fit-page' ? 'is-fit-page' : ''}`}
            style={
              sizingMode === 'fit-page'
                ? { maxHeight: 'calc(90vh - 180px)', width: 'auto' }
                : { width: `${getPageWidth()}px`, maxWidth: '100%' }
            }
          >
            {isPageLoading && (
              <div className="page-loading-skeleton">
                <Loader2 size={30} className="spin-animation" />
                <span>Loading Page {currentPage}...</span>
              </div>
            )}

            {publicId ? (
              <img
                src={singlePageUrl}
                alt={`Page ${currentPage} of ${doc.title || 'document'}`}
                className={`pdf-rendered-page-image ${isPageLoading ? 'is-loading' : 'is-loaded'} ${sizingMode === 'fit-page' ? 'img-fit-page' : ''}`}
                onLoad={() => handlePageImageLoad(currentPage)}
                onError={() => handlePageImageError(currentPage)}
              />
            ) : hasBlob ? (
              <iframe
                src={doc.blobUrl}
                title={doc.title}
                className="fullsize-pdf-frame"
              />
            ) : null}

            <div className="page-sheet-footer">
              <span>{doc.fileName || doc.title} • Page {currentPage}</span>
            </div>
          </div>
        ) : (
          /* Continuous vertical scroll mode */
          <div
            className="pdf-scroll-pages-container"
            style={{ width: `${getPageWidth()}px`, maxWidth: '100%' }}
          >
            {renderedPages.map((pageNum) => (
              <div key={pageNum} className="pdf-scroll-page-card">
                <div className="scroll-page-header">
                  <span>Page {pageNum}</span>
                </div>
                {publicId ? (
                  <img
                    src={getCloudinaryPdfPageUrl(publicId, pageNum, 1800)}
                    alt={`Page ${pageNum}`}
                    className="pdf-rendered-page-image is-loaded"
                    loading="lazy"
                    onLoad={() => handlePageImageLoad(pageNum)}
                    onError={() => handlePageImageError(pageNum)}
                  />
                ) : null}
              </div>
            ))}

            {/* Load more pages button */}
            <div className="scroll-load-more-row">
              <button
                type="button"
                className="load-more-pages-btn"
                onClick={() => {
                  const last = renderedPages[renderedPages.length - 1] || 1;
                  const nextBatch = [last + 1, last + 2, last + 3, last + 4, last + 5];
                  setRenderedPages((p) => [...p, ...nextBatch]);
                  setTotalPages((t) => Math.max(t, last + 5));
                }}
              >
                <span>Load Next Pages</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
