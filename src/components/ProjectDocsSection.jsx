import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  Copy,
  Check,
  Download,
  Trash2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { parseDocFile, renderMarkdown } from '../services/docParser';

const STORAGE_KEY_DOC = 'collabs_uploaded_user_doc_v1';

export default function ProjectDocsSection() {
  const [doc, setDoc] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DOC);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load saved doc', e);
    }
    return null;
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  // Cache active doc to local storage
  useEffect(() => {
    try {
      if (doc) {
        localStorage.setItem(STORAGE_KEY_DOC, JSON.stringify(doc));
      } else {
        localStorage.removeItem(STORAGE_KEY_DOC);
      }
    } catch (e) {
      console.error('Failed to save doc', e);
    }
  }, [doc]);

  const handleProcessFile = async (file) => {
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['docx', 'md', 'markdown', 'txt'];
    if (!validExts.includes(ext)) {
      setErrorMsg('Please upload a Word (.docx), Markdown (.md), or Text (.txt) file.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      const parsed = await parseDocFile(file);
      const newDoc = {
        title: parsed.title,
        fileName: file.name,
        format: parsed.format,
        content: parsed.rawContent,
        html: parsed.html
      };
      setDoc(newDoc);
    } catch (err) {
      console.error('Failed to parse doc:', err);
      setErrorMsg(`Could not read file: ${err.message || 'Unknown error'}`);
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

  const handleCopyText = async () => {
    if (!doc?.content) return;
    try {
      await navigator.clipboard.writeText(doc.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const handleDownload = () => {
    if (!doc?.content) return;
    const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const name = (doc.fileName || doc.title || 'document').replace(/\.[^/.]+$/, '');
    link.download = `${name}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setDoc(null);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Render HTML cleanly without raw symbols
  const renderedHtml = doc?.html || (doc?.content ? renderMarkdown(doc.content) : '');

  return (
    <section className="simple-docs-section" aria-label="Upload Docs">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.md,.markdown,.txt"
        className="hidden-file-input"
        onChange={(e) => e.target.files?.[0] && handleProcessFile(e.target.files[0])}
      />

      {/* Top Header & Actions */}
      <div className="simple-docs-header">
        <div className="simple-docs-title-group">
          <div className="simple-docs-icon">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="simple-docs-title">Upload PRD / Doc</h2>
          </div>
        </div>

        <div className="simple-docs-actions">
          <button
            type="button"
            className="simple-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            title="Upload Word (.docx), Markdown (.md), or Text (.txt)"
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="spin-animation" />
                <span>Converting...</span>
              </>
            ) : (
              <>
                <UploadCloud size={14} />
                <span>Upload File</span>
              </>
            )}
          </button>

          {doc && (
            <>
              <button
                type="button"
                className="simple-action-btn"
                onClick={handleCopyText}
                title="Copy markdown text"
              >
                {copied ? <Check size={14} className="success-icon" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                className="simple-action-btn"
                onClick={handleDownload}
                title="Download as Markdown"
              >
                <Download size={14} />
                <span>Download .md</span>
              </button>

              <button
                type="button"
                className="simple-action-btn icon-only"
                onClick={handleClear}
                title="Remove uploaded document"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline Drag & Drop Zone */}
      <div
        className={`simple-dropzone ${dragActive ? 'dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud size={20} className="dropzone-mini-icon" />
        <span className="dropzone-text">
          Drop your <strong>.docx</strong>, <strong>.md</strong>, or <strong>.txt</strong> file here to auto-convert, or <span className="dropzone-link">browse</span>
        </span>
      </div>

      {errorMsg && (
        <div className="simple-docs-error">
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Rendered Result Viewer (ONLY shows when a file is uploaded) */}
      {doc && (
        <div className="simple-docs-viewer">
          <div className="viewer-file-strip">
            <span className="viewer-file-badge">
              <FileText size={12} />
              <span>{doc.fileName || 'document.md'}</span>
            </span>
            <span className="viewer-mode-tag">Markdown View</span>
          </div>

          <div
            className="prd-markdown-body"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      )}
    </section>
  );
}
