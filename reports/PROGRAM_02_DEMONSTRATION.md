# Program 2 — Law Firm Operating Platform Demonstration

**Generated:** 2026-07-04T23:13:34.104Z
**Completion:** 100%

## Visual Demonstration

![Law Firm Operating Platform — Overview Dashboard](/opt/cursor/artifacts/assets/program02-firm-platform-demo.png)

**Live route:** Navigate to `/firm` after authentication to use the full operating platform.

### Primary UI: Law Firm Operating Platform

**Route:** `/firm`

**Tabs:** Overview | Offices & Departments | Personnel | Collaboration | Knowledge | Conflicts | Security | Client Teams

### Workflow Walkthrough

### Organization onboarding
- **Route:** `/organization/onboarding`
- **UI:** `src/pages/organization/OrganizationOnboardingPage.tsx`
- Complete firm profile
- Add primary office
- Invite team
- Finish onboarding

### Law Firm Operating Platform
- **Route:** `/firm`
- **UI:** `src/pages/organization/FirmOperatingPlatformPage.tsx`
- View overview analytics
- Seed CA offices
- Manage departments
- Personnel roster
- Internal messaging
- Conflict check
- Knowledge repository

### Team invitation & acceptance
- **Route:** `/accept-invitation?token=...`
- **UI:** `src/pages/auth/AcceptInvitationPage.tsx`
- Admin sends invite
- Invitee opens link
- Creates account
- Joins existing org tenant

### Organization settings (legacy)
- **Route:** `/organization/settings`
- **UI:** `src/pages/organization/OrganizationSettingsPage.tsx`
- Update branding
- Manage offices
- Send invitations


## API Verification

- `GET /api/firm/analytics`
- `GET /api/firm/personnel`
- `POST /api/firm/departments`
- `PUT /api/firm/clients/:clientId/team`
- `POST /api/firm/messages`
- `POST /api/firm/tasks`
- `POST /api/firm/knowledge`
- `POST /api/firm/conflicts/check`
- `POST /api/firm/permissions`
- `POST /api/firm/offices/seed-california`

## Test Evidence

```bash
node --import tsx --test tests/organization-domain.test.ts
node --import tsx --test tests/firm-platform.test.ts
```
