import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  Maximize2,
  Trash2,
  X,
  Loader2,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  Download,
  ChevronLeft,
  ChevronRight,
  FileCode,
  FileType,
  RefreshCw
} from 'lucide-react';
import { parseDocFile, renderMarkdown } from '../services/docParser';
import { uploadDocToCloudinary } from '../services/cloudinary';
import {
  reconcileDocs,
  saveRemoteSharedDoc,
  deleteRemoteSharedDoc,
  fetchRemoteSharedDocs
} from '../services/cloudSync';
import DeleteConfirmModal from './DeleteConfirmModal';
import NotificationToast from './NotificationToast';

const STORAGE_KEY = 'collabs_docs_library_v2';

const INITIAL_DOCS = [
  {
    id: 'doc-master-prd',
    title: 'CollabS Master PRD',
    fileName: 'CollabS-Master-PRD.md',
    format: 'md',
    uploadedAt: '12 Oct',
    fileSize: '4.2 KB',
    content: `# CollabS Master Product Requirements Document

## 1. Project Overview
CollabS is a real-time collaborative operations platform connecting wholesale enterprises, administrators, and field workers.

### The Four Pillars
- **B2B Portal:** Wholesale buyer workflows, invoice reconciliation, and contract pricing.
- **Admin Console:** Telemetry monitoring, user roles, system settings, and audit logs.
- **Driver App:** Mobile turn-by-turn routing, manifest scanning, and proof-of-delivery.
- **Docs Hub:** Centralized requirements, architecture documents, and technical PRDs.

---

## 2. Technical Stack
- **Frontend:** React 19, Vite, Vanilla CSS Design System.
- **Media Engine:** Cloudinary CDN and local Indexed storage.
- **Document Engine:** Client-side parsing via Mammoth (.docx) and Marked (.md, .txt).
`,
    html: ''
  },
  {
    id: 'doc-b2b-specs',
    title: 'B2B Wholesale Portal Specs',
    fileName: 'B2B-Wholesale-Portal.docx',
    format: 'docx',
    uploadedAt: '12 Oct',
    fileSize: '18.5 KB',
    content: `# B2B Wholesale Portal Specifications

## Scope & Functional Requirements
1. **Bulk Order Matrix:** Fast tabular data entry for hundreds of line items with real-time stock checks.
2. **Tiered Contract Pricing:** Automatic resolution of corporate discount schedules based on vendor contracts.
3. **Net Terms & Invoicing:** Split billing, purchase order matching, and automated PDF invoice generation.
`,
    html: ''
  }
];

export default function DocsPillarView({ onBackToOverview }) {
  const [docs, setDocs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved docs', e);
    }
    return INITIAL_DOCS;
  });

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docPendingDelete, setDocPendingDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  // Sync documents from global Cloudinary registry
  const syncCloudDocs = async (showToast = false) => {
    setIsSyncingCloud(true);
    try {
      const result = await reconcileDocs(docs, INITIAL_DOCS);
      if (Array.isArray(result?.docs) && result.docs.length > 0) {
        setDocs(result.docs);
        if (showToast) {
          setToast({
            type: 'success',
            message: 'Synchronized latest documents from Cloud'
          });
        }
      }
    } catch (err) {
      console.warn('[Docs] Cloud sync error:', err);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Reconcile with Cloudinary docs registry on initial mount
  useEffect(() => {
    let isMounted = true;
    reconcileDocs(docs, INITIAL_DOCS)
      .then(({ docs: reconciledDocs }) => {
        if (isMounted && Array.isArray(reconciledDocs) && reconciledDocs.length > 0) {
          setDocs(reconciledDocs);
        }
      })
      .catch((err) => console.debug('[Docs] Mount sync notice:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  // Pagination: 9 cards per page (Page 1 has 1 Upload card + 8 docs = 9 cards, Page 2+ has 9 docs)
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = docs.length <= 8 ? 1 : 1 + Math.ceil((docs.length - 8) / 9);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  const pagedDocs = currentPage === 1
    ? docs.slice(0, 8)
    : docs.slice(8 + (currentPage - 2) * 9, 8 + (currentPage - 2) * 9 + 9);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Sync docs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    } catch (e) {
      console.error('Failed to save docs', e);
    }
  }, [docs]);

  // Handle ESC key to close full-size details modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedDoc) {
        setSelectedDoc(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDoc]);

  const handleProcessFile = async (file) => {
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['docx', 'md', 'markdown', 'txt', 'pdf'];
    if (!validExts.includes(ext)) {
      const errorMsg = 'Please select a Word (.docx), Markdown (.md), Text (.txt), or PDF (.pdf) file.';
      setErrorMessage(errorMsg);
      setToast({
        type: 'error',
        message: errorMsg
      });
      return;
    }

    setIsUploading(true);
    setErrorMessage('');

    try {
      const parsed = await parseDocFile(file);
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      const d = new Date();
      const dateFormatted = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      // 1. Upload original document file to Cloudinary so it is permanently accessible across all browsers
      let cloudUrl = '';
      let cloudPublicId = '';
      try {
        const uploadRes = await uploadDocToCloudinary(file, { title: parsed.title });
        if (uploadRes?.url) {
          cloudUrl = uploadRes.url;
          cloudPublicId = uploadRes.publicId;
        }
      } catch (uploadErr) {
        console.warn('[Docs] Cloudinary doc upload fallback:', uploadErr.message);
      }

      const newDocItem = {
        id: `doc-${Date.now()}`,
        title: parsed.title,
        fileName: file.name,
        format: parsed.format,
        isPdf: Boolean(parsed.isPdf),
        fileUrl: cloudUrl || parsed.fileUrl || '',
        publicId: cloudPublicId,
        uploadedAt: dateFormatted,
        fileSize: sizeStr,
        content: parsed.rawContent,
        html: parsed.html
      };

      // 2. Persist to global Cloudinary registry for multi-user cross-browser synchronization
      saveRemoteSharedDoc(newDocItem).catch((e) =>
        console.warn('[Docs] Failed to sync new doc to cloud registry:', e)
      );

      setDocs((prev) => [newDocItem, ...prev]);
      setToast({
        type: 'success',
        message: `Added "${newDocItem.title}" to Docs successfully`
      });
    } catch (err) {
      console.error('Failed to parse doc:', err);
      const errorMsg = `Failed to process document: ${err.message || 'Unknown error'}`;
      setErrorMessage(errorMsg);
      setToast({
        type: 'error',
        message: errorMsg
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleRequestDelete = (doc, e) => {
    if (e) e.stopPropagation();
    setDocPendingDelete(doc);
  };

  const handleConfirmDeleteDoc = () => {
    if (!docPendingDelete) return;
    const target = docPendingDelete;
    setDocs((prev) => prev.filter((d) => d.id !== target.id));
    deleteRemoteSharedDoc(target.id).catch((e) =>
      console.warn('[Docs] Failed to delete doc from cloud registry:', e)
    );
    if (selectedDoc?.id === target.id) setSelectedDoc(null);
    setDocPendingDelete(null);
    setToast({
      type: 'delete',
      message: `Deleted "${target.title || target.fileName || 'Document'}" successfully`
    });
  };

  const handleCopyText = async () => {
    if (!selectedDoc?.content) return;
    try {
      await navigator.clipboard.writeText(selectedDoc.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const handleDownload = () => {
    if (!selectedDoc) return;

    if (selectedDoc.fileUrl) {
      const link = document.createElement('a');
      link.href = selectedDoc.fileUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = selectedDoc.fileName || `document.${selectedDoc.format || 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const blob = new Blob([selectedDoc.content || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const name = (selectedDoc.fileName || selectedDoc.title || 'document').replace(/\.[^/.]+$/, '');
    link.download = `${name}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getFormatBadge = (fmt) => {
    const f = (fmt || '').toLowerCase();
    if (f === 'pdf') return { label: 'PDF', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    if (f === 'docx') return { label: 'Word', bg: 'rgba(37, 99, 235, 0.15)', color: '#2563eb' };
    if (f === 'md' || f === 'markdown') return { label: 'Markdown', bg: 'rgba(147, 51, 234, 0.15)', color: '#9333ea' };
    return { label: 'Text', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
  };

  return (
    <div className="category-area-viewport">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.md,.markdown,.txt,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files && handleProcessFile(e.target.files[0])}
        disabled={isUploading}
      />

      {/* Section Header Row (Same as Admin / B2B / Driver) */}
      <div className="section-heading-row">
        <div className="heading-left">
          <button
            type="button"
            onClick={onBackToOverview}
            className="category-back-btn"
          >
            <ChevronLeft size={16} />
            <span>All Pillars</span>
          </button>
          <div className="category-titles-stack">
            <h1 className="category-title">Docs</h1>
            <p className="category-subtitle">
              Project requirements, architecture specifications, API documentation, and technical PRDs.
            </p>
          </div>
        </div>

        <div className="heading-right">
          <button
            type="button"
            onClick={() => syncCloudDocs(true)}
            className="action-icon-btn"
            title="Check for new uploaded documents from cloud"
            aria-label="Sync docs"
            disabled={isSyncingCloud}
            style={{ marginRight: '8px' }}
          >
            <RefreshCw size={13} className={isSyncingCloud ? 'spin-animation' : ''} />
          </button>
          <span className="reference-counter">
            {docs.length} {docs.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {/* 3-Column Grid Matching Exactly Admin/B2B/Driver Gallery */}
      <div className="three-column-grid">
        {/* CARD #1: Inline Direct Upload Card shown on Page 1 */}
        {currentPage === 1 && (
          <div className={`direct-upload-card ${dragActive ? 'drag-over' : ''}`}>
            <div
              className="upload-dropzone-inner"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              <div className="upload-icon-wrapper" style={{ color: '#ea580c' }}>
                {isUploading ? (
                  <Loader2 size={28} className="spin-animation" />
                ) : (
                  <UploadCloud size={28} className="upload-icon-glow" />
                )}
              </div>

              <h3 className="upload-prompt-title">
                {isUploading ? 'Converting Document...' : 'Upload to DOCS'}
              </h3>
              <p className="upload-prompt-sub">Drag &amp; drop or click to browse</p>

              <div className="upload-type-chips">
                <span className="type-chip"><FileType size={11} /> Word</span>
                <span className="type-chip"><FileCode size={11} /> Markdown</span>
                <span className="type-chip"><FileText size={11} /> PDF</span>
              </div>

              <span className="upload-engine-badge" style={{ color: '#ea580c', borderColor: 'rgba(234, 88, 12, 0.25)' }}>
                Auto Markdown Engine
              </span>

              {errorMessage && (
                <div className="staged-error-text" style={{ marginTop: '8px' }}>
                  <AlertCircle size={12} />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Following Cards: Rendered with MinimalCard structure & size! */}
        {pagedDocs.map((docItem) => {
          const badge = getFormatBadge(docItem.format);
          const cleanExcerpt = (docItem.content || '')
            .replace(/[#*`_>\[\]]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 110);

          return (
            <div
              key={docItem.id}
              className="minimal-ref-card doc-gallery-card"
              onClick={() => setSelectedDoc(docItem)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedDoc(docItem);
                }
              }}
            >
              {/* Media Frame (Simulated Document Sheet Art) */}
              <div className="card-image-frame doc-card-preview-frame">
                <div className="doc-preview-sheet">
                  {/* Document header row in mockup */}
                  <div className="preview-sheet-header">
                    <span
                      className="preview-sheet-tag"
                      style={{ color: badge.color, backgroundColor: badge.bg }}
                    >
                      {badge.label}
                    </span>
                    <span className="preview-sheet-filesize">{docItem.fileSize}</span>
                  </div>

                  {/* Document mockup content */}
                  <div className="preview-sheet-body">
                    <h4 className="preview-sheet-title">{docItem.title}</h4>
                    <p className="preview-sheet-lines">
                      {docItem.isPdf
                        ? 'PDF document with full-size interactive preview.'
                        : cleanExcerpt || 'Clean markdown requirements document.'}
                    </p>
                  </div>

                  <div className="preview-sheet-footer">
                    <span className="sheet-watermark">CollabS Docs</span>
                  </div>
                </div>

                {/* Hover overlay with Full View indicator */}
                <div className="card-hover-overlay">
                  <span className="expand-indicator">
                    <Maximize2 size={13} />
                    <span>View Details</span>
                  </span>
                </div>

                {/* Corner format tag */}
                <div className="card-corner-tags">
                  <span className="corner-tag" style={{ color: badge.color }}>
                    <FileText size={11} />
                    <span>{badge.label}</span>
                  </span>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  className="card-delete-btn"
                  title="Delete this document"
                  aria-label="Delete document"
                  onClick={(e) => handleRequestDelete(docItem, e)}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Card Caption (Same as MinimalCard) */}
              <div className="card-caption">
                <h3 className="card-caption-title">{docItem.title}</h3>
                <div className="card-caption-meta">
                  <span className="caption-domain">{docItem.fileName}</span>
                  <span className="caption-date">{docItem.uploadedAt}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Apple Pagination Controls */}
      {totalPages > 1 && (
        <div className="apple-pagination-bar" aria-label="Docs pagination">
          <button
            type="button"
            className="pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>

          <div className="pagination-pages-group">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                className={`pagination-number-pill ${currentPage === pageNum ? 'active' : ''}`}
                onClick={() => setCurrentPage(pageNum)}
                aria-label={`Page ${pageNum}`}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ======================================================================
          DETAILS PAGE / FULL SIZE MODAL (When clicking any specific card)
          ====================================================================== */}
      {selectedDoc && (
        <div
          className="fullsize-doc-overlay"
          onClick={() => setSelectedDoc(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fullsize-doc-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Details Page Header Bar */}
            <div className="fullsize-header-bar">
              <div className="fullsize-header-left">
                <button
                  type="button"
                  className="fullsize-back-btn"
                  onClick={() => setSelectedDoc(null)}
                >
                  <ChevronLeft size={16} />
                  <span>Back to Docs</span>
                </button>

                <div className="fullsize-title-wrap">
                  <h2 className="fullsize-doc-title">{selectedDoc.title}</h2>
                  <span
                    className="doc-format-pill"
                    style={{
                      backgroundColor: getFormatBadge(selectedDoc.format).bg,
                      color: getFormatBadge(selectedDoc.format).color
                    }}
                  >
                    {getFormatBadge(selectedDoc.format).label}
                  </span>
                </div>
              </div>

              <div className="fullsize-header-actions">
                {!selectedDoc.isPdf && (
                  <button
                    type="button"
                    className="fullsize-action-btn"
                    onClick={handleCopyText}
                    title="Copy full document text"
                  >
                    {copied ? <Check size={14} className="success-icon" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied' : 'Copy Text'}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="fullsize-action-btn"
                  onClick={handleDownload}
                  title="Download document file"
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  className="fullsize-action-btn delete-action"
                  onClick={(e) => handleRequestDelete(selectedDoc, e)}
                  title="Delete this document"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>

                <button
                  type="button"
                  className="fullsize-close-btn"
                  onClick={() => setSelectedDoc(null)}
                  aria-label="Close details"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Details Content Scroll Area */}
            <div className="fullsize-content-scroll">
              {selectedDoc.isPdf ? (
                <div className="fullsize-pdf-container">
                  {selectedDoc.fileUrl ? (
                    <iframe
                      src={selectedDoc.fileUrl}
                      title={selectedDoc.title}
                      className="fullsize-pdf-frame"
                    />
                  ) : (
                    <div className="pdf-fallback-box">
                      <FileText size={48} />
                      <p>PDF Document: {selectedDoc.fileName}</p>
                      <button
                        type="button"
                        className="doc-action-btn primary"
                        onClick={handleDownload}
                      >
                        Download PDF to View
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="prd-markdown-body fullsize-reader-body"
                  dangerouslySetInnerHTML={{
                    __html:
                      selectedDoc.html ||
                      (selectedDoc.content ? renderMarkdown(selectedDoc.content) : '')
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Documents */}
      <DeleteConfirmModal
        isOpen={Boolean(docPendingDelete)}
        item={docPendingDelete}
        title="Delete Document?"
        message={
          <>
            Are you sure you want to delete <strong>"{docPendingDelete?.title || docPendingDelete?.fileName}"</strong>? This will remove it from the document hub.
          </>
        }
        onConfirm={handleConfirmDeleteDoc}
        onCancel={() => setDocPendingDelete(null)}
      />

      {/* Apple Toast Notification */}
      <NotificationToast
        toast={toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
