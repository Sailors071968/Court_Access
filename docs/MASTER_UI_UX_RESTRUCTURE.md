# CourtAccess Master UI/UX Restructure Program

**Branch:** `cursor/master-ui-ux-restructure-48a3`  
**Status:** Foundation complete — Programs 1–3, 6, 8 (partial), 14 (partial)

## Design Philosophy

CourtAccess uses one visual language across public marketing and authenticated workspaces:

- **Navy** (`#0f172a`) — trust, authority, legal professionalism
- **Gold** (`#C8963E` / `#f59e0b`) — premium accent, CTAs, intelligence highlights
- **Glass panels** — backdrop blur, subtle borders, depth without clutter
- **Generous whitespace** — one primary decision per screen, progressive disclosure

## Program Status

| Program | Name | Status | Evidence |
|---------|------|--------|----------|
| 1 | Global Design System | **IN_PROGRESS** | `src/constants/designTokens.ts`, `src/index.css`, `tailwind.config.js`, `src/components/ui/` |
| 2 | Global Navigation | **IN_PROGRESS** | `src/config/navigation.ts`, `BrandLogo`, unified `PublicMarketingLayout` |
| 3 | Landing Page | **IN_PROGRESS** | `HeroSection`, `PublicMarketingLayout`, token migration |
| 4 | Public Website | **PENDING** | Marketing pages need token migration |
| 5 | Signup Experience | **PENDING** | Onboarding flow redesign |
| 6 | Workspace Design | **IN_PROGRESS** | `AppLayout`, `Sidebar`, `Header`, `StaffDashboard` |
| 7 | Case Experience | **PENDING** | Case tabs and pages need design system adoption |
| 8 | Intelligence Panels | **IN_PROGRESS** | `IntelligencePanel`, `IntelligenceGrid` |
| 9 | Document Experience | **PENDING** | Document viewer redesign |
| 10 | Report Experience | **PENDING** | PDF/Word preview UI |
| 11 | Knowledge Graph | **PENDING** | Visualization redesign |
| 12 | Collaboration | **PENDING** | Permission editor UI |
| 13 | Animation | **IN_PROGRESS** | CSS animations, reduced-motion support |
| 14 | Accessibility | **IN_PROGRESS** | Focus rings, ARIA on nav, keyboard nav |
| 15 | Performance | **PENDING** | Lighthouse certification |
| 16 | Design Consistency Audit | **PENDING** | Page-by-page audit |
| 17 | Visual Certification | **PENDING** | Screenshot suite |

## Component Library

```
src/components/ui/          — Design primitives (Button, Card, Badge, GlassPanel, etc.)
src/components/brand/       — BrandLogo
src/components/intelligence/ — Reusable intelligence panels
src/components/marketing/landing/ — Landing page sections
src/config/navigation.ts    — Single nav configuration
```

## Usage

```tsx
import { Button, Card, PageHeader, Badge } from '@/components/ui';
import { IntelligencePanel, IntelligenceGrid } from '@/components/intelligence/IntelligencePanel';
import { BRAND, SPACING, TYPOGRAPHY } from '@/constants/designTokens';
```

## Migration Guide

1. Replace inline `#0f172a` / `amber-500` with `bg-navy` / `text-gold-light`
2. Replace duplicate logo blocks with `<BrandLogo />`
3. Wrap public pages in `<PublicMarketingLayout>`
4. Use `<PageHeader>` for authenticated page titles
5. Use `<IntelligencePanel>` for metric cards

## Next Steps

1. Migrate remaining marketing pages (`PersonaMarketingPage`, `FeaturesPage`, etc.)
2. Unify `ClientPortalLayout` with `AppLayout` shell variant
3. Apply design system to case workspace (`CaseLayout`, case pages)
4. Run Lighthouse audit (Program 15)
5. Produce visual certification screenshots (Program 17)
