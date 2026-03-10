# CourtAccess Beta Testing Checklist

**Environment:** https://beta.courtaccess.net  
**Build:** Phase 229 (Phases 1-228 merged)  
**Date:** 2026-03-10

---

## 1. Registration

- [ ] Navigate to `/register`
- [ ] Fill out all fields (name, email, password, confirm password, role)
- [ ] Verify password validation (min 8 characters, must match)
- [ ] Verify role selector works (Attorney, Investigator, Staff)
- [ ] Submit form → redirects to `/dashboard`
- [ ] Verify user session persists (refresh page, still logged in)

### Registration with Discount Code
- [ ] Enter valid discount code in optional field → click "Apply"
- [ ] Verify green checkmark + code name + discount % displayed
- [ ] Enter invalid code → click "Apply" → verify red error message
- [ ] Enter expired code → verify "This code has expired" error
- [ ] Register with valid code applied → verify usage count increments in admin dashboard

---

## 2. Login

- [ ] Navigate to `/login`
- [ ] Enter valid credentials → sign in → redirects to `/dashboard`
- [ ] Enter invalid credentials → verify error message appears
- [ ] Test "Forgot password?" link → navigates to `/forgot-password`

### Demo Login Buttons
- [ ] Click **Attorney** → auto-login → dashboard loads (attorney view)
- [ ] Click **Investigator** → auto-login → dashboard loads (investigator view)
- [ ] Click **Admin** → auto-login → dashboard loads (admin view with full sidebar)
- [ ] Click **Staff** → auto-login → dashboard loads (staff view)
- [ ] Click **Defendant** → auto-login → dashboard loads (defendant view)
- [ ] Verify each role sees appropriate sidebar items based on permissions

---

## 3. Case Creation

- [ ] Navigate to `/cases`
- [ ] Click "New Case" or equivalent
- [ ] Fill out case details (title, defendant name, case number)
- [ ] Submit → case appears in cases list
- [ ] Click into case → case overview page loads
- [ ] Verify all case tabs render: Overview, Charges, Evidence, Documents, Experts, Motions, Research, Activity, Settings

---

## 4. Evidence Upload

- [ ] Open a case → navigate to Evidence tab
- [ ] Click upload button
- [ ] Upload a test file (PDF, image, or video)
- [ ] Verify file appears in evidence list with metadata
- [ ] Verify file hash (SHA-256) is generated
- [ ] Verify chain-of-custody entry is logged
- [ ] Download the uploaded file → verify integrity

---

## 5. Policy Analysis

- [ ] Navigate to `/dashboard/policy-intelligence/coverage` (admin)
- [ ] Verify policy coverage matrix loads
- [ ] Navigate to `/dashboard/policy-operations` (admin)
- [ ] Verify operations console renders
- [ ] Navigate to `/dashboard/policy-topics` (admin)
- [ ] Verify topic distribution viewer works
- [ ] Navigate to `/dashboard/policy-compliance` (admin)
- [ ] Verify compliance analysis dashboard loads

---

## 6. 3D Reconstruction + Timeline

- [ ] Navigate to `/dashboard/case-timeline` (admin)
- [ ] Verify timeline visualizer loads
- [ ] Verify timeline entries render with timestamps
- [ ] Navigate to `/dashboard/exhibits/viewer`
- [ ] Verify 3D scene renderer loads
- [ ] Test camera presets (if available)
- [ ] Test scene markers and annotations

---

## 7. Expert Report Generation

- [ ] Open a case with evidence attached
- [ ] Navigate to relevant export/report section
- [ ] Generate expert witness report
- [ ] Verify report includes:
  - [ ] Case summary
  - [ ] Evidence inventory
  - [ ] Timeline of events
  - [ ] Policy compliance findings
  - [ ] Legal disclaimer text
- [ ] Download generated report

---

## 8. Discount Code Management (Admin)

- [ ] Login as Admin
- [ ] Navigate to `/dashboard/discount-codes`
- [ ] Click "New Code" → create discount code form opens
- [ ] Create code: Name="Test Code", Value="TEST50", Type=Percent, Value=50%
- [ ] Verify code appears in table
- [ ] Toggle code active/inactive → verify status badge changes
- [ ] Click code row → edit modal opens → change discount to 30% → save
- [ ] Verify table reflects updated discount value
- [ ] Delete a code → confirm dialog → verify removal
- [ ] Switch to **Analytics** tab
- [ ] Verify campaign performance table renders
- [ ] Verify usage distribution chart renders

### Expiration Test
- [ ] Create code with expiration date set to yesterday
- [ ] Verify code shows as expired / can be toggled inactive

---

## 9. Marketing Pages (Public)

- [ ] Navigate to `/` → landing page loads with all sections
- [ ] Navigate to `/for-defense` → defense landing page loads
- [ ] Navigate to `/for-prosecutors` → prosecutor landing page loads
- [ ] Navigate to `/government` → government procurement page loads
- [ ] Navigate to `/contact` → enterprise contact form loads
- [ ] Navigate to `/case-studies` → 4 case studies render
- [ ] Submit contact form → verify success message
- [ ] Verify all nav links work across pages
- [ ] Verify all CTA buttons link to `/register` or `/contact`

---

## 10. Admin Dashboards

- [ ] Login as Admin
- [ ] Navigate to `/dashboard/government-outreach` → leads table loads
- [ ] Navigate to `/dashboard/marketing` → marketing analytics loads
- [ ] Navigate to `/dashboard/demo-requests` → demo requests dashboard loads
- [ ] Navigate to `/dashboard/system-health` → system health loads
- [ ] Navigate to `/dashboard/cpra` → CPRA dashboard loads
- [ ] Navigate to `/dashboard/discount-codes` → discount codes dashboard loads

---

## Priority Focus Areas (Launch Readiness)

> If these five work smoothly, the platform is essentially launch-ready.

| # | Area | Route | Status |
|---|------|-------|--------|
| 1 | Account creation | `/register` | [ ] |
| 2 | Evidence upload | Case → Evidence tab | [ ] |
| 3 | Policy analysis | `/dashboard/policy-compliance` | [ ] |
| 4 | Timeline + reconstruction | `/dashboard/case-timeline` | [ ] |
| 5 | Expert report generation | Case → Export | [ ] |

---

## Post-Testing Sign-Off

- [ ] All 5 priority areas verified
- [ ] No critical UI bugs found
- [ ] No JavaScript console errors on key pages
- [ ] Mobile responsiveness acceptable
- [ ] SSL certificate valid on beta.courtaccess.net
- [ ] API health check returns HTTP 200

**Tester:** _______________  
**Date:** _______________  
**Verdict:** [ ] PASS / [ ] FAIL — Notes: _______________
