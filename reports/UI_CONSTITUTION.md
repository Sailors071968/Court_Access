# CourtAccess UI Constitution

**Version:** 1.0.0  
**Effective:** 2026-07-04  
**Authority:** Equal to Engineering Constitution

---

## Purpose

Guide every interface decision so CourtAccess reinforces transparency, reliability, and evidence-governed reasoning — not just visual design.

---

## Core Principles

### 1. Evidence Before Decoration
Every important conclusion must be traceable to evidence or authority. Visual polish never substitutes for substantiation. If data is missing, show UNKNOWN — not placeholder metrics.

### 2. Every Important Conclusion Is Explainable
Clicking any finding (case strength, constitutional issue, recommended motion) must reveal: what evidence supports it, what authority applies, and what confidence level applies.

### 3. Navigation Reflects Attorney Workflows, Not Database Structure
Routes follow how attorneys think:
- What happened?
- What evidence supports it?
- What law applies?
- What remains unknown?
- What should I do next?

Not: "table_x", "model_y", "queue_z".

### 4. Critical Information Visible Without Excessive Clicking
The attorney dashboard must answer at a glance:
- Where is my evidence?
- What offense is this?
- What supports this conclusion?
- What authority applies?
- What investigation should occur next?

### 5. Unknowns Displayed Honestly, Never Hidden
Empty states say what is unknown and what action resolves it. Example: "No timeline events — run timeline processing after evidence upload."

### 6. Reduce Cognitive Load
Progressive disclosure: summary first, detail on demand. No information walls. No metric without context.

### 7. Performance Is a Feature
Interfaces feel responsive. Load critical data first. Skeleton states over spinners. Progressive reveal over blocking waits.

---

## Attorney Questions (Every Screen Must Answer)

| Question | Required UI Element |
|----------|-------------------|
| Where is my evidence? | Evidence count, list, upload status, processing state |
| What offense is this? | Charges panel with code, section, title |
| What supports this conclusion? | Citation to evidence item or statute section |
| What authority applies? | Statute/case law/CALCRIM reference with source link |
| What investigation should occur next? | Recommendations with type (INVESTIGATION, MOTION, SUBPOENA) |
| What remains unknown? | `unknowns[]` array displayed prominently |

---

## Constitutional Footer (Recommended)

Display on attorney-facing pages:

> **No Citation → No Evidence → No Finding → UNKNOWN**

Supporting badges: Evidence-Governed, Auditable, Transparent, Reproducible, Attorney-First.

---

## Dashboard Requirements (vs. Current State)

| Mockup Element | Current Implementation | Gap |
|----------------|----------------------|-----|
| Case Strength 94% | Case analysis panel (partial) | No single metric card |
| Evidence Confidence 98% | Evidence count on overview | No confidence score |
| Key Findings with confidence | CaseAnalysisPanel | ✅ Partial |
| Timeline Overview | Timeline page (separate) | Not on dashboard |
| Citations & Authorities | Search stubs (3 hardcoded) | ❌ Not live |
| Repository Integrity 100% | Not shown | ❌ Epic 2A needed |
| Uncertainties (3 open) | `unknowns[]` in APIs | ⚠️ Not on dashboard |
| Recommended motions | Litigation strategy page | Separate route |

**Current attorney entry point:** `CaseOverviewPage` — wired to live APIs but does not match full dashboard mockup.

---

## Prohibited Patterns

1. Hardcoded statistics presented as live (e.g., `activeCases: 12`)
2. Demo/fabricated legal conclusions
3. Metrics without evidence linkage
4. Empty panels that look complete
5. Database table names in user-facing navigation
6. Hiding processing failures

---

## Verification

Every UI ticket must include:
1. Screenshot of live data (not placeholder)
2. API endpoint that populates each visible field
3. Empty/unknown state screenshot
4. Confirmation no hardcoded values in component source
