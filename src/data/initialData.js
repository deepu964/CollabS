export const INITIAL_TEAM_MEMBERS = [
  { id: 'usr-1', name: 'Alex Rivera', role: 'Lead Product Designer', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80' },
  { id: 'usr-2', name: 'Marcus Chen', role: 'Frontend Architect', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' },
  { id: 'usr-3', name: 'Elena Rostova', role: 'UX Researcher', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80' },
  { id: 'usr-4', name: 'Devon Vance', role: 'Product Manager', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80' },
];

export const CATEGORIES = [
  {
    id: 'b2b',
    name: 'B2B Portal',
    shortName: 'B2B',
    description: 'Enterprise workflows, wholesale order management, multi-tenant billing, and vendor portals.',
    icon: 'Building2',
    color: '#5856D6', // Apple System Indigo
    badgeBg: 'rgba(88, 86, 214, 0.08)',
    badgeBorder: 'rgba(88, 86, 214, 0.22)',
  },
  {
    id: 'admin',
    name: 'Admin Console',
    shortName: 'Admin',
    description: 'Back-office operations, global telemetry, user permissions, audit logs, and system controls.',
    icon: 'ShieldCheck',
    color: '#0A8491', // Apple Teal
    badgeBg: 'rgba(10, 132, 145, 0.08)',
    badgeBorder: 'rgba(10, 132, 145, 0.22)',
  },
  {
    id: 'driver',
    name: 'Driver Mobile App',
    shortName: 'Driver App',
    description: 'Field worker mobile interfaces, turn-by-turn routing, dispatch cards, earnings, and trip logs.',
    icon: 'Smartphone',
    color: '#248A3D', // Apple Forest Green
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

export const INITIAL_REFERENCES = [
  {
    id: 'ref-101',
    title: 'Enterprise Wholesale Invoicing & Net-30 Split Portal',
    category: 'b2b',
    sourceUrl: 'https://stripe.com/enterprise',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&auto=format&fit=crop&q=80',
    description: 'Crisp split-screen overview with quick payment terms toggle, bulk invoice batch selector, and dynamic VAT calculation breakdown table.',
    tags: ['Dashboard', 'Table View', 'Billing', 'Filter Bar'],
    author: 'Alex Rivera',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    createdAt: '2026-10-02T10:15:00Z',
    likes: 14,
    notes: 'The inline tax summary drawer on row click saves 3 navigation clicks. Let us adopt this for our enterprise quote review.',
    deviceType: 'Desktop',
    comments: [
      {
        id: 'c-1',
        author: 'Marcus Chen',
        text: 'The sticky batch action bar at the bottom is super slick. Fits our B2B order bulk approvals.',
        createdAt: '2026-10-02T12:30:00Z',
      },
      {
        id: 'c-2',
        author: 'Elena Rostova',
        text: 'Tested this pattern in our client interviews: 9/10 preferred the inline status chips over dropdowns.',
        createdAt: '2026-10-03T09:14:00Z',
      }
    ]
  },
  {
    id: 'ref-102',
    title: 'Multi-Tenant Partner Org & Role Matrix Selector',
    category: 'b2b',
    sourceUrl: 'https://workos.com',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
    description: 'Hierarchical organization permission tree with granular API token scopes and SSO domain verification status pills.',
    tags: ['Settings', 'Table View', 'Navigation', 'Auth & Onboarding'],
    author: 'Elena Rostova',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    createdAt: '2026-10-03T14:40:00Z',
    likes: 9,
    notes: 'Notice how domain verification warnings have subtle amber badges without being overly aggressive.',
    deviceType: 'Desktop',
    comments: [
      {
        id: 'c-3',
        author: 'Devon Vance',
        text: 'We should benchmark our enterprise settings against this hierarchy.',
        createdAt: '2026-10-03T16:20:00Z',
      }
    ]
  },
  {
    id: 'ref-103',
    title: 'B2B Freight Manifest & Shipment Milestones Matrix',
    category: 'b2b',
    sourceUrl: 'https://flexport.com',
    imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&auto=format&fit=crop&q=80',
    description: 'Multi-leg logistics progress tracker showing customs clearance, vessel ETA, and downloadable bill of lading in one unified viewport.',
    tags: ['Dashboard', 'Detail Modal', 'Analytics'],
    author: 'Marcus Chen',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    createdAt: '2026-10-04T08:00:00Z',
    likes: 18,
    notes: 'The horizontal timeline component is exceptionally clear when handling multi-stop shipments.',
    deviceType: 'Desktop',
    comments: []
  },
  {
    id: 'ref-201',
    title: 'Fleet Operations Command Center & Incident Telemetry',
    category: 'admin',
    sourceUrl: 'https://datadoghq.com',
    imageUrl: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1200&auto=format&fit=crop&q=80',
    description: 'High-density operations dashboard with real-time driver active statuses, regional surge clusters, and immediate alert triage cards.',
    tags: ['Dashboard', 'Analytics', 'Map & GPS', 'Dark Mode'],
    author: 'Alex Rivera',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    createdAt: '2026-10-01T15:20:00Z',
    likes: 22,
    notes: 'Dark mode palette with neon status indicators makes long shifts in ops supervision less tiring on the eyes.',
    deviceType: 'Desktop',
    comments: [
      {
        id: 'c-4',
        author: 'Alex Rivera',
        text: 'The 3-tier severity color coding (Cyan/Amber/Red) should be standard across our admin screens.',
        createdAt: '2026-10-01T18:00:00Z',
      }
    ]
  },
  {
    id: 'ref-202',
    title: 'Granular Audit Trail & Driver Payout Reconciliation Table',
    category: 'admin',
    sourceUrl: 'https://retool.com',
    imageUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
    description: 'Multi-column financial ledger with quick JSON payload inspect drawer, refund override confirmation modals, and export filters.',
    tags: ['Table View', 'Audit Log', 'Detail Modal', 'Filter Bar'],
    author: 'Marcus Chen',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    createdAt: '2026-10-02T19:30:00Z',
    likes: 11,
    notes: 'Clicking any row slides out the full audit snapshot without navigating away from the table page.',
    deviceType: 'Desktop',
    comments: []
  },
  {
    id: 'ref-203',
    title: 'Zone Geofencing & Surge Multiplier Configuration Tool',
    category: 'admin',
    sourceUrl: 'https://mapbox.com',
    imageUrl: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&auto=format&fit=crop&q=80',
    description: 'Interactive polygon draw tool for city dispatch supervisors to set dynamic toll boundaries, driver bonuses, and restricted drop zones.',
    tags: ['Map & GPS', 'Settings', 'Forms & Inputs'],
    author: 'Devon Vance',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    createdAt: '2026-10-03T11:05:00Z',
    likes: 16,
    notes: 'Crucial reference for our territory management sprint. The slider for multiplier rate is very intuitive.',
    deviceType: 'Desktop',
    comments: []
  },
  {
    id: 'ref-301',
    title: 'Driver Live Dispatch Card & Turn-by-Turn Navigation UI',
    category: 'driver',
    sourceUrl: 'https://uber.com/drive',
    imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&auto=format&fit=crop&q=80',
    description: 'Mobile-first driver heads-up interface: Large swipe-to-accept button, estimated toll & payout display, and simplified lane guidance header.',
    tags: ['Mobile Optimized', 'Map & GPS', 'Navigation', 'Forms & Inputs'],
    author: 'Elena Rostova',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    createdAt: '2026-10-02T16:00:00Z',
    likes: 27,
    notes: 'Notice button hit-targets: 64px min height so drivers wearing work gloves can accept tasks easily.',
    deviceType: 'Mobile',
    comments: [
      {
        id: 'c-5',
        author: 'Marcus Chen',
        text: 'The high-contrast route line with alternating white arrows ensures readability under bright sunlight.',
        createdAt: '2026-10-02T17:15:00Z',
      }
    ]
  },
  {
    id: 'ref-302',
    title: 'Driver Shift Earnings, Instant Cashout & Gas Perks Dashboard',
    category: 'driver',
    sourceUrl: 'https://lyft.com/driver',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&auto=format&fit=crop&q=80',
    description: 'Mobile card view showing daily gross, active online hours, tip breakdown, and single-tap instant bank payout status.',
    tags: ['Mobile Optimized', 'Billing', 'Dashboard', 'Analytics'],
    author: 'Alex Rivera',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    createdAt: '2026-10-03T18:45:00Z',
    likes: 19,
    notes: 'The earnings progress bar toward the weekly target motivates driver retention.',
    deviceType: 'Mobile',
    comments: []
  },
  {
    id: 'ref-303',
    title: 'Driver Delivery Proof & Barcode Scan Confirmation Drawer',
    category: 'driver',
    sourceUrl: 'https://doordash.com/dasher',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
    description: 'Bottom sheet camera interface with optical package alignment frame, digital signature capture box, and contactless note prompt.',
    tags: ['Mobile Optimized', 'Detail Modal', 'Forms & Inputs'],
    author: 'Devon Vance',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    createdAt: '2026-10-04T12:10:00Z',
    likes: 15,
    notes: 'Great bottom sheet gesture physics with quick failure feedback if photo is blurry.',
    deviceType: 'Mobile',
    comments: []
  }
];
