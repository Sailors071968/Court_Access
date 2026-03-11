# Testing Court Access Frontend

## Local Dev Server
- Run `npx vite --port 5174 --host 0.0.0.0` from the repo root
- App available at `http://localhost:5174`

## Demo Login
- Navigate to `/login`
- Demo account buttons at the bottom: Attorney, Investigator, Admin, Staff, Defendant
- All use password `password` with emails like `admin@courtaccess.com`, `staff@courtaccess.com`, etc.
- Click a demo button to auto-login and redirect to `/dashboard`

## Role-Based Sidebar Verification
- **Admin**: Sidebar shows expandable "Admin" section with sub-items (CPRA Campaigns, Policy Operations, Discount Codes, Evidence Management, System Health). No standalone Evidence Management link.
- **Staff**: Sidebar shows standalone "Evidence Management" top-level link (Shield icon). No "Admin" section visible.
- **Defendant**: Sidebar shows Dashboard, Cases, Search, Notifications, Settings only. No admin or evidence management links.
- **Attorney/Investigator**: Similar to defendant, no admin routes.

## Evidence Management Dashboard
- Route: `/dashboard/evidence-management`
- Accessible by admin and staff roles (protected by `canViewEvidenceManagement` permission)
- Shows 12 demo evidence files with stats cards, filters, and action buttons
- Actions: View, Reprocess, Flag Corrupted, Mark Artifact, Mark Disregard, Delete
- Mark Artifact opens a confirmation modal with optional notes textarea
- Audit Log tab shows all admin actions with timestamp, admin user, file, action type, and notes
- All data is localStorage-based (no backend API)

## Defendant Disregard Feature
- Login as defendant, go to `/dashboard`
- Documents section shows 4 documents with Archive icon buttons
- Click Archive icon to mark as "Disregard" (strikethrough + dimmed + "DISREGARDED" label)
- Click again to undo
- Actions are logged to `courtaccess_evidence_audit_log` in localStorage

## Data Persistence
- Evidence uploads: `courtaccess_evidence_uploads` in localStorage
- Audit log: `courtaccess_evidence_audit_log` in localStorage
- Defendant disregarded docs: `courtaccess_defendant_disregarded` in localStorage
- Clear localStorage to reset demo data
