export const INITIAL_TEAM_MEMBERS = [
  { id: 'usr-1', name: 'Alex Rivera', role: 'Lead Product Designer', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80' },
  { id: 'usr-2', name: 'Marcus Chen', role: 'Frontend Architect', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' },
  { id: 'usr-3', name: 'Elena Rostova', role: 'UX Researcher', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80' },
  { id: 'usr-4', name: 'Devon Vance', role: 'Product Manager', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80' },
];

export const CATEGORIES = [
  {
    id: 'b2b',
    name: 'B2B',
    fullName: 'B2B Portal',
    shortName: 'B2B',
    tagline: 'Enterprise & Wholesale Workflows',
    description: 'Enterprise workflows, wholesale order management, multi-tenant billing, and vendor portals.',
    icon: 'Building2',
    color: '#5856D6', // Apple Indigo
    coverImage: '/cards/b2b_cover_light.svg',
    coverLightImage: '/cards/b2b_cover_light.svg',
    coverDarkImage: '/cards/b2b_cover.svg',
    badgeBg: 'rgba(88, 86, 214, 0.08)',
    badgeBorder: 'rgba(88, 86, 214, 0.22)',
  },
  {
    id: 'admin',
    name: 'Admin',
    fullName: 'Admin Console',
    shortName: 'Admin',
    tagline: 'Console & System Operations',
    description: 'Back-office operations, global telemetry, user permissions, audit logs, and system controls.',
    icon: 'ShieldCheck',
    color: '#0A8491', // Apple Teal
    coverImage: '/cards/admin_cover_light.svg',
    coverLightImage: '/cards/admin_cover_light.svg',
    coverDarkImage: '/cards/admin_cover.svg',
    badgeBg: 'rgba(10, 132, 145, 0.08)',
    badgeBorder: 'rgba(10, 132, 145, 0.22)',
  },
  {
    id: 'driver',
    name: 'Driver',
    fullName: 'Driver App',
    shortName: 'Driver',
    tagline: 'Mobile & Dispatch Operations',
    description: 'Field worker mobile interfaces, turn-by-turn routing, dispatch cards, earnings, and trip logs.',
    icon: 'Smartphone',
    color: '#248A3D', // Apple Forest Green
    coverImage: '/cards/driver_cover_light.svg',
    coverLightImage: '/cards/driver_cover_light.svg',
    coverDarkImage: '/cards/driver_cover.svg',
    badgeBg: 'rgba(36, 138, 61, 0.08)',
    badgeBorder: 'rgba(36, 138, 61, 0.22)',
  },
];

export const COMMON_TAGS = [
  'Dashboard', 'Table View', 'Navigation', 'Map & GPS', 
  'Filter Bar', 'Detail Modal', 'Auth & Onboarding', 'Analytics',
  'Forms & Inputs', 'Empty States', 'Dark Mode', 'Mobile Optimized', 
  'Billing', 'Settings', 'Notifications', 'Audit Log'
];

export const INITIAL_REFERENCES = [];

