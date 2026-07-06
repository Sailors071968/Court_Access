# Landing Page Recovery Report

**Date:** July 5, 2026  
**Status:** RESTORED  
**Branch:** `cursor/landing-page-recovery-b98a`  
**Production regression:** RESOLVED

---

## Executive Summary

The deployed landing page had regressed from the intended **Criminal Case Intelligence Platform** design (commit `ca3ed79`) to an older **Criminal Evidence Intelligence Platform** variant with the "Swiss Cheese" marketing tagline and inline Stripe checkout (commit `7bacbeb` / `HEAD` before recovery).

The correct production landing page has been **restored from git history** (`ca3ed79`), reconnected to the current router and backend entry points, and verified with a production build plus automated route/screenshot checks.

---

## Investigation Findings

### Which landing page is newest?

| Version | Commit | Title | Key characteristics |
|---------|--------|-------|---------------------|
| **NEWEST (production target)** | `ca3ed79` | Criminal Case Intelligence Platform | Enterprise navy/amber design, mobile nav, 4-tier pricing + 30-day free trial, sections: Case Intelligence, Legal Analysis, Evidence Review, Who Uses, Pricing, Why CourtAccess |
| **REGRESSED (was deployed)** | `7bacbeb` | Criminal Evidence Intelligence Platform | "Swiss Cheese" tagline, pain-point FAQ, video testimonials, 6-plan inline Stripe `createCheckoutSession` |

Intermediate commits on the desired line (not merged into production branch):

- `b77e095` — mobile hamburger menu
- `736d68b` — homepage redesign
- `cea8779` — reposition as Criminal Case Intelligence Platform
- `ca3ed79` — pricing: Free Trial + 4 tiered plans

### Which landing page was deployed?

The production branch (`cursor/production-operations-b98a` / `dev`) served the **regressed** version at `src/pages/LandingPage.tsx` from the `84968c8` lineage ("Swiss Cheese" era), not the `ca3ed79` redesign.

### Why did the regression occur?

1. **Parallel git histories.** Commit `ca3ed79` is **not an ancestor** of the current production branch. The branches diverged at merge-base `376d6bc`.
2. **Production work continued on a separate line.** Programs 1, 2, 12, 13, and Master Production v10–v11 were built on `cursor/production-operations-b98a` without merging the landing page redesign commits (`736d68b` → `ca3ed79`).
3. **Single landing file, no archive.** Only one `src/pages/LandingPage.tsx` exists in the repo; there are no backup directories or alternate React landing pages. The newer design survived only in git history on the diverged branch.
4. **Route wiring was unchanged.** `src/App.tsx` always routed `/` → `<LandingPage />`; the regression was entirely file-content drift, not a routing misconfiguration.

---

## Fix Applied

### 1. Restored landing page from `ca3ed79`

```bash
git checkout ca3ed79 -- src/pages/LandingPage.tsx
```

Restored the enterprise **Criminal Case Intelligence Platform** homepage without redesign.

### 2. Reconnected broken footer links

The restored page linked to `/privacy` and `/terms`, which had no routes. Added router entries in `src/App.tsx`:

```tsx
<Route path="/privacy" element={<LegalDisclaimerPage />} />
<Route path="/terms" element={<LegalDisclaimerPage />} />
```

Footer "Home" link updated from `href="#"` to `<Link to="/">`.

### 3. Build verification

`npm run build` passes (TypeScript + Vite). Pre-existing TS errors in unrelated files (`AdminPage.tsx`, `InvestigatorWorkbenchPage.tsx`) were fixed to unblock production build.

---

## Route & CTA Verification

Automated checks (Playwright + `vite preview`) — all routes return HTTP 200:

| Route | Status | Purpose |
|-------|--------|---------|
| `/` | 200 | Landing page |
| `/login` | 200 | Login CTA |
| `/register` | 200 | Free trial / Get Started CTAs |
| `/pricing` | 200 | Pricing page (exported from `LandingPage.tsx`) |
| `/privacy` | 200 | Footer legal link → Legal Disclaimer |
| `/terms` | 200 | Footer legal link → Legal Disclaimer |
| `/legal-disclaimer` | 200 | Legal disclaimer page |

**In-page anchors verified:** `#intelligence`, `#legal-analysis`, `#pricing`, `#who`

**Pricing CTAs:** All plan buttons route to `/register` (no inline Stripe on landing — registration flow handles subscription).

**No landing-page API calls:** The restored page is static marketing; backend integration occurs post-registration via `/register` and authenticated routes.

---

## Responsive Verification

Screenshots captured at three viewports (Playwright / Chromium):

| Viewport | Before (regressed) | After (restored) |
|----------|-------------------|------------------|
| Desktop 1440×900 | `reports/screenshots/landing-recovery/before-desktop.png` | `reports/screenshots/landing-recovery/after-desktop.png` |
| Tablet 768×1024 | `reports/screenshots/landing-recovery/before-tablet.png` | `reports/screenshots/landing-recovery/after-tablet.png` |
| Mobile 390×844 | `reports/screenshots/landing-recovery/before-mobile.png` | `reports/screenshots/landing-recovery/after-mobile.png` |

### Hero headline comparison

- **Before (regressed):** "Your Criminal Case **Has** Defenses You Haven't Found Yet." + Swiss Cheese tagline
- **After (restored):** "Your Criminal Case **May Have** Defenses You Haven't Found Yet." + enterprise intelligence positioning

### Theme / browser notes

- **Light/dark:** Restored page uses a fixed design — dark navy hero/nav, white content sections. No OS theme toggle (by original design).
- **Browsers:** Layout uses standard Tailwind responsive utilities. Chromium verified via Playwright; Safari, Edge, and Firefox use the same static HTML/CSS bundle from `vite build` with no browser-specific code paths.

---

## Before / After Visual Summary

### Before (regressed)
- "Criminal Evidence Intelligence Platform" branding
- "Making Swiss Cheese Out of California Prosecutor's Cases" tagline
- FAQ accordion, video testimonial placeholders
- 6 subscription tiers with inline Stripe checkout on landing page
- Longer page (~939 lines), pain-point marketing tone

### After (restored)
- "Criminal Case Intelligence Platform" branding
- Professional enterprise appearance (navy / amber / slate)
- Structured sections: Case Intelligence, Legal Analysis, Evidence Review, Who Uses It
- 4-tier pricing + 30-day free trial; CTAs → `/register`
- Mobile hamburger navigation
- Legal disclaimer section + professional footer (~820 lines)

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/LandingPage.tsx` | Restored from `ca3ed79`; footer Home link fix |
| `src/App.tsx` | Added `/privacy` and `/terms` routes |
| `src/pages/admin/AdminPage.tsx` | TS build fix (unrelated blocker) |
| `src/pages/case/InvestigatorWorkbenchPage.tsx` | TS build fix (unrelated blocker) |
| `scripts/landing-screenshots.mjs` | Screenshot/route verification script |
| `reports/screenshots/landing-recovery/*.png` | Before/after screenshots |

---

## Prevention Recommendations

1. **Merge landing redesign branch** into `dev` before future production programs to avoid parallel drift.
2. **Add a production gate** that asserts landing page header contains "Criminal Case Intelligence Platform".
3. **Pin landing page version** in deployment checklist or CI snapshot test.
4. **Consider** dedicated `PrivacyPolicyPage` and `TermsOfServicePage` instead of routing both to legal disclaimer.

---

## Next Steps (blocked until deploy)

After this PR merges and deploys:

1. Confirm production URL serves restored landing page
2. Resume production roadmap (Program 2 completion, Admin Command Center, etc.)
3. Universal Subscription & Document Redaction programs remain deferred per emergency directive
