/**
 * Team Authentication Service for CollabS
 * Controls access to the 5 authorized team roles via 4-digit PINs.
 * Prevents unauthorized public access when deployed on Vercel.
 */

const STORAGE_KEY_AUTH = 'collabs_authenticated_member_v2';

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
  // Check if current device is authenticated
  getAuthenticatedMember() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AUTH);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.role && parsed.isAuthenticated) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  // Verify PIN for a selected role
  verifyPin(roleId, enteredPin, displayName = '') {
    const roleConfig = TEAM_MEMBERS_CONFIG.find((r) => r.id === roleId);
    if (!roleConfig) {
      return { success: false, error: 'Invalid role selected' };
    }

    const cleanEntered = String(enteredPin).trim();
    const expectedPin = String(roleConfig.defaultPin).trim();

    if (cleanEntered !== expectedPin) {
      return { success: false, error: 'Incorrect 4-digit PIN. Access denied.' };
    }

    const memberData = {
      id: `usr_${roleId}_${Date.now().toString(36)}`,
      role: roleConfig.id,
      roleName: roleConfig.name,
      shortName: roleConfig.shortName,
      name: displayName.trim() || roleConfig.shortName,
      badgeColor: roleConfig.badgeColor,
      isAuthenticated: true,
      authenticatedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(memberData));
    } catch (e) {
      console.warn('Failed to persist auth session', e);
    }

    return { success: true, member: memberData };
  }

  // Logout / Switch Role
  logout() {
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    } catch (e) {
      console.warn('Failed to clear auth session', e);
    }
  }
}

export const authService = new AuthService();
