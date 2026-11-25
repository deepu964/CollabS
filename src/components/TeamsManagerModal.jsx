import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  AlertCircle,
  Loader2,
  ChevronDown,
  UserCheck,
  Mail,
  Copy,
  RotateCcw,
  Send,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { projectService } from '../services/projectService';
import { invitationService } from '../services/invitationService';

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b'  // Slate
];

export default function TeamsManagerModal({
  isOpen,
  onClose,
  project,
  currentUser,
  onProjectUpdated = () => {}
}) {
  const [activeTab, setActiveTab] = useState('teams'); // 'teams' | 'members' | 'invitations'
  const [teams, setTeams] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create team state
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit team state
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamDesc, setEditTeamDesc] = useState('');
  const [editTeamColor, setEditTeamColor] = useState(PRESET_COLORS[0]);

  // Expanded team IDs for member accordion
  const [expandedTeamIds, setExpandedTeamIds] = useState(new Set());

  // Delete confirmation
  const [teamPendingDelete, setTeamPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Invite member form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteTeam, setInviteTeam] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);

  const isLead = Boolean(project?.leadId === currentUser?.id);

  const loadTeamsData = async () => {
    if (!project?.id) return;
    setIsLoading(true);
    setErrorMsg('');
    const res = await projectService.fetchTeams(project.id);
    setIsLoading(false);
    if (res.success) {
      setTeams(res.teams || []);
      setAllMembers(res.allMembers || []);
      if (!inviteTeam && res.teams?.length > 0) {
        setInviteTeam(res.teams[0].name);
      }
    } else {
      setErrorMsg(res.error || 'Failed to load teams.');
    }
  };

  const loadInvitationsData = async () => {
    if (!project?.id || !isLead) return;
    const res = await invitationService.fetchInvitations(project.id);
    if (res.success) {
      setInvitations(res.invitations || []);
    }
  };

  useEffect(() => {
    if (isOpen && project?.id) {
      loadTeamsData();
      loadInvitationsData();
      setIsCreatingTeam(false);
      setEditingTeam(null);
      setTeamPendingDelete(null);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, project?.id]);

  const toggleExpandTeam = (teamId) => {
    setExpandedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const handleCreateTeam = async (e) => {
    e?.preventDefault();
    if (!newTeamName.trim()) {
      setErrorMsg('Please enter a team name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const res = await projectService.createTeam(project.id, {
      name: newTeamName.trim(),
      description: newTeamDesc.trim(),
      color: newTeamColor
    });

    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg(`Team "${newTeamName.trim()}" created successfully!`);
      setNewTeamName('');
      setNewTeamDesc('');
      setIsCreatingTeam(false);
      if (res.teams && project) {
        onProjectUpdated({ ...project, teams: res.teams });
      }
      await loadTeamsData();
    } else {
      setErrorMsg(res.error || 'Failed to create team.');
    }
  };

  const handleUpdateTeam = async (e) => {
    e?.preventDefault();
    if (!editingTeam) return;

    setIsSubmitting(true);
    setErrorMsg('');

    const res = await projectService.updateTeam(project.id, editingTeam.id, {
      name: editTeamName.trim(),
      description: editTeamDesc.trim(),
      color: editTeamColor
    });

    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg('Team updated successfully.');
      setEditingTeam(null);
      if (res.teams && project) {
        onProjectUpdated({ ...project, teams: res.teams });
      }
      await loadTeamsData();
    } else {
      setErrorMsg(res.error || 'Failed to update team.');
    }
  };

  const handleDeleteTeam = async () => {
    if (!teamPendingDelete) return;

    setIsDeleting(true);
    setErrorMsg('');

    const res = await projectService.deleteTeam(project.id, teamPendingDelete.id);
    setIsDeleting(false);

    if (res.success) {
      setSuccessMsg(res.message);
      setTeamPendingDelete(null);
      if (res.teams && project) {
        onProjectUpdated({ ...project, teams: res.teams });
      }
      await loadTeamsData();
    } else {
      setErrorMsg(res.error || 'Failed to delete team.');
      setTeamPendingDelete(null);
    }
  };

  const handleReassignMember = async (memberId, newTeamName) => {
    setErrorMsg('');
    const res = await projectService.assignMemberTeam(project.id, memberId, newTeamName);
    if (res.success) {
      setSuccessMsg(`Reassigned to team "${newTeamName}".`);
      await loadTeamsData();
    } else {
      setErrorMsg(res.error || 'Failed to reassign member.');
    }
  };

  // Send invitation handler
  const handleSendInvitation = async (e) => {
    e?.preventDefault();
    if (!inviteEmail.trim()) {
      setErrorMsg('Please enter an email address.');
      return;
    }

    setIsSendingInvite(true);
    setErrorMsg('');
    setSuccessMsg('');

    const chosenTeam = inviteTeam || (teams.length > 0 ? teams[0].name : 'Frontend');

    const res = await invitationService.sendInvitation(project.id, {
      email: inviteEmail.trim(),
      name: inviteName.trim(),
      team: chosenTeam
    });

    setIsSendingInvite(false);

    if (res.success) {
      setSuccessMsg(`Invitation sent to ${inviteEmail.trim()}!`);
      setInviteEmail('');
      setInviteName('');
      await loadInvitationsData();
    } else {
      setErrorMsg(res.error || 'Failed to send invitation.');
    }
  };

  const handleCopyLink = (token) => {
    const origin = window.location.origin;
    const url = `${origin}/?invite=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleResend = async (invId) => {
    setErrorMsg('');
    setSuccessMsg('');
    const res = await invitationService.resendInvitation(project.id, invId);
    if (res.success) {
      setSuccessMsg(res.message);
      await loadInvitationsData();
    } else {
      setErrorMsg(res.error || 'Failed to resend invitation.');
    }
  };

  const handleRevoke = async (invId) => {
    setErrorMsg('');
    setSuccessMsg('');
    const res = await invitationService.revokeInvitation(project.id, invId);
    if (res.success) {
      setSuccessMsg(res.message);
      await loadInvitationsData();
    } else {
      setErrorMsg(res.error || 'Failed to revoke invitation.');
    }
  };

  if (!isOpen || !project) return null;

  const pendingInvitations = invitations.filter((i) => i.computedStatus === 'pending');
  const pastInvitations = invitations.filter((i) => i.computedStatus !== 'pending');

  return (
    <div className="collabs-auth-gate-backdrop">
      <div className="collabs-auth-gate-card project-modal-card teams-modal-card">
        {/* Header */}
        <div className="project-modal-header">
          <div className="project-modal-brand-row">
            <div className="auth-brand-pill">
              <span className="auth-brand-text">{project.name}</span>
            </div>
            <button
              type="button"
              className="project-modal-close-btn"
              onClick={onClose}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
          <h2 className="project-modal-title">Teams & Collaborators</h2>
          <p className="project-modal-subtitle">
            Manage custom teams, member assignments, and email invitations for this project.
          </p>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="auth-mode-segmented-tabs">
          <button
            type="button"
            className={`auth-segment-tab ${activeTab === 'teams' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('teams');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            <Users size={13} style={{ display: 'inline', marginRight: 4 }} />
            Teams ({teams.length})
          </button>
          <button
            type="button"
            className={`auth-segment-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('members');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            <UserCheck size={13} style={{ display: 'inline', marginRight: 4 }} />
            Members ({allMembers.length})
          </button>
          {isLead && (
            <button
              type="button"
              className={`auth-segment-tab ${activeTab === 'invitations' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('invitations');
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              <Mail size={13} style={{ display: 'inline', marginRight: 4 }} />
              Invitations ({pendingInvitations.length})
            </button>
          )}
        </div>

        {/* Error / Success Banners */}
        {errorMsg && (
          <div className="auth-error-banner" role="alert" style={{ marginBottom: 12 }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-success-banner" role="status" style={{ marginBottom: 12 }}>
            <Check size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: TEAMS LIST & MANAGEMENT */}
        {activeTab === 'teams' && (
          <div className="teams-tab-container">
            {isLead && !isCreatingTeam && !editingTeam && (
              <button
                type="button"
                className="add-team-trigger-btn"
                onClick={() => {
                  setIsCreatingTeam(true);
                  setErrorMsg('');
                }}
              >
                <Plus size={14} />
                <span>Create New Team / Side</span>
              </button>
            )}

            {isCreatingTeam && (
              <form className="inline-team-form" onSubmit={handleCreateTeam}>
                <div className="inline-form-header">
                  <h4>Create New Team</h4>
                  <button
                    type="button"
                    className="inline-close-btn"
                    onClick={() => setIsCreatingTeam(false)}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="auth-input-group">
                  <label htmlFor="team-name-input">Team Name:</label>
                  <input
                    id="team-name-input"
                    type="text"
                    className="auth-text-field"
                    placeholder="e.g. Mobile, QA, Logistics, Design..."
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="auth-input-group">
                  <label htmlFor="team-desc-input">Description (Optional):</label>
                  <input
                    id="team-desc-input"
                    type="text"
                    className="auth-text-field"
                    placeholder="Short description of this side's responsibilities"
                    value={newTeamDesc}
                    onChange={(e) => setNewTeamDesc(e.target.value)}
                  />
                </div>

                <div className="inline-form-actions">
                  <button
                    type="button"
                    className="switch-modal-cancel-btn"
                    onClick={() => setIsCreatingTeam(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="auth-submit-btn modern-submit"
                    style={{ flex: 1, margin: 0 }}
                  >
                    {isSubmitting ? <Loader2 size={14} className="spinner-icon" /> : 'Create Team'}
                  </button>
                </div>
              </form>
            )}

            {editingTeam && (
              <form className="inline-team-form" onSubmit={handleUpdateTeam}>
                <div className="inline-form-header">
                  <h4>Edit Team</h4>
                  <button
                    type="button"
                    className="inline-close-btn"
                    onClick={() => setEditingTeam(null)}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="auth-input-group">
                  <label htmlFor="edit-team-name-input">Team Name:</label>
                  <input
                    id="edit-team-name-input"
                    type="text"
                    className="auth-text-field"
                    value={editTeamName}
                    onChange={(e) => setEditTeamName(e.target.value)}
                    required
                  />
                </div>

                <div className="auth-input-group">
                  <label htmlFor="edit-team-desc-input">Description:</label>
                  <input
                    id="edit-team-desc-input"
                    type="text"
                    className="auth-text-field"
                    value={editTeamDesc}
                    onChange={(e) => setEditTeamDesc(e.target.value)}
                  />
                </div>

                <div className="inline-form-actions">
                  <button
                    type="button"
                    className="switch-modal-cancel-btn"
                    onClick={() => setEditingTeam(null)}
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

            {isLoading ? (
              <div className="project-loading-box">
                <Loader2 size={24} className="spinner-icon" />
                <span>Loading teams...</span>
              </div>
            ) : teams.length === 0 ? (
              <div className="project-empty-state">
                <p>No teams found in this project. Create one to get started.</p>
              </div>
            ) : (
              <div className="teams-accordion-list">
                {teams.map((t) => {
                  const isExpanded = expandedTeamIds.has(t.id);
                  const assigned = t.members || [];

                  return (
                    <div key={t.id} className="team-accordion-item">
                      <div className="team-item-header" onClick={() => toggleExpandTeam(t.id)}>
                        <div className="team-item-left">
                          <div className="team-title-stack">
                            <span className="team-name">{t.name}</span>
                            {t.description && (
                              <span className="team-desc">{t.description}</span>
                            )}
                          </div>
                        </div>

                        <div className="team-item-right" onClick={(e) => e.stopPropagation()}>
                          <span className="team-members-count-badge">
                            <Users size={11} />
                            <span>{assigned.length} {assigned.length === 1 ? 'member' : 'members'}</span>
                          </span>

                          {isLead && (
                            <div className="team-lead-action-btns">
                              <button
                                type="button"
                                className="project-action-small-btn"
                                title="Edit team"
                                onClick={() => {
                                  setEditingTeam(t);
                                  setEditTeamName(t.name);
                                  setEditTeamDesc(t.description || '');
                                  setEditTeamColor(t.color || PRESET_COLORS[0]);
                                }}
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                type="button"
                                className="project-action-small-btn delete"
                                title="Delete team"
                                onClick={() => setTeamPendingDelete(t)}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            className="team-chevron-btn"
                            onClick={() => toggleExpandTeam(t.id)}
                          >
                            <ChevronDown
                              size={15}
                              className={`chevron-icon ${isExpanded ? 'rotated' : ''}`}
                            />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="team-expanded-body">
                          {assigned.length === 0 ? (
                            <div className="team-empty-members-note">
                              <span>No members currently assigned to this team.</span>
                            </div>
                          ) : (
                            <div className="team-members-chips-list">
                              {assigned.map((m) => (
                                <div key={m.userId || m.email} className="team-member-chip">
                                  <span className="member-avatar-seed">
                                    {m.name?.charAt(0) || 'U'}
                                  </span>
                                  <div className="member-chip-info">
                                    <span className="member-chip-name">{m.name}</span>
                                    <span className="member-chip-role">{m.role || 'Member'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MEMBERS & TEAM ASSIGNMENT */}
        {activeTab === 'members' && (
          <div className="members-tab-container">
            <div className="members-list-table">
              {allMembers.map((m) => {
                const isMemberLead = m.role === 'Project Lead' || m.userId === project.leadId;

                return (
                  <div key={m.userId || m.email} className="member-row-item">
                    <div className="member-row-info">
                      <div className="member-row-avatar">
                        {m.name?.charAt(0) || 'U'}
                      </div>
                      <div className="member-row-details">
                        <div className="member-row-name-line">
                          <span className="member-name">{m.name}</span>
                          {isMemberLead && (
                            <span className="lead-tag">
                              <ShieldCheck size={10} />
                              Project Lead
                            </span>
                          )}
                        </div>
                        <span className="member-email">{m.email}</span>
                      </div>
                    </div>

                    <div className="member-row-team-select">
                      {isLead ? (
                        <select
                          className="team-select-dropdown"
                          value={m.team || ''}
                          onChange={(e) => handleReassignMember(m.userId, e.target.value)}
                        >
                          {teams.map((t) => (
                            <option key={t.id} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="team-readonly-badge">{m.team || 'Unassigned'}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: INVITATIONS & EMAIL DISPATCH (Lead Only) */}
        {activeTab === 'invitations' && isLead && (
          <div className="invitations-tab-container">
            {/* Invite Form */}
            <form className="inline-team-form" onSubmit={handleSendInvitation}>
              <div className="inline-form-header">
                <h4>Invite New Collaborator</h4>
              </div>

              <div className="invite-form-grid">
                <div className="auth-input-group">
                  <label htmlFor="invite-email-input">
                    <Mail size={12} />
                    <span>Member Email Address:</span>
                  </label>
                  <input
                    id="invite-email-input"
                    type="email"
                    className="auth-text-field"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="auth-input-group">
                  <label htmlFor="invite-name-input">
                    <span>Name (Optional):</span>
                  </label>
                  <input
                    id="invite-name-input"
                    type="text"
                    className="auth-text-field"
                    placeholder="e.g. Sarah"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </div>

                <div className="auth-input-group">
                  <label htmlFor="invite-team-select">
                    <Users size={12} />
                    <span>Assigned Team:</span>
                  </label>
                  <select
                    id="invite-team-select"
                    className="auth-text-field"
                    value={inviteTeam}
                    onChange={(e) => setInviteTeam(e.target.value)}
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingInvite}
                className="auth-submit-btn modern-submit"
                style={{ marginTop: 4 }}
              >
                {isSendingInvite ? (
                  <>
                    <Loader2 size={14} className="spinner-icon" />
                    <span>Creating Invitation...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Send Invitation</span>
                  </>
                )}
              </button>
            </form>

            {/* Pending Invitations Section */}
            <div className="invitations-list-section">
              <h4 className="invitations-section-heading">
                Pending Invitations ({pendingInvitations.length})
              </h4>

              {pendingInvitations.length === 0 ? (
                <div className="team-empty-members-note">
                  <span>No pending invitations for this project.</span>
                </div>
              ) : (
                <div className="invitations-cards-list">
                  {pendingInvitations.map((inv) => (
                    <div key={inv.id} className="invitation-item-card">
                      <div className="inv-card-left">
                        <div className="inv-email-row">
                          <span className="inv-email">{inv.email}</span>
                          <span className="team-readonly-badge">{inv.team}</span>
                        </div>
                        <div className="inv-meta-row">
                          <Clock size={11} />
                          <span>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="inv-card-actions">
                        <button
                          type="button"
                          className="project-action-small-btn"
                          title="Copy invitation link"
                          onClick={() => handleCopyLink(inv.token)}
                        >
                          {copiedToken === inv.token ? (
                            <>
                              <Check size={12} color="#22c55e" />
                              <span style={{ color: '#22c55e' }}>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="project-action-small-btn"
                          title="Resend / Renew invitation"
                          onClick={() => handleResend(inv.id)}
                        >
                          <RotateCcw size={12} />
                          <span>Resend</span>
                        </button>
                        <button
                          type="button"
                          className="project-action-small-btn delete"
                          title="Revoke invitation"
                          onClick={() => handleRevoke(inv.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History Section (Accepted / Expired) */}
            {pastInvitations.length > 0 && (
              <div className="invitations-list-section past">
                <h4 className="invitations-section-heading">
                  Completed & Past Invitations ({pastInvitations.length})
                </h4>
                <div className="invitations-cards-list">
                  {pastInvitations.map((inv) => (
                    <div key={inv.id} className="invitation-item-card past">
                      <div className="inv-card-left">
                        <div className="inv-email-row">
                          <span className="inv-email">{inv.email}</span>
                          <span className={`inv-status-pill ${inv.computedStatus}`}>
                            {inv.computedStatus}
                          </span>
                        </div>
                        <span className="inv-meta-text">
                          Team: {inv.team} • {inv.computedStatus === 'accepted' ? 'Accepted' : 'Expired'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Team Confirmation Modal */}
        {teamPendingDelete && (
          <div className="nested-confirm-overlay">
            <div className="nested-confirm-card">
              <div className="confirm-icon-box delete">
                <Trash2 size={20} color="#ef4444" />
              </div>
              <h4>Delete Team?</h4>
              <p>
                Are you sure you want to delete team <strong>"{teamPendingDelete.name}"</strong>?
              </p>
              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="switch-modal-cancel-btn"
                  onClick={() => setTeamPendingDelete(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="switch-modal-confirm-btn"
                  onClick={handleDeleteTeam}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 size={14} className="spinner-icon" /> : 'Delete Team'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
