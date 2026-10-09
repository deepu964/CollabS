import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Film,
  Check,
  X,
  Layers
} from 'lucide-react';

export default function WorkflowCanvas({
  category,
  categoryObj,
  references,
  onSelectReference,
  onBackToGallery
}) {
  const storageKey = `collabs_simple_flow_${category}`;

  // Sequence state: array of step objects:
  // [{ id, refId, label, transitionNote }]
  const [steps, setSteps] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.debug('Failed to load flow steps:', e);
    }
    // Default: initialize flow with all uploaded references in order
    return references.map((r, i) => ({
      id: `step-${r.id}`,
      refId: r.id,
      label: r.title,
      transitionNote: i < references.length - 1 ? 'Next' : ''
    }));
  });

  // State for Add Step Modal / Tray
  const [isAddingStep, setIsAddingStep] = useState(false);

  // Flow Prototype Walkthrough State (Slide by slide preview)
  const [walkthroughIndex, setWalkthroughIndex] = useState(null);

  // Drag-and-drop reorder state
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Keep references map handy
  const refMap = new Map(references.map((r) => [r.id, r]));

  // Auto-sync steps when references list changes
  useEffect(() => {
    setSteps((prevSteps) => {
      // Filter out steps whose reference was deleted
      const valid = prevSteps.filter((s) => refMap.has(s.refId));

      // If no steps exist but we have references, populate them automatically
      if (valid.length === 0 && references.length > 0) {
        return references.map((r, i) => ({
          id: `step-${r.id}`,
          refId: r.id,
          label: r.title,
          transitionNote: i < references.length - 1 ? 'Next' : ''
        }));
      }

      // Add any newly added references that aren't in the flow yet
      const existingRefIds = new Set(valid.map((s) => s.refId));
      const newlyAdded = [];
      references.forEach((r) => {
        if (!existingRefIds.has(r.id)) {
          newlyAdded.push({
            id: `step-${r.id}`,
            refId: r.id,
            label: r.title,
            transitionNote: 'Next'
          });
        }
      });

      return [...valid, ...newlyAdded];
    });
  }, [references]);

  // Persist flow steps
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(steps));
    } catch (e) {
      console.debug('Failed to save flow steps:', e);
    }
  }, [steps, storageKey]);

  // Reorder steps
  const moveStep = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const updated = [...steps];
    const [moved] = updated.splice(index, 1);
    updated.splice(target, 0, moved);
    setSteps(updated);
  };

  // Drag and drop reordering
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const updated = [...steps];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, moved);
    setDraggedIndex(index);
    setSteps(updated);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Remove a step from the workflow sequence
  const removeStep = (index) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  // Add an existing screen as a step
  const addScreenToFlow = (refId) => {
    const ref = refMap.get(refId);
    if (!ref) return;
    const newStep = {
      id: `step-${ref.id}-${Date.now()}`,
      refId: ref.id,
      label: ref.title,
      transitionNote: 'Next'
    };
    setSteps((prev) => [...prev, newStep]);
    setIsAddingStep(false);
  };

  // Update transition note between steps
  const updateTransitionNote = (index, text) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, transitionNote: text } : s))
    );
  };

  // Reset to original sequence
  const handleResetFlow = () => {
    const reset = references.map((r, i) => ({
      id: `step-${r.id}`,
      refId: r.id,
      label: r.title,
      transitionNote: i < references.length - 1 ? 'Next' : ''
    }));
    setSteps(reset);
  };

  // Available references that can be added
  const availableReferences = references;

  return (
    <div className="easy-workflow-view">
      {/* Top Header Bar */}
      <div className="easy-flow-header">
        <div className="flow-header-left">
          <button
            type="button"
            onClick={onBackToGallery}
            className="flow-back-btn"
          >
            <ArrowLeft size={15} />
            <span>Gallery</span>
          </button>

          <div className="flow-title-group">
            <h2 className="flow-main-title">{categoryObj.name} User Flow</h2>
            <span className="flow-count-tag">
              {steps.length} {steps.length === 1 ? 'step' : 'steps in workflow'}
            </span>
          </div>
        </div>

        <div className="flow-header-actions">
          {steps.length > 0 && (
            <button
              type="button"
              onClick={() => setWalkthroughIndex(0)}
              className="flow-play-btn"
              title="Play fullscreen interactive walkthrough"
            >
              <Play size={13} fill="currentColor" />
              <span>Play Flow</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetFlow}
            className="flow-action-btn"
            title="Auto-organize in order of uploads"
          >
            <RotateCcw size={13} />
            <span>Auto Order</span>
          </button>
        </div>
      </div>

      {/* Helpful Guidance Banner */}
      <div className="flow-instruction-bar">
        <span className="instruction-badge">Drag &amp; Reorder</span>
        <span className="instruction-text">
          Drag cards or use <strong>← / →</strong> arrows to set your screen journey (e.g. Auth ➔ Dashboard ➔ Action).
        </span>
      </div>

      {/* Main Workflow Horizontal Flow Pipeline */}
      {steps.length > 0 ? (
        <div className="flow-track-scroll">
          <div className="flow-track-container">
            {steps.map((step, index) => {
              const ref = refMap.get(step.refId);
              if (!ref) return null;

              const isVideo =
                ref.resourceType === 'video' ||
                Boolean(ref.imageUrl && ref.imageUrl.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i));

              const isLast = index === steps.length - 1;

              return (
                <React.Fragment key={step.id}>
                  {/* Step Card */}
                  <div
                    className={`flow-step-card ${draggedIndex === index ? 'is-dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    {/* Top Row: Step Number & Actions */}
                    <div className="step-card-header">
                      <div className="step-number-pill">
                        <span>0{index + 1}</span>
                      </div>

                      <div className="step-card-controls">
                        {/* Move Left */}
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveStep(index, -1)}
                          className="step-ctrl-btn"
                          title="Move left in flow"
                        >
                          <ChevronLeft size={14} />
                        </button>

                        {/* Move Right */}
                        <button
                          type="button"
                          disabled={index === steps.length - 1}
                          onClick={() => moveStep(index, 1)}
                          className="step-ctrl-btn"
                          title="Move right in flow"
                        >
                          <ChevronRight size={14} />
                        </button>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeStep(index)}
                          className="step-ctrl-btn delete"
                          title="Remove from workflow"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Media Preview Box */}
                    <div
                      className="step-media-box"
                      onClick={() => onSelectReference(ref)}
                      title="Click to view full screen"
                    >
                      {isVideo ? (
                        <div className="step-video-wrap">
                          <video src={ref.imageUrl} className="step-img" muted playsInline />
                          <div className="step-video-badge">
                            <Film size={12} />
                          </div>
                        </div>
                      ) : (
                        <img src={ref.imageUrl} alt={ref.title} className="step-img" />
                      )}

                      <div className="step-zoom-hint">
                        <Maximize2 size={13} />
                      </div>
                    </div>

                    {/* Step Title & Footer */}
                    <div className="step-info-body">
                      <h4 className="step-title" title={ref.title}>
                        {ref.title}
                      </h4>
                      <span className="step-type-meta">
                        {isVideo ? 'Video Screen' : 'UI Screen'}
                      </span>
                    </div>
                  </div>

                  {/* Flow Arrow Connector between steps */}
                  {!isLast && (
                    <div className="flow-connector-wrapper">
                      <div className="flow-arrow-line">
                        <span className="flow-arrow-pulse" />
                      </div>
                      <div className="flow-arrow-head">
                        <ArrowRight size={16} />
                      </div>
                      <input
                        type="text"
                        className="flow-transition-input"
                        placeholder="Action (e.g. click)"
                        value={step.transitionNote || ''}
                        onChange={(e) => updateTransitionNote(index, e.target.value)}
                        title="Click to name this transition or user action"
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Add Step Card at the end */}
            <div
              className="flow-add-step-card"
              onClick={() => setIsAddingStep(true)}
              role="button"
              tabIndex={0}
            >
              <div className="add-step-icon">
                <Plus size={22} />
              </div>
              <span className="add-step-label">Add Next Step</span>
              <span className="add-step-sub">Pick from category screens</span>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flow-empty-box">
          <Layers size={36} className="empty-flow-icon" />
          <h3>No Screens in this Flow Yet</h3>
          <p>Add screens to build your user journey step by step.</p>
          <button
            type="button"
            onClick={onBackToGallery}
            className="empty-flow-cta"
          >
            <Plus size={14} />
            <span>Upload Screens in Gallery</span>
          </button>
        </div>
      )}

      {/* Screen Selection Modal (When clicking "Add Next Step") */}
      {isAddingStep && (
        <div
          className="flow-modal-overlay"
          onClick={() => setIsAddingStep(false)}
        >
          <div
            className="flow-modal-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flow-modal-header">
              <h3>Choose a Screen for this Step</h3>
              <button
                type="button"
                onClick={() => setIsAddingStep(false)}
                className="flow-modal-close"
              >
                <X size={16} />
              </button>
            </div>

            {availableReferences.length > 0 ? (
              <div className="flow-picker-grid">
                {availableReferences.map((ref) => (
                  <div
                    key={ref.id}
                    className="flow-picker-card"
                    onClick={() => addScreenToFlow(ref.id)}
                  >
                    <div className="picker-img-frame">
                      <img src={ref.imageUrl} alt={ref.title} />
                    </div>
                    <span className="picker-title">{ref.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="picker-empty">
                <p>No screens uploaded yet. Upload a screen in the gallery first!</p>
                <button
                  type="button"
                  onClick={onBackToGallery}
                  className="empty-flow-cta"
                >
                  Go to Upload
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Interactive Walkthrough (Play Flow Mode) */}
      {walkthroughIndex !== null && steps[walkthroughIndex] && (
        <div className="walkthrough-overlay">
          {/* Top Bar */}
          <div className="walkthrough-bar">
            <div className="walkthrough-step-indicator">
              <span className="indicator-pill">
                Step {walkthroughIndex + 1} of {steps.length}
              </span>
              <span className="indicator-title">
                {refMap.get(steps[walkthroughIndex].refId)?.title}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setWalkthroughIndex(null)}
              className="walkthrough-close-btn"
              title="Exit walkthrough"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main Display Image */}
          <div className="walkthrough-viewport">
            <img
              src={refMap.get(steps[walkthroughIndex].refId)?.imageUrl}
              alt="Step"
              className="walkthrough-screen-img"
            />
          </div>

          {/* Bottom Floating Navigation Dock */}
          <div className="walkthrough-dock">
            <button
              type="button"
              disabled={walkthroughIndex === 0}
              onClick={() => setWalkthroughIndex((prev) => Math.max(0, prev - 1))}
              className="dock-nav-btn"
            >
              <ChevronLeft size={16} />
              <span>Previous Step</span>
            </button>

            <div className="dock-dots">
              {steps.map((_, idx) => (
                <span
                  key={idx}
                  onClick={() => setWalkthroughIndex(idx)}
                  className={`dock-dot ${idx === walkthroughIndex ? 'active' : ''}`}
                />
              ))}
            </div>

            <button
              type="button"
              disabled={walkthroughIndex === steps.length - 1}
              onClick={() =>
                setWalkthroughIndex((prev) => Math.min(steps.length - 1, prev + 1))
              }
              className="dock-nav-btn primary"
            >
              <span>
                {steps[walkthroughIndex]?.transitionNote
                  ? `${steps[walkthroughIndex].transitionNote} →`
                  : 'Next Step →'}
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
