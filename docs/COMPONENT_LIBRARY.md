# CourtAccess Master Component Library (Program 18)

**Status:** Foundation complete. No pages migrated yet (per directive).
**Import surface:** `import { ... } from '@/components'` (or `@/components/ui` for primitives).
**Design language:** Dark-mode first (navy/gold), responsive, accessible, animated, variant-driven.

---

## 1. Component Inventory

| Category | Component | File | Key Props / Variants |
|----------|-----------|------|----------------------|
| **Layout / Shell** | `AppLayout` | `layout/AppLayout.tsx` | sidebar + header + TrustBar shell |
| | `Sidebar` | `layout/Sidebar.tsx` | role-filtered nav, collapsible |
| | `Header` | `layout/Header.tsx` | search, notifications, profile |
| | `SplitPane` | `layout/split-pane.tsx` | resizable two-pane, keyboard-adjustable |
| | `PublicMarketingLayout` | `marketing/PublicMarketingLayout.tsx` | glass nav + dark footer + TrustBar |
| **Page structure** | `PageHeader` | `ui/page-header.tsx` | title, subtitle, overline, action |
| | `SectionHeader` | `ui/section-header.tsx` | icon, description, action |
| | `Breadcrumbs` | `ui/breadcrumbs.tsx` | `Crumb[]` |
| **Brand** | `BrandLogo` | `brand/BrandLogo.tsx` | columns emblem + tagline; `size`, `variant` |
| | `TrustBar` | `brand/TrustBar.tsx` | constitutional markers |
| **Hero / marketing** | `HeroSection` | `marketing/landing/HeroSection.tsx` | courthouse + stat cards |
| | `MarketingSection` | `marketing/landing/FeatureCard.tsx` | `variant: base\|muted` |
| | `FeatureCard` | `marketing/landing/FeatureCard.tsx` | `tile: gold\|blue\|violet\|emerald` |
| **Cards** | `Card` | `ui/card.tsx` | `variant: default\|elevated\|glass\|highlight\|plain\|navy`, `padding`, `interactive` |
| | `StatCard` | `ui/card.tsx` | `tile`, `highlight`, `trend`, `sublabel` |
| | `ExpandableCard` | `cards/ExpandableCard.tsx` | collapsible body, `headerRight` |
| | `ProgressCard` | `cards/domain-cards.tsx` | `tone`, value |
| | `TimelineCard` | `cards/domain-cards.tsx` | date, tag |
| | `EvidenceCard` | `cards/domain-cards.tsx` | status, confidence |
| | `DocumentCard` | `cards/domain-cards.tsx` | meta, status |
| | `WitnessCard` | `cards/domain-cards.tsx` | role, tag |
| | `AuthorityCard` | `cards/domain-cards.tsx` | citation, relevance |
| | `ReportCard` | `cards/domain-cards.tsx` | format, onGenerate |
| **Intelligence** | `IntelligencePanel` | `intelligence/IntelligencePanel.tsx` | 11 panel types, status |
| | `IntelligenceGrid` | `intelligence/IntelligencePanel.tsx` | `columns: 2\|3\|4` |
| **Indicators** | `ConfidenceIndicator` | `indicators/indicators.tsx` | score → high/med/low |
| | `RiskIndicator` | `indicators/indicators.tsx` | low/moderate/high/critical |
| | `StatusBadge` | `indicators/indicators.tsx` | maps status → variant |
| | `OcrStatus` | `indicators/indicators.tsx` | queued/processing/complete/failed |
| | `EvidenceStatus` | `indicators/indicators.tsx` | status badge alias |
| | `HumanReviewBanner` | `indicators/indicators.tsx` | count, onReview |
| | `UnknownIndicator` | `indicators/indicators.tsx` | label |
| | `CitationIndicator` | `indicators/indicators.tsx` | source, onClick |
| **Buttons & controls** | `Button` | `ui/button.tsx` | `variant: primary\|secondary\|outline\|ghost\|navy\|danger\|link`, `size` |
| | `Dropdown` | `ui/dropdown.tsx` | options, align |
| | `Input` / `Textarea` | `ui/input.tsx` | label, error, hint |
| | `SearchBar` | `ui/input.tsx` | onSearch |
| **Data** | `DataTable` | `data/data-table.tsx` | `Column<T>[]`, loading, empty |
| | `Pagination` | `data/data-table.tsx` | page, totalPages |
| **Disclosure** | `Tabs` | `ui/tabs.tsx` | `variant: underline\|pill` |
| | `Accordion` | `ui/accordion.tsx` | allowMultiple |
| **Overlays** | `Dialog` / `Modal` | `ui/dialog.tsx` | size, footer, focus trap |
| | `Tooltip` | `ui/tooltip.tsx` | side |
| | `ToastProvider` / `useToast` | `ui/toast.tsx` | success/error/warning/info |
| **Feedback / loading** | `ProgressBar` | `ui/progress.tsx` | tone, showValue |
| | `ProgressRing` | `ui/progress.tsx` | circular gauge |
| | `Spinner` | `ui/spinner.tsx` | inline or block w/ label |
| | `Skeleton` + variants | `ui/skeleton.tsx` | Card / StatGrid |
| | `EmptyState` | `ui/empty-state.tsx` | icon, title, action |
| **Charts** | `Sparkline` | `charts/charts.tsx` | data[] |
| | `BarChart` | `charts/charts.tsx` | data[] |
| | `DonutChart` | `charts/charts.tsx` | data[] + legend |
| | `KnowledgeGraphContainer` | `charts/charts.tsx` | toolbar, height |
| | `TimelineContainer` | `charts/charts.tsx` | wrapper |
| **Iconography** | `Icon` | `icons/registry.tsx` | 36 concepts × 9 variants |
| **Typography** | `Typography` | `ui/typography.tsx` | display/h1–h4/body/caption/overline |

**Total:** 45+ reusable components across 12 categories.

---

## 2. Storybook-style Usage

### Button
```tsx
import { Button } from '@/components/ui';
<Button variant="primary" size="lg">Start Free Trial</Button>
<Button variant="secondary">View Platform</Button>
<Button variant="danger" size="sm">Delete</Button>
```

### Icon (Program 19)
```tsx
import { Icon } from '@/components';
<Icon name="evidence" variant="highConfidence" size={20} />
<Icon name="contradiction" variant="alert" />
```

### StatCard
```tsx
import { StatCard } from '@/components/ui';
import { Fingerprint } from 'lucide-react';
<StatCard tile="gold" icon={<Fingerprint size={20} />} value="94%" label="Case Strength" sublabel="HIGH" />
```

### ExpandableCard + IntelligencePanel
```tsx
import { ExpandableCard, IntelligenceGrid } from '@/components';
<ExpandableCard title="AI Findings" icon={<Icon name="aiAnalysis" />}>
  <IntelligenceGrid columns={3} panels={[{ type: 'contradictions', value: 2, status: 'warning' }]} />
</ExpandableCard>
```

### DataTable + Pagination
```tsx
import { DataTable, Pagination, StatusBadge } from '@/components';
<DataTable
  columns={[
    { key: 'name', header: 'Case' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]}
  rows={cases}
  rowKey={(r) => r.caseId}
  onRowClick={(r) => navigate(`/cases/${r.caseId}`)}
/>
<Pagination page={page} totalPages={pages} onPageChange={setPage} />
```

### Dialog + Toast
```tsx
import { Dialog, Button, useToast } from '@/components/ui';
const { toast } = useToast();
<Dialog open={open} onClose={close} title="Confirm" footer={<Button onClick={confirm}>Confirm</Button>}>
  Are you sure?
</Dialog>
toast({ variant: 'success', title: 'Saved', description: 'Case updated.' });
```

---

## 3. Component Dependency Graph

```
tokens (designTokens.ts, index.css, tailwind.config.js)
  └── lib/utils.ts (cn)
        ├── icons/registry.tsx ────────────────┐
        ├── ui/button, badge, card, progress,  │
        │   input, dropdown, dialog, tabs,      │
        │   accordion, tooltip, toast, spinner, │
        │   skeleton, empty-state, breadcrumbs, │
        │   section-header, page-header,        │
        │   typography, glass-panel             │
        │        │                              │
        │        ├── indicators/indicators.tsx (uses Badge)
        │        ├── cards/domain-cards.tsx (uses Card, Badge, ProgressBar, indicators)
        │        ├── cards/ExpandableCard.tsx (uses Card)
        │        ├── data/data-table.tsx (uses Spinner, EmptyState)
        │        ├── charts/charts.tsx (standalone SVG)
        │        └── intelligence/IntelligencePanel.tsx (uses Card, Badge) ◄─ icons
        │
        ├── brand/BrandLogo.tsx, brand/TrustBar.tsx
        ├── layout/{AppLayout, Sidebar, Header, split-pane} (use BrandLogo, TrustBar)
        └── marketing/{PublicMarketingLayout, landing/*} (use BrandLogo, TrustBar, Button, Card)
```

**Rule:** primitives depend only on `cn` + tokens. Composite components depend on primitives.
No component imports from `pages/`. No circular dependencies.

---

## 4. Migration Strategy (pages come later)

1. **Phase A — Foundation (DONE):** tokens, icon registry, component library. No page changes.
2. **Phase B — Shell & high-traffic:** `AppLayout`, `Sidebar`, `Header`, landing, login (DONE in prior commits).
3. **Phase C — Flagship workspace:** Attorney Workspace (Program 20) as reference implementation.
4. **Phase D — Role workspaces:** Investigator (21), Defendant (22), Operations Command Center (23).
5. **Phase E — Case pages & admin dashboards:** migrate `pages/case/*` and `pages/dashboard/*` to library components; delete per-page `Card`/`StatusBadge` duplicates.
6. **Phase F — Marketing long-tail:** remaining `pages/marketing/*`, legal pages.
7. **Phase G — Audit & certify:** Program 16 consistency audit + Program 17 screenshots.

**Migration rules:**
- Replace local `Card`, `StatusBadge`, stat tiles with library equivalents.
- Replace direct `lucide-react` domain icons with `<Icon name="…" />`.
- Remove inline `style={{}}` and light-theme classes (`bg-white`, `text-gray-*`, `bg-slate-50`).
- Never duplicate a component that already exists in `@/components`.
