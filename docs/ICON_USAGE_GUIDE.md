# CourtAccess Icon Usage Guide (Program 19)

**One icon library:** `lucide-react`.
**One mapping:** `src/components/icons/registry.tsx`.
**One access point:** the `<Icon>` component. Never import domain icons directly in pages.

---

## Why a registry?

Before Program 19, the same concept used different icons across pages (e.g. evidence
appeared as `FileText`, `FileCheck`, and `Fingerprint`). The registry guarantees that
every concept renders the **same** icon everywhere, and centralizes variant styling.

```tsx
import { Icon } from '@/components';

// Correct — consistent, themeable
<Icon name="evidence" variant="highConfidence" size={20} />

// Avoid — direct import drifts over time
import { FileText } from 'lucide-react';
<FileText />
```

---

## Canonical Icon Map

| Concept | `name` | lucide icon |
|---------|--------|-------------|
| Evidence | `evidence` | Fingerprint |
| Witness | `witness` | Users |
| Timeline | `timeline` | Clock |
| Statutes | `statutes` | Scale |
| Case Law | `caseLaw` | BadgeCheck |
| Authorities | `authorities` | Landmark |
| Reports | `reports` | FileText |
| Knowledge Graph | `knowledgeGraph` | Network |
| Attorney | `attorney` | Briefcase |
| Investigator | `investigator` | Search |
| Defendant | `defendant` | User |
| Law Firm | `lawFirm` | Building2 |
| Judge | `judge` | Gavel |
| Court | `court` | Landmark |
| Documents | `documents` | Files |
| Upload | `upload` | UploadCloud |
| OCR | `ocr` | ScanLine |
| AI Analysis | `aiAnalysis` | Sparkles |
| Notifications | `notifications` | Bell |
| Messages | `messages` | MessageSquare |
| Settings | `settings` | Settings |
| Audit | `audit` | ClipboardList |
| Human Review | `humanReview` | UserCheck |
| Repository Integrity | `repositoryIntegrity` | ShieldCheck |
| Case Strength | `caseStrength` | Gauge |
| Evidence Confidence | `evidenceConfidence` | BadgeCheck |
| Unknown | `unknown` | HelpCircle |
| Contradiction | `contradiction` | GitCompare |
| Evidence Gap | `evidenceGap` | SearchX |
| Discovery | `discovery` | FolderSearch |
| Tasks | `tasks` | ListChecks |
| Calendar | `calendar` | Calendar |
| Search | `search` | Search |
| Filters | `filters` | SlidersHorizontal |
| Security | `security` | Lock |
| Permissions | `permissions` | KeyRound |

36 canonical concepts.

---

## Variants

Each icon supports 9 variants via the `variant` prop:

| Variant | Color class | Use for |
|---------|-------------|---------|
| `default` | `text-slate-400` | resting state |
| `hover` | `text-white` | hover / active nav |
| `selected` | `text-gold-light` | selected item |
| `disabled` | `text-slate-600 opacity-50` | disabled controls |
| `alert` | `text-red-400` | errors, contradictions |
| `success` | `text-emerald-400` | completed, verified |
| `warning` | `text-gold-light` | needs review |
| `highConfidence` | `text-emerald-400` | strong findings |
| `lowConfidence` | `text-orange-400` | weak findings |

```tsx
<Icon name="contradiction" variant="alert" />
<Icon name="evidenceConfidence" variant="highConfidence" />
<Icon name="ocr" variant="warning" />
```

---

## Accessibility

- Decorative icons are `aria-hidden` by default.
- Pass `aria-label` to make an icon a labeled image: `<Icon name="upload" aria-label="Upload evidence" />`.
- Interactive icons must live inside a `<button>`/`<a>` with its own accessible name.

---

## Removing duplicates

During page migration (Programs 20–23, Phase E), replace all direct domain-icon imports
with `<Icon name>`. The audit (`DESIGN_DEBT_REPORT.md`) tracks remaining direct usages.
Only non-domain, purely-visual glyphs (e.g. `ChevronDown`, `X`, `Loader2`) may be imported
directly inside library components.
