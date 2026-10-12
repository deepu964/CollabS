import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCode,
  FileType,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { parseDocFile, renderMarkdown } from '../services/docParser';

export default function UploadDocModal({
  isOpen,
  onClose,
  onAddDoc,
  defaultCategory = 'all'
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [docTitle, setDocTitle] = useState('');
  const [docSubtitle, setDocSubtitle] = useState('');
  const [docCategory, setDocCategory] = useState(defaultCategory);
  const [authorName, setAuthorName] = useState('Team Contributor');
  const [rawText, setRawText] = useState('');
  const [renderedPreviewHtml, setRenderedPreviewHtml] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeInputTab, setActiveInputTab] = useState('file'); // 'file' | 'paste'

  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const handleProcessFile = async (file) => {
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['docx', 'md', 'markdown', 'txt'];
    if (!validExts.includes(ext)) {
      setErrorMsg('Supported file formats are Word (.docx), Markdown (.md), and Text (.txt)');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    try {
      const parsed = await parseDocFile(file);
      setSelectedFile(file);
      if (!docTitle) {
        setDocTitle(parsed.title);
      }
      setRenderedPreviewHtml(parsed.html);
      setRawText(parsed.rawContent);
      setSuccessMsg(`Loaded "${file.name}" successfully! Formatted without raw symbols.`);
    } catch (err) {
      console.error('Failed to parse doc:', err);
      setErrorMsg(`Could not read document: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
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

  const handlePasteChange = (e) => {
    const text = e.target.value;
    setRawText(text);
    if (text.trim()) {
      const html = renderMarkdown(text);
      setRenderedPreviewHtml(html);
    } else {
      setRenderedPreviewHtml('');
    }
  };

  const handleSaveDoc = (e) => {
    e.preventDefault();
    if (!rawText.trim() && !renderedPreviewHtml.trim()) {
      setErrorMsg('Please upload a document file or paste content first.');
      return;
    }

    const finalTitle = docTitle.trim() || 'Untitled Project Document';
    const newDoc = {
      id: `doc-${Date.now()}`,
      title: finalTitle,
      subtitle: docSubtitle.trim() || 'Uploaded Project Documentation & PRD',
      category: docCategory,
      updatedAt: new Date().toISOString().split('T')[0],
      author: authorName.trim() || 'Team Contributor',
      tags: ['PRD', docCategory.toUpperCase(), 'Uploaded'],
      content: rawText,
      renderedHtml: renderedPreviewHtml,
      isCustom: true
    };

    onAddDoc(newDoc);
    onClose();
  };

  return (
    <div className="doc-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="doc-modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="doc-modal-header">
          <div className="doc-modal-header-info">
            <div className="doc-modal-icon-badge">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="doc-modal-title">Upload Project PRD & Docs</h2>
              <p className="doc-modal-subtitle">
                Upload Word (.docx), Markdown (.md), or text files. Automatically rendered in clean, readable format.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="doc-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Input Switch: Upload File vs Direct Paste */}
        <div className="doc-modal-segmented">
          <button
            type="button"
            className={`doc-segment-pill ${activeInputTab === 'file' ? 'active' : ''}`}
            onClick={() => setActiveInputTab('file')}
          >
            <UploadCloud size={14} />
            <span>Upload File (.docx / .md / .txt)</span>
          </button>
          <button
            type="button"
            className={`doc-segment-pill ${activeInputTab === 'paste' ? 'active' : ''}`}
            onClick={() => setActiveInputTab('paste')}
          >
            <FileCode size={14} />
            <span>Paste Text or Markdown</span>
          </button>
        </div>

        <form onSubmit={handleSaveDoc} className="doc-modal-form">
          {/* Main Input Area */}
          {activeInputTab === 'file' ? (
            <div
              className={`doc-dropzone ${dragActive ? 'dragover' : ''} ${selectedFile ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.md,.markdown,.txt"
                className="hidden-file-input"
                onChange={(e) => e.target.files && handleProcessFile(e.target.files[0])}
              />

              {isProcessing ? (
                <div className="dropzone-status">
                  <Loader2 size={32} className="spin-animation dropzone-icon" />
                  <p className="dropzone-primary-text">Converting Document to Clean Format...</p>
                  <p className="dropzone-secondary-text">Extracting typography and structure</p>
                </div>
              ) : selectedFile ? (
                <div className="dropzone-status">
                  <CheckCircle2 size={32} className="dropzone-icon success" />
                  <p className="dropzone-primary-text">{selectedFile.name}</p>
                  <p className="dropzone-secondary-text">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Click or drop another to replace
                  </p>
                </div>
              ) : (
                <div className="dropzone-status">
                  <div className="dropzone-icon-group">
                    <FileType size={32} />
                  </div>
                  <p className="dropzone-primary-text">
                    Drag & Drop Word (.docx), Markdown (.md), or .txt
                  </p>
                  <p className="dropzone-secondary-text">
                    or click to browse your documents
                  </p>
                  <div className="format-badges-row">
                    <span className="format-badge">Word .docx</span>
                    <span className="format-badge">Markdown .md</span>
                    <span className="format-badge">Plain Text .txt</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="doc-paste-area-wrap">
              <textarea
                className="doc-paste-textarea"
                rows={7}
                placeholder="Paste your PRD or document text/markdown here... It will automatically be rendered cleanly without symbols."
                value={rawText}
                onChange={handlePasteChange}
              />
            </div>
          )}

          {errorMsg && (
            <div className="doc-modal-alert error">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="doc-modal-alert success">
              <Sparkles size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Metadata Fields */}
          <div className="doc-meta-grid">
            <div className="doc-field-group">
              <label className="doc-field-label">Document Title</label>
              <input
                type="text"
                className="doc-field-input"
                placeholder="e.g. B2B Checkout Flow PRD"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                required
              />
            </div>

            <div className="doc-field-group">
              <label className="doc-field-label">Pillar / Category</label>
              <select
                className="doc-field-select"
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
              >
                <option value="all">System Overview & Architecture</option>
                <option value="b2b">01. B2B Wholesale Portal</option>
                <option value="admin">02. Admin Console & Operations</option>
                <option value="driver">03. Driver Mobile App</option>
              </select>
            </div>
          </div>

          <div className="doc-field-group">
            <label className="doc-field-label">Brief Subtitle / Summary (Optional)</label>
            <input
              type="text"
              className="doc-field-input"
              placeholder="e.g. Scope, architecture, and user story definitions"
              value={docSubtitle}
              onChange={(e) => setDocSubtitle(e.target.value)}
            />
          </div>

          {/* Form Actions */}
          <div className="doc-modal-actions">
            <button
              type="button"
              className="doc-btn-secondary"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="doc-btn-primary"
              disabled={isProcessing || (!rawText.trim() && !renderedPreviewHtml.trim())}
            >
              <BookOpen size={15} />
              <span>Save & View Document</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
