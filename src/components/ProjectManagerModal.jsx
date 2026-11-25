import React, { useState, useEffect } from 'react';
import {
  FolderPlus,
  FolderGit2,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Check,
  ChevronRight,
  ShieldCheck,
  Trash2,
  Edit3,
  Loader2,
  AlertCircle,
  X,
  Users,
  Layers,
  ArrowRight
} from 'lucide-react';
import { projectService } from '../services/projectService';

const PRESET_COLORS = [
  '#3b82f6', // Electric Blue
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4'  // Cyan
];

export default function ProjectManagerModal({
  isOpen,
  onClose,
  activeProject,
  onSelectProject,
  currentUser,
  isMandatory = false
}) {
  const [tab, setTab] = useState('list'); // 'list' | 'create'
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sides, setSides] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editingProject, setEditingProject] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);

  // Delete confirmation
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Password prompt for locked projects
  const [passwordPromptProject, setPasswordPromptProject] = useState(null);
  const [projectPasswordInput, setProjectPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Load projects
  const loadProjects = async () => {
    setIsLoading(true);
    setErrorMsg('');
    const res = await projectService.fetchProjects();
    setIsLoading(false);
    if (res.success) {
      setProjects(res.projects);
      if (res.projects.length === 0) {
        setTab('create');
      }
    } else {
      setErrorMsg(res.error || 'Failed to load projects.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProjects();
      setEditingProject(null);
      setProjectToDelete(null);
      setPasswordPromptProject(null);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  const handleCreateProject = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a project name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const res = await projectService.createProject({
      name: name.trim(),
      description: description.trim(),
      password: password.trim() || undefined,
      color: selectedColor,
      sides: sides.trim() || undefined
    });

    setIsSubmitting(false);

    if (res.success && res.project) {
      setSuccessMsg(`Project "${res.project.name}" created successfully!`);
      setName('');
      setDescription('');
      setSides('');
      setPassword('');
      await loadProjects();
      setTimeout(() => {
        onSelectProject(res.project);
        setTab('list');
      }, 500);
    } else {
      setErrorMsg(res.error || 'Failed to create project.');
    }
  };

  const handleUpdateProject = async (e) => {
    e?.preventDefault();
    if (!editingProject) return;

    setIsSubmitting(true);
    setErrorMsg('');

    const res = await projectService.updateProject(editingProject.id, {
      name: editName.trim(),
      description: editDescription.trim(),
      color: editColor
    });

    setIsSubmitting(false);

    if (res.success && res.project) {
      setSuccessMsg('Project updated successfully.');
      setEditingProject(null);
      await loadProjects();
      if (activeProject?.id === res.project.id) {
        onSelectProject(res.project);
      }
    } else {
      setErrorMsg(res.error || 'Failed to update project.');
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    setErrorMsg('');

    const res = await projectService.deleteProject(projectToDelete.id);
    setIsDeleting(false);

    if (res.success) {
      setProjectToDelete(null);
      await loadProjects();
      if (activeProject?.id === projectToDelete.id) {
        onSelectProject(null);
      }
    } else {
      setErrorMsg(res.error || 'Failed to delete project.');
    }
  };

  const handleSelectWithPasswordCheck = (proj) => {
    if (proj.hasPassword && proj.leadId !== currentUser?.id) {
      setPasswordPromptProject(proj);
      setProjectPasswordInput('');
      setPasswordError('');
      return;
    }
    onSelectProject(proj);
  };

  const handleVerifyProjectPassword = async (e) => {
    e?.preventDefault();
    if (!passwordPromptProject) return;

    setIsSubmitting(true);
    setPasswordError('');

    const res = await projectService.verifyPassword(
      passwordPromptProject.id,
      projectPasswordInput
    );

    setIsSubmitting(false);

    if (res.success) {
      const target = passwordPromptProject;
      setPasswordPromptProject(null);
      onSelectProject(target);
    } else {
      setPasswordError(res.error || 'Incorrect password.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="collabs-auth-gate-backdrop">
      <div className="collabs-auth-gate-card project-modal-card">
        {/* Header */}
        <div className="project-modal-header">
          <div className="project-modal-brand-row">
            <h2 className="project-modal-title">CollabS Workspace</h2>
            {!isMandatory && (
              <button
                type="button"
                className="project-modal-close-btn"
                onClick={onClose}
                title="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Segmented Tab Switcher (when not editing) */}
        {!editingProject && (
          <div className="auth-mode-segmented-tabs">
            <button
              type="button"
              className={`auth-segment-tab ${tab === 'list' ? 'active' : ''}`}
              onClick={() => {
                setTab('list');
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              My Workspaces ({projects.length})
            </button>
            <button
              type="button"
              className={`auth-segment-tab ${tab === 'create' ? 'active' : ''}`}
              onClick={() => {
                setTab('create');
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              <Plus size={13} style={{ display: 'inline', marginRight: 4 }} />
              New
            </button>
          </div>
        )}

        {/* Global Error & Success alerts */}
        {errorMsg && (
          <div className="auth-error-banner" role="alert" style={{ marginBottom: 14 }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-success-banner" role="status" style={{ marginBottom: 14 }}>
            <Check size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* VIEW 1: PROJECTS LIST */}
        {tab === 'list' && !editingProject && (
          <div className="project-list-container">
            {isLoading ? (
              <div className="project-loading-box">
                <Loader2 size={24} className="spinner-icon" />
                <span>Loading your projects...</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="project-empty-state">
                <div className="empty-icon-circle">
                  <FolderGit2 size={28} />
                </div>
                <h3>No Projects Yet</h3>
                <p>Create your first project to collaborate with teams and manage workflows.</p>
                <button
                  type="button"
                  className="auth-submit-btn modern-submit"
                  onClick={() => setTab('create')}
                >
                  <Plus size={15} />
                  <span>Create Your First Project</span>
                </button>
              </div>
            ) : (
              <div className="projects-grid">
                {projects.map((proj) => {
                  const isActive = activeProject?.id === proj.id;
                  const isLead = proj.leadId === currentUser?.id;

                  return (
                    <div
                      key={proj.id}
                      className={`project-card-item ${isActive ? 'active' : ''}`}
                      style={{ '--project-accent': proj.color || '#3b82f6' }}
                    >
                      <div className="project-card-main" onClick={() => handleSelectWithPasswordCheck(proj)}>
                        <div className="project-card-icon" style={{ backgroundColor: proj.color || '#3b82f6' }}>
                          <Layers size={18} color="#ffffff" />
                        </div>
                        <div className="project-card-info">
                          <div className="project-card-title-row">
                            <span className="project-card-name">{proj.name}</span>
                            {proj.hasPassword && (
                              <span className="project-locked-pill" title="Protected by password">
                                <Lock size={10} />
                              </span>
                            )}
                            {isActive && (
                              <span className="project-active-badge">Active</span>
                            )}
                          </div>
                          {proj.description && (
                            <p className="project-card-desc">{proj.description}</p>
                          )}
                          <div className="project-card-meta">
                            <span className="meta-badge lead">
                              <ShieldCheck size={11} />
                              {isLead ? 'You (Project Lead)' : proj.leadName || 'Lead'}
                            </span>
                            <span className="meta-badge members">
                              <Users size={11} />
                              {proj.members?.length || 1} {proj.members?.length === 1 ? 'member' : 'members'}
                            </span>
                          </div>
                        </div>
                        <div className="project-card-action">
                          <ChevronRight size={16} className="project-arrow-icon" />
                        </div>
                      </div>

                      {/* Lead Controls */}
                      {isLead && (
                        <div className="project-card-footer-actions">
                          <button
                            type="button"
                            className="project-action-small-btn"
                            title="Edit project details"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProject(proj);
                              setEditName(proj.name);
                              setEditDescription(proj.description || '');
                              setEditColor(proj.color || PRESET_COLORS[0]);
                            }}
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="project-action-small-btn delete"
                            title="Delete project"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(proj);
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: CREATE PROJECT FORM */}
        {tab === 'create' && !editingProject && (
          <form className="auth-pin-form modern-form" onSubmit={handleCreateProject}>
            <div className="auth-input-group">
              <label htmlFor="create-proj-name">
                <FolderPlus size={13} />
                <span>Project Name:</span>
              </label>
              <input
                id="create-proj-name"
                type="text"
                className="auth-text-field"
                placeholder="e.g. E-Commerce Platform, Mobile App..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="auth-input-group">
              <label htmlFor="create-proj-desc">
                <span>Description (Optional):</span>
              </label>
              <input
                id="create-proj-desc"
                type="text"
                className="auth-text-field"
                placeholder="Short description of workspace goals..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="auth-input-group">
              <label htmlFor="create-proj-sides">
                <span>Project Sides / Pillars (Optional):</span>
              </label>
              <input
                id="create-proj-sides"
                type="text"
                className="auth-text-field"
                placeholder="e.g. Client App, Admin Portal, Marketing (comma-separated)"
                value={sides}
                onChange={(e) => setSides(e.target.value)}
              />
            </div>

            {/* Accent Color Picker */}
            <div className="auth-input-group">
              <label>
                <span>Project Color Theme:</span>
              </label>
              <div className="project-color-picker">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-dot-btn ${selectedColor === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setSelectedColor(c)}
                    aria-label={`Select color ${c}`}
                  >
                    {selectedColor === c && <Check size={12} color="#ffffff" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Project Password */}
            <div className="auth-input-group">
              <div className="auth-label-row">
                <label htmlFor="create-proj-pass">
                  <Lock size={13} />
                  <span>Project Access Password (Optional):</span>
                </label>
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                id="create-proj-pass"
                type={showPassword ? 'text' : 'password'}
                className="auth-text-field"
                placeholder="Leave blank for open team access"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="auth-submit-btn modern-submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spinner-icon" />
                  <span>Creating Workspace...</span>
                </>
              ) : (
                <>
                  <span>Create Workspace</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* VIEW 3: EDIT PROJECT FORM */}
        {editingProject && (
          <form className="auth-pin-form modern-form" onSubmit={handleUpdateProject}>
            <div className="auth-input-group">
              <label htmlFor="edit-proj-name">
                <Edit3 size={13} />
                <span>Project Name:</span>
              </label>
              <input
                id="edit-proj-name"
                type="text"
                className="auth-text-field"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="auth-input-group">
              <label htmlFor="edit-proj-desc">
                <span>Description:</span>
              </label>
              <textarea
                id="edit-proj-desc"
                className="auth-text-field project-textarea"
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div className="auth-input-group">
              <label>
                <span>Theme Accent:</span>
              </label>
              <div className="project-color-picker">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-dot-btn ${editColor === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setEditColor(c)}
                  >
                    {editColor === c && <Check size={12} color="#ffffff" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="project-form-actions-row">
              <button
                type="button"
                className="switch-modal-cancel-btn"
                onClick={() => setEditingProject(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="auth-submit-btn modern-submit"
                style={{ flex: 1, margin: 0 }}
              >
                {isSubmitting ? <Loader2 size={14} className="spinner-icon" /> : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Delete Confirmation Modal Overlay */}
        {projectToDelete && (
          <div className="nested-confirm-overlay">
            <div className="nested-confirm-card">
              <div className="confirm-icon-box delete">
                <Trash2 size={20} color="#ef4444" />
              </div>
              <h4>Delete Project?</h4>
              <p>
                Are you sure you want to delete <strong>"{projectToDelete.name}"</strong>? This will permanently remove all teams, references, and documents inside this project.
              </p>
              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="switch-modal-cancel-btn"
                  onClick={() => setProjectToDelete(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="switch-modal-confirm-btn"
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 size={14} className="spinner-icon" /> : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Prompt Modal Overlay */}
        {passwordPromptProject && (
          <div className="nested-confirm-overlay">
            <form className="nested-confirm-card" onSubmit={handleVerifyProjectPassword}>
              <div className="confirm-icon-box lock">
                <Lock size={20} color="#3b82f6" />
              </div>
              <h4>Project Password Protected</h4>
              <p>Enter the password for <strong>"{passwordPromptProject.name}"</strong> to access this workspace.</p>
              {passwordError && (
                <div className="auth-error-banner" style={{ width: '100%', marginBottom: 8 }}>
                  <AlertCircle size={13} />
                  <span>{passwordError}</span>
                </div>
              )}
              <input
                type="password"
                className="auth-text-field"
                placeholder="Enter project password"
                value={projectPasswordInput}
                onChange={(e) => setProjectPasswordInput(e.target.value)}
                autoFocus
                required
              />
              <div className="confirm-modal-actions" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="switch-modal-cancel-btn"
                  onClick={() => setPasswordPromptProject(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="auth-submit-btn modern-submit"
                  style={{ flex: 1, margin: 0 }}
                >
                  {isSubmitting ? <Loader2 size={14} className="spinner-icon" /> : 'Unlock & Open'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
