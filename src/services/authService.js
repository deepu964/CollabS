/**
 * Authentication Service for CollabS Platform
 * Supports individual user registration, login with JWT tokens, session persistence,
 * and maintains backward compatibility for role-based views.
 */

const STORAGE_KEY_TOKEN = 'collabs_auth_token_v2';
const STORAGE_KEY_USER = 'collabs_auth_user_v2';
const STORAGE_KEY_LEGACY_AUTH = 'collabs_authenticated_member_v2';

export const TEAM_MEMBERS_CONFIG = [
  {
    id: 'admin',
    name: 'Admin / Lead',
    shortName: 'Admin',
    icon: 'ShieldCheck',
    badgeColor: '#f59e0b',
    description: 'System settings, telemetry & master decisions',
    defaultPin: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PIN_ADMIN) || '1001'
  },
  {
    id: 'backend',
    name: 'Backend Engineer',
    shortName: 'Backend',
    icon: 'Database',
    badgeColor: '#10b981',
    description: 'API design, database schemas & server logic',
    defaultPin: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PIN_BACKEND) || '2002'
  },
  {
    id: 'b2b',
    name: 'B2B Wholesale Client',
    shortName: 'B2B Client',
    icon: 'Building2',
    badgeColor: '#3b82f6',
    description: 'Wholesale orders, inventory & invoice flows',
    defaultPin: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PIN_B2B) || '3003'
  },
  {
    id: 'driver',
    name: 'Driver & Logistics',
    shortName: 'Driver',
    icon: 'Truck',
    badgeColor: '#ec4899',
    description: 'Delivery routes, manifest scans & proof-of-delivery',
    defaultPin: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PIN_DRIVER) || '4004'
  },
  {
    id: 'qa',
    name: 'QA & Testing Lead',
    shortName: 'QA Tester',
    icon: 'CheckCircle2',
    badgeColor: '#8b5cf6',
    description: 'Bug verification, test cases & quality audit',
    defaultPin: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PIN_QA) || '5005'
  }
];

class AuthService {
  // Get stored JWT token
  getToken() {
    try {
      return localStorage.getItem(STORAGE_KEY_TOKEN) || null;
    } catch {
      return null;
    }
  }

  // Set JWT token
  setToken(token) {
    try {
      if (token) {
        localStorage.setItem(STORAGE_KEY_TOKEN, token);
      } else {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
      }
    } catch (e) {
      console.warn('Failed to persist auth token', e);
    }
  }

  // Get currently authenticated individual user
  getCurrentUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER);
      if (raw) {
        const user = JSON.parse(raw);
        if (user && user.id && user.email) {
          return user;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  // Set current user
  setCurrentUser(user) {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        // Keep legacy key synced so chat and other existing modules identify the sender
        const legacyMember = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'admin',
          roleName: 'Project Lead',
          shortName: user.name.split(' ')[0],
          avatar: user.avatar,
          isAuthenticated: true,
          authenticatedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY_LEGACY_AUTH, JSON.stringify(legacyMember));
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_LEGACY_AUTH);
      }
    } catch (e) {
      console.warn('Failed to persist user profile', e);
    }
  }

  // Register a new user account
  async register({ name, email, password, confirmPassword }) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirmPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Registration failed. Please try again.'
        };
      }

      this.setToken(data.token);
      this.setCurrentUser(data.user);

      return {
        success: true,
        user: data.user,
        token: data.token
      };
    } catch (err) {
      console.error('[AuthService] Registration request failed:', err);
      return {
        success: false,
        error: 'Unable to reach the authentication server. Please ensure the backend server is running (run "npm run dev" or "node server/index.js").'
      };
    }
  }

  // Login with existing account
  async login({ email, password }) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Invalid email or password.'
        };
      }

      this.setToken(data.token);
      this.setCurrentUser(data.user);

      return {
        success: true,
        user: data.user,
        token: data.token
      };
    } catch (err) {
      console.error('[AuthService] Login request failed:', err);
      return {
        success: false,
        error: 'Unable to reach the authentication server. Please ensure the backend server is running (run "npm run dev" or "node server/index.js").'
      };
    }
  }

  // Verify and refresh session with server
  async verifySession() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        this.logout();
        return null;
      }

      const data = await res.json();
      if (data.success && data.user) {
        this.setCurrentUser(data.user);
        return data.user;
      }
    } catch {
      // Offline fallback: return cached user
      return this.getCurrentUser();
    }
    return null;
  }

  // Sign out
  logout() {
    const token = this.getToken();
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }

    this.setToken(null);
    this.setCurrentUser(null);
    try {
      localStorage.removeItem('collabs_active_project_v2');
      localStorage.removeItem('collabs_projects_cache_v2');
    } catch {}
  }

  // Legacy helper for components during migration
  getAuthenticatedMember() {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      return {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: 'admin',
        roleName: 'Project Lead',
        shortName: currentUser.name.split(' ')[0],
        avatar: currentUser.avatar,
        isAuthenticated: true
      };
    }
    return null;
  }
}

export const authService = new AuthService();
