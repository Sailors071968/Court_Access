# Client Experience Certification (Program 41 — Defendant)

**Scope:** the defendant/client experience. Split into **(A) code-verifiable**
(onboarding, role selection, navigation, click-paths, accessibility) certified from
source, and **(B) runtime metrics** (first-time-user time, completion success) which
require the deployed application and are marked **UNKNOWN** (never fabricated).

**Generated:** 2026-07-06. Build: `npm run build` — PASS.

---

## A. Code-verified (evidence)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **Simple onboarding** | ✅ PASS | `RoleOnboardingPage` drives `/api/membership/onboarding` steps then routes to the role's dashboard |
| **Role selection** | ✅ PASS | `config/roleOnboarding.ts` — `criminal_defendant`, `self_represented_litigant`, `family_member` all map to `/client-portal`; `DashboardRouter` routes portal roles there |
| **Case access** | ✅ PASS | `DefendantWorkspace` loads real cases via `fetchCases`; phase progress from `case.phase` |
| **Upload evidence** | ✅ PASS (route) | `/client-portal/uploads` + primary action tile |
| **Send message** | ✅ PASS (route) | `/client-portal/messages` + primary action tile |
| **Timeline** | ✅ PASS (route) | `/client-portal/timeline` + "Review Timeline" tile |
| **Tasks** | ✅ PASS (route) | `/client-portal/tasks` + "Complete Tasks" tile |
| **Document requests** | ✅ PASS | "Documents Requested" card + `/client-portal/documents` |
| **Attorney requests** | ✅ PASS | "Questions from your Attorney" card + `/client-portal/messages` |
| **Notifications** | ✅ PASS | `/client-portal/notifications` (+ wired `NotificationsPage`) |
| **Logout** | ✅ PASS | `authStore.logout` (shared shell) |

**Design-consistency fix in this program:** `ClientPortalLayout` was still
light-themed (`bg-slate-50`, `bg-white`, amber) — **migrated to the dark design
system** with `BrandLogo`, gold-accented active nav, ARIA-labelled navigation, and a
global `TrustBar`. The defendant experience is now visually consistent with the rest
of the platform.

---

## B. Number of clicks (measured from the routed UI)

From the Client Portal dashboard home (`DefendantWorkspace`):

| Action | Clicks | Path |
|--------|--------|------|
| Upload Evidence | **1** | primary action tile → `/client-portal/uploads` |
| Send Message | **1** | primary action tile → `/client-portal/messages` |
| Review Timeline | **1** | primary action tile → `/client-portal/timeline` |
| Complete Tasks | **1** | primary action tile → `/client-portal/tasks` |
| View court dates | **1** | "View all court dates" |
| Reply to attorney | **1** | "Open messages" |
| Any sidebar destination | **1** | persistent left nav (10 links) |

**Every primary action is reachable in one click** from the portal home — measured
from the component's route wiring, not estimated.

---

## C. Accessibility audit (static evidence)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Keyboard navigation | ✅ | All actions are `<button>`/`<NavLink>`/`<Link>` (focusable, Enter/Space) |
| Focus visibility | ✅ | Global `:focus-visible` gold ring (`index.css`) |
| ARIA labels | ✅ | Nav `aria-label`, icon buttons labelled, `role="switch"` toggles in Notifications |
| Reduced motion | ✅ | `@media (prefers-reduced-motion: reduce)` disables animations (`index.css`) |
| Responsive | ✅ | `DefendantWorkspace` grids collapse 3→1 col; portal nav stacks on mobile |
| Color contrast | ⚠️ VERIFY | Dark navy + gold-light meets AA for large text; **run an axe/Lighthouse pass** on the deployed page to confirm all body-text pairs |
| Screen-reader flow | ⚠️ VERIFY | Semantic headings present; needs a screen-reader pass on the deployed app |

Reassurance/clarity (per Program 22): three plain-language sections — **What's
happened / What happens next / What to do today** — plus empty states that never
fabricate data.

---

## D. Runtime metrics — UNKNOWN (require deployed app)

| Metric | Status | Why |
|--------|--------|-----|
| **Time for first-time user** | **UNKNOWN** | Requires a real user on the deployed V1 stack; only the stale legacy build is reachable (BLK-001), no credentials, no computer-use tooling |
| **Completion success rate** | **UNKNOWN** | Requires observed sessions on the deployed app |
| **Lighthouse Accessibility score** | **UNKNOWN** | Run `lighthouse https://<v1-host>/client-portal` after deploy |

These are **not estimated**. Capture them via a moderated first-run session + a
Lighthouse/axe pass on the deployed V1 client portal.

---

## E. Completion (not inflated)

| Dimension | Status |
|-----------|--------|
| Onboarding + role selection | ✅ implemented |
| 10 client-portal destinations wired | ✅ |
| Primary actions reachable in 1 click | ✅ measured |
| Client portal on unified dark design system | ✅ (fixed this program) |
| Accessibility primitives (focus/ARIA/reduced-motion/responsive) | ✅ |
| Contrast/screen-reader formal pass | ⚠️ verify on deploy |
| First-time-user time / completion success | **UNKNOWN** (deployed app) |

**Client Experience Certification: code-level PASS; runtime metrics UNKNOWN.**
The defendant experience is implemented, one-click, consistent, and accessible by
construction. Time-to-first-value and completion-success are honestly UNKNOWN until
measured on a deployed V1 stack (BLK-001).

---

## F. Reproduce

```bash
rg -n "criminal_defendant|/client-portal" src/config/roleOnboarding.ts
rg -n "primaryActions|to: '/client-portal" src/pages/client-portal/DefendantWorkspace.tsx src/pages/client-portal/ClientPortalLayout.tsx
# after deploy:
# npx lighthouse https://<v1-host>/client-portal --only-categories=accessibility
```
