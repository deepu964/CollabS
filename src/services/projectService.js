import { authService } from './authService';

const STORAGE_KEY_ACTIVE_PROJECT = 'collabs_active_project_v2';
const STORAGE_KEY_PROJECTS_CACHE = 'collabs_projects_cache_v2';

class ProjectService {
  getActiveProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  }

  setActiveProject(project) {
    try {
      if (project) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, JSON.stringify(project));
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_PROJECT);
      }
    } catch (e) {
      console.warn('Failed to cache active project', e);
    }
  }

  clearActiveProject() {
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_PROJECT);
    } catch (e) {
      console.warn('Failed to clear active project', e);
    }
  }

  // Get auth headers
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  // Fetch all projects for the logged in user
  async fetchProjects() {
    try {
      const res = await fetch('/api/projects', {
        headers: this.getHeaders()
      });

      if (!res.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.projects)) {
        let finalProjects = data.projects;
        try {
          const cached = JSON.parse(localStorage.getItem(STORAGE_KEY_PROJECTS_CACHE) || '[]');
          const serverIds = new Set(data.projects.map((p) => p.id));
          const missing = cached.filter((p) => p && p.id && !serverIds.has(p.id));
          finalProjects = [...data.projects, ...missing];
        } catch {
          // ignore
        }
        localStorage.setItem(STORAGE_KEY_PROJECTS_CACHE, JSON.stringify(finalProjects));
        return { success: true, projects: finalProjects };
      }
      return { success: false, projects: [] };
    } catch (err) {
      console.warn('[ProjectService] Fetch projects fallback to cache:', err);
      try {
        const cached = localStorage.getItem(STORAGE_KEY_PROJECTS_CACHE);
        if (cached) {
          return { success: true, projects: JSON.parse(cached), isOffline: true };
        }
      } catch {
        // ignore
      }
      return { success: false, projects: [], error: err.message };
    }
  }

  // Create a new project
  async createProject({ name, description, password, color, coverIcon, sides }) {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, description, password, color, coverIcon, sides })
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to create project.'
        };
      }

      if (data.project) {
        try {
          const cached = JSON.parse(localStorage.getItem(STORAGE_KEY_PROJECTS_CACHE) || '[]');
          const updated = [data.project, ...cached.filter((p) => p && p.id !== data.project.id)];
          localStorage.setItem(STORAGE_KEY_PROJECTS_CACHE, JSON.stringify(updated));
        } catch {
          // ignore
        }
      }

      return {
        success: true,
        project: data.project
      };
    } catch (err) {
      console.error('[ProjectService] Create project request failed:', err);
      return {
        success: false,
        error: 'Unable to reach backend server. Please verify the server is running.'
      };
    }
  }

  // Update project details
  async updateProject(id, updates) {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updates)
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to update project.'
        };
      }

      // If updating currently active project, keep local storage in sync
      const active = this.getActiveProject();
      if (active && active.id === id) {
        this.setActiveProject(data.project);
      }

      return {
        success: true,
        project: data.project
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to update project.'
      };
    }
  }

  // Delete project
  async deleteProject(id) {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to delete project.'
        };
      }

      const active = this.getActiveProject();
      if (active && active.id === id) {
        this.clearActiveProject();
      }

      return {
        success: true,
        message: data.message
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to delete project.'
      };
    }
  }

  // Verify project password if required
  async verifyPassword(id, password) {
    try {
      const res = await fetch(`/api/projects/${id}/verify-password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Incorrect project password.'
        };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: 'Verification failed. Please try again.'
      };
    }
  }

  // ==========================================
  // PHASE 3: TEAMS & MEMBERS
  // ==========================================

  // Fetch all teams for a project
  async fetchTeams(projectId) {
    try {
      const res = await fetch(`/api/projects/${projectId}/teams`, {
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to load teams.' };
      }
      return { success: true, teams: data.teams, allMembers: data.allMembers };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to connect.' };
    }
  }

  // Create team in project
  async createTeam(projectId, { name, description, color }) {
    try {
      const res = await fetch(`/api/projects/${projectId}/teams`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, description, color })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create team.' };
      }
      return { success: true, team: data.team, teams: data.teams };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to connect.' };
    }
  }

  // Update team
  async updateTeam(projectId, teamId, { name, description, color }) {
    try {
      const res = await fetch(`/api/projects/${projectId}/teams/${teamId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, description, color })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update team.' };
      }
      return { success: true, team: data.team, teams: data.teams, members: data.members };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to connect.' };
    }
  }

  // Delete team
  async deleteTeam(projectId, teamId) {
    try {
      const res = await fetch(`/api/projects/${projectId}/teams/${teamId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to delete team.' };
      }
      return { success: true, message: data.message, teams: data.teams };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to connect.' };
    }
  }

  // Reassign member team
  async assignMemberTeam(projectId, memberId, teamName) {
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}/team`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ teamName })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to assign team.' };
      }
      return { success: true, member: data.member, members: data.members };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to connect.' };
    }
  }
}

export const projectService = new ProjectService();
export default projectService;
