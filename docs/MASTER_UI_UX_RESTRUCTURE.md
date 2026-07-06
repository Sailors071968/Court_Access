# CourtAccess Master UI/UX Restructure Program

**Branch:** `cursor/master-ui-ux-restructure-48a3`  
**Status:** Dark design language established — Programs 1–3, 6, 8 (foundation)

## Program Status

| Program | Name | Status | Evidence |
|---------|------|--------|----------|
| 1 | Global Design System | **DONE (foundation)** | tokens, `ca-*` utilities |
| 2 | Global Navigation | **IN_PROGRESS** | `navigation.ts`, `BrandLogo`, `TrustBar` |
| 3 | Landing Page | **DONE (foundation)** | dark `HeroSection`, full token migration |
| 6 | Workspace Design | **IN_PROGRESS** | dark `AppLayout`, `Sidebar`, `Header` |
| 8 | Intelligence Panels | **DONE** | `IntelligencePanel` / `IntelligenceGrid` |
| **18** | **Master Component Library** | **DONE** | `docs/COMPONENT_LIBRARY.md`, 45+ components |
| **19** | **Iconography System** | **DONE** | `docs/ICON_USAGE_GUIDE.md`, `icons/registry.tsx` |
| **20** | **Attorney Workspace (flagship)** | **DONE (v1)** | `StaffDashboard.tsx` rebuilt on library |
| **21** | **Investigator Workspace** | **DONE** | `InvestigatorWorkbenchPage.tsx` on library |
| **22** | **Defendant Workspace** | **DONE** | `client-portal/DefendantWorkspace.tsx` |
| **23** | **Operations Command Center** | **DONE** | `OperationsCommandCenter.tsx` on library |
| **25** | **Global Legal Intelligence Search** | **DONE** | `GlobalSearch` palette + `SearchPage` + `globalSearchService` |
| **26** | **Unified Timeline Engine** | **DONE** | `components/timeline/TimelineEngine.tsx` + adapters; migrated `ActivityPage` & Investigator |
| **27** | **Production Knowledge Graph** | **DONE** | `components/graph/*` engine + workspace; wired into `ResearchPage` |
| **28** | **Evidence Workspace** | **DONE** | `EvidencePage` rebuilt; `MediaPreview` + `EvidenceDetailDrawer` reusable |
| **29** | **Document Workspace** | **DONE** | `DocumentsPage` rebuilt; `DocumentReader` + `DocumentAnalysisPanel` reusable |
| **30** | **Report Engine** | **DONE** | `components/report/*` (builder + engine); new `ReportsPage` + `/reports` route |
| **31** | **Case Command Center** | **DONE** | `CaseOverviewPage` rebuilt — one-click hub, progressive disclosure, responsive |
| **24** | **Repository Audit** | **DONE** | `docs/DESIGN_DEBT_REPORT.md` |

## Design Philosophy

CourtAccess uses **one dark navy visual language** across the entire platform —
public marketing AND authenticated workspaces share the same surfaces, gold
accents, glass panels, and constitutional trust markers.

- **Deep navy** (`#0a0f1c` / `#0f172a`) — every page background
- **Gold** (`#C8963E` / `#eab360`) — CTAs, active states, intelligence highlights, logo
- **Gradient icon tiles** — gold / blue / violet / emerald on dark glass panels
- **Classical columns emblem** + `TRUTH · EVIDENCE · JUSTICE` tagline
- **Global TrustBar** — Evidence-Governed · Auditable · Transparent · Reproducible ·
  Attorney-First · Built for Justice, plus `No Citation → No Evidence → No Finding → UNKNOWN`
- **Generous whitespace**, one primary decision per screen, progressive disclosure

## Program Status

| Program | Name | Status | Evidence |
|---------|------|--------|----------|
| 1 | Global Design System | **IN_PROGRESS** | `src/constants/designTokens.ts`, `src/index.css`, `tailwind.config.js`, `src/components/ui/` |
| 2 | Global Navigation | **IN_PROGRESS** | `src/config/navigation.ts`, `BrandLogo`, `TrustBar`, dark nav/footer/sidebar/header |
| 3 | Landing Page | **DONE (foundation)** | Dark `HeroSection` (courthouse + stat cards), full landing token migration |
| 4 | Public Website | **PENDING** | Remaining marketing pages need token migration |
| 5 | Signup Experience | **PARTIAL** | `LoginPage` dark; register/onboarding pending |
| 6 | Workspace Design | **IN_PROGRESS** | Dark `AppLayout`, `Sidebar`, `Header`, `StaffDashboard` |
| 7 | Case Experience | **PENDING** | Case tabs and pages need design system adoption |
| 8 | Intelligence Panels | **IN_PROGRESS** | Dark `IntelligencePanel` / `IntelligenceGrid` |
| 13 | Animation | **IN_PROGRESS** | CSS animations, reduced-motion support |
| 14 | Accessibility | **IN_PROGRESS** | Focus rings, ARIA, keyboard nav |
| 15 | Performance | **PENDING** | Lighthouse certification |
| 16–17 | Consistency audit + screenshots | **PENDING** | — |

## Design Primitives

```
src/components/ui/          — Button, Card, StatCard, Badge, GlassPanel, PageHeader, Skeleton, Typography
src/components/brand/       — BrandLogo (columns emblem), TrustBar (constitution)
src/components/intelligence/ — IntelligencePanel, IntelligenceGrid (11 panel types)
src/components/marketing/landing/ — HeroSection, FeatureCard, MarketingSection
src/config/navigation.ts    — Single nav configuration
src/index.css               — Dark tokens, glass, gradient icon tiles (ca-* utilities)
```

## Key CSS Utilities

| Class | Purpose |
|-------|---------|
| `ca-panel` / `ca-panel-hover` | Universal dark card surface |
| `ca-glass-nav` | Sticky glass navigation/header |
| `ca-gradient-hero` | Dark hero background with gold glow |
| `ca-gradient-gold` | Gold CTA gradient |
| `ca-text-gradient-gold` | Gold gradient text |
| `ca-icon-gold` / `-blue` / `-violet` / `-emerald` | Gradient stat-card icon tiles |

## Migration Guide

1. Page/section backgrounds → `bg-navy-800` (base) / `bg-navy-900` (alt)
2. Cards → `ca-panel` or `<Card>`; headings → `text-white`; body → `text-slate-400`
3. Replace logo blocks with `<BrandLogo />`
4. Wrap public pages in `<PublicMarketingLayout>` (includes `TrustBar`)
5. Gold CTAs → `ca-gradient-gold text-navy` or `<Button variant="primary">`
6. Stat metrics → `<StatCard tile="gold|blue|violet|emerald">`

## Next Steps

1. Migrate remaining marketing pages (`FeaturesPage`, `PersonaMarketingPage`, audience/legal pages)
2. Convert `RegisterPage`, onboarding, and `ClientPortalLayout` to dark shell
3. Apply design system to case workspace (`CaseLayout`, case pages) + admin dashboards
4. Run Lighthouse audit (Program 15)
5. Produce visual certification screenshots (Program 17)
