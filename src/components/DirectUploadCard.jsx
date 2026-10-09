import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, X, Film, Image as ImageIcon } from 'lucide-react';
import { uploadMediaToCloudinary, isCloudinaryConfigured } from '../services/cloudinary';

export default function DirectUploadCard({ category, onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const cloudinaryReady = isCloudinaryConfigured();

  const handleFile = (file) => {
    if (!file) return;

    const fileIsVideo = file.type.startsWith('video/');
    const fileIsImage = file.type.startsWith('image/');

    if (!fileIsVideo && !fileIsImage) {
      setErrorMessage('Please select an image or video file.');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objUrl);
    setIsVideo(fileIsVideo);
    setErrorMessage('');

    // Pre-fill default title if empty
    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName);
    }
  };

  const handleClear = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setIsVideo(false);
    setTitle('');
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
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

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please choose an image or video first.');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    setUploadStatus('Uploading to Cloudinary...');

    try {
      let finalMediaUrl = '';
      let resourceType = isVideo ? 'video' : 'image';
      let publicId = '';

      if (cloudinaryReady) {
        const result = await uploadMediaToCloudinary(selectedFile, {
          category,
          title: title.trim()
        });
        finalMediaUrl = result.url;
        resourceType = result.resourceType;
        publicId = result.publicId;
      } else {
        // Fallback for offline/local base64
        setUploadStatus('Processing locally...');
        finalMediaUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      }

      setUploadStatus('Finalizing...');
      const fallbackTitle = `${category.toUpperCase()} Reference #${Math.floor(Math.random() * 900 + 100)}`;
      const finalTitle = title.trim() || fallbackTitle;

      const newRef = {
        id: publicId ? `cld-${publicId}` : `ref-${Date.now()}`,
        title: finalTitle,
        category,
        imageUrl: finalMediaUrl,
        resourceType,
        deviceType: category === 'driver' ? 'Mobile' : 'Desktop',
        createdAt: new Date().toISOString(),
        isCloudinarySource: cloudinaryReady
      };

      await onUploadSuccess(newRef);

      // Clean up after successful upload
      handleClear();
    } catch (err) {
      console.error('Direct upload failed:', err);
      setErrorMessage(err.message || 'Upload failed. Please check your network or Cloudinary preset.');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  return (
    <div className={`direct-upload-card ${dragActive ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        disabled={isUploading}
      />

      {!selectedFile ? (
        <div
          className="upload-dropzone-inner"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <div className="upload-icon-wrapper">
            <UploadCloud size={28} className="upload-icon-glow" />
          </div>
          <h3 className="upload-prompt-title">Upload to {category.toUpperCase()}</h3>
          <p className="upload-prompt-sub">Drag & drop or click to browse</p>
          <div className="upload-type-chips">
            <span className="type-chip"><ImageIcon size={11} /> Images</span>
            <span className="type-chip"><Film size={11} /> Videos</span>
          </div>
          <span className="upload-engine-badge">
            {cloudinaryReady ? 'Direct Cloudinary Upload' : 'Local Storage Mode'}
          </span>
        </div>
      ) : (
        <div className="upload-file-staged">
          <div className="staged-media-preview">
            {isVideo ? (
              <video src={previewUrl} className="staged-preview-media" autoPlay muted loop playsInline />
            ) : (
              <img src={previewUrl} alt="Upload preview" className="staged-preview-media" />
            )}
            <button
              type="button"
              className="staged-remove-btn"
              onClick={handleClear}
              disabled={isUploading}
              title="Remove and pick another file"
            >
              <X size={13} />
            </button>
            <span className="staged-type-tag">
              {isVideo ? <Film size={11} /> : <ImageIcon size={11} />}
              {isVideo ? 'Video' : 'Image'}
            </span>
          </div>

          <div className="staged-form-body">
            <input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
              className="staged-title-input"
              autoFocus
            />

            {errorMessage && (
              <div className="staged-error-text">
                <AlertCircle size={12} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="staged-action-row">
              <button
                type="button"
                className="staged-cancel-btn"
                onClick={handleClear}
                disabled={isUploading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="staged-submit-btn"
                onClick={handleSubmit}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={13} className="spin-animation" />
                    <span>{uploadStatus || 'Uploading...'}</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={14} />
                    <span>Upload Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
