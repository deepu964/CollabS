export const DEFAULT_PROJECT_DOCS = [
  {
    id: 'doc-master-overview',
    title: 'CollabS Master Product Overview',
    subtitle: 'Unified System Architecture & Product Requirements Document',
    category: 'all',
    updatedAt: '2026-10-12',
    author: 'CollabS Core Architecture Team',
    tags: ['Overview', 'PRD', 'Architecture', 'Strategy'],
    content: `# CollabS Master Product Requirements Document (PRD)

> **Status:** Active & Approved  
> **Platform Version:** 2.4.0  
> **Target Audience:** Cross-functional Engineering, Product Design, Operations & Executive Stakeholders

---

## 1. Executive Summary & Vision

**CollabS** is a unified, high-performance logistics and commerce workflow platform designed to bridge the gap between enterprise wholesale clients (**B2B**), central operations coordinators (**Admin**), and on-the-ground fleet workers (**Driver**).

Rather than fragmenting operations across isolated SaaS tools, CollabS consolidates high-frequency business actions, real-time telemetry, and visual reference assets into an integrated single ecosystem.

\`\`\`
   ┌────────────────────────────────────────────────────────┐
   │                     CollabS Core                       │
   │  Real-Time Media Asset Bus & Cloud Orchestration      │
   └───────────┬───────────────────┬──────────────────┬─────┘
               │                   │                  │
        ▼      │            ▼      │           ▼      │
   ┌───────────┴────┐ ┌────────────┴────┐ ┌───────────┴────┐
   │   01. B2B      │ │    02. ADMIN    │ │   03. DRIVER   │
   │ Wholesale &    │ │ Operations &    │ │ Mobile App &   │
   │ Enterprise Ops │ │ Telemetry Hub   │ │ Dispatch Flow  │
   └────────────────┘ └─────────────────┘ └────────────────┘
\`\`\`

---

## 2. The Three Operational Pillars

| Pillar | Target Users | Primary Interface | Core Responsibilities |
| :--- | :--- | :--- | :--- |
| **01. B2B Portal** | Corporate Buyers, Wholesalers, Vendors | Desktop Web & Tablet | Bulk order placement, price schedules, invoice reconciliation, contract tiers |
| **02. Admin Console** | Dispatch Directors, Fleet Ops, Risk Teams | High-Density Desktop Monitor | Global dispatch telemetry, rate management, audit logs, system permissions |
| **03. Driver App** | Fleet Drivers, Contractors, Courier Agents | iOS / Android Native Mobile | Turn-by-turn routing, manifest scanning, proof-of-delivery (POD), instant payouts |

---

## 3. High-Priority Functional Requirements

### 3.1 Real-Time Synchronization
* **Broadcast Channel & Cloudinary Storage:** Instant multi-screen sync across open browser tabs and remote devices without page reloads.
* **Offline Resiliency:** Local caching in indexed storage to allow drivers in low-connectivity zones to queue delivery proofs.

### 3.2 Media & Visual Asset Pipeline
* Direct zero-friction drag & drop uploads for UI screens, invoices, inspection photos, and reference wireframes.
* Automatic image optimization, WebP compression, and Cloudinary CDN delivery.

### 3.3 Documentation & PRD Standard
* Live markdown engine rendering doc files with clean visual typography without distracting raw syntax symbols.
* Direct upload support for \`.docx\`, \`.md\`, and \`.txt\` documents.

---

## 4. Key Performance Indicators (KPIs)

* **Order Processing Latency:** < 180ms end-to-end between B2B creation and Admin ingestion.
* **Dispatch Assignment Time:** Reduced from 4.2 minutes to under 30 seconds via automated geofencing.
* **Driver App Uptime:** 99.98% reliability under variable cell signal conditions.
`
  },
  {
    id: 'doc-b2b-spec',
    title: 'Pillar 01: B2B Wholesale Portal PRD',
    subtitle: 'Enterprise Ordering, Invoicing & Multi-Tenant Vendor Workflows',
    category: 'b2b',
    updatedAt: '2026-10-10',
    author: 'Commerce & Enterprise Guild',
    tags: ['B2B', 'Wholesale', 'Invoicing', 'Catalog'],
    content: `# B2B Enterprise Portal Specification

> **Pillar:** 01 • B2B  
> **Key Metric:** Wholesale Transaction Velocity & Accuracy

---

## 1. Objectives

Provide high-volume wholesale buyers and enterprise corporate accounts with a dedicated interface for rapid order entry, tiered negotiated contract pricing, and instant PO generation.

## 2. Core User Workflows

### 2.1 Bulk Catalog & Quick-Order Matrix
* **SKU Matrix Grid:** Buyers can input hundreds of item quantities in a single spreadsheet-like matrix without opening individual product modals.
* **Price Tier Resolution:** Automatic calculation of tier-based volume discounts based on corporate agreement agreements.

### 2.2 Corporate Billing & Net-Terms Approval
* Automated credit checking for Net-30 and Net-60 terms.
* Split invoice generation and automated tax exemption certificate validation.

### 2.3 Delivery Schedule Management
* Multi-dropoff scheduling allowing a single master order to split across multiple distribution hubs with separate delivery target windows.
`
  },
  {
    id: 'doc-admin-spec',
    title: 'Pillar 02: Admin Operations & Telemetry PRD',
    subtitle: 'Back-Office Command Center, Audit Logging & Dispatch Management',
    category: 'admin',
    updatedAt: '2026-10-09',
    author: 'Platform Infrastructure Guild',
    tags: ['Admin', 'Telemetry', 'Security', 'Audit'],
    content: `# Admin Console & Operations Specification

> **Pillar:** 02 • Admin  
> **Key Metric:** Operational Response Time & System Reliability

---

## 1. Objectives

Empower internal fleet managers, dispatch coordinators, and system administrators with complete visibility over active trips, fleet telemetry, exceptions, and compliance audit records.

## 2. Key Modules

### 2.1 Live Dispatch Map & Telemetry Matrix
* Interactive high-performance map showing active driver locations, route progress, and ETA calculation.
* Color-coded exception alerts (Delayed, Route Deviation, Vehicle Maintenance Warning).

### 2.2 Role-Based Access Control (RBAC)
* Granular permission groups:
  * **Super Administrator:** System configs, API keys, global audit logs.
  * **Dispatch Coordinator:** Fleet assignment, route overrides, driver communication.
  * **Finance Specialist:** Billing approval, payment gateway reconciliation.

### 2.3 Comprehensive Audit Trails
* Immutable ledger logging every action: order modification, route cancellation, and user permission updates.
`
  },
  {
    id: 'doc-driver-spec',
    title: 'Pillar 03: Driver Mobile Application PRD',
    subtitle: 'Field Logistics, Turn-by-Turn Routing & Proof of Delivery',
    category: 'driver',
    updatedAt: '2026-10-08',
    author: 'Mobile & Field Logistics Guild',
    tags: ['Driver', 'Mobile', 'Routing', 'POD'],
    content: `# Driver Mobile Application Specification

> **Pillar:** 03 • Driver  
> **Key Metric:** Delivery Completion Rate & Turnaround Speed

---

## 1. Objectives

Deliver a fast, battery-efficient, high-contrast mobile experience that guides drivers through daily manifests, route waypoints, signature capture, and instant payout tracking.

## 2. Key Mobile Features

### 2.1 Manifest Acceptance & Route Planning
* Instant trip card display with guaranteed rate, package count, and estimated time.
* Seamless handoff to native navigation (Google Maps, Apple Maps, Waze).

### 2.2 Digital Proof of Delivery (POD)
* High-resolution camera integration with barcode scanning and photo timestamp watermark.
* In-app customer signature pad with biometric timestamp.

### 2.3 Offline Fallback Mode
* Automatic local queueing of delivery status and photo capture when entering offline reception zones.
* Auto-sync once connection is re-established.
`
  }
];
