// ============================================
// Court Access — CPRA Email Template
// Template engine for California Public Records Act requests.
// ============================================

// ---------------------------------------------------------------------------
// Template Variables
// ---------------------------------------------------------------------------

export interface CpraTemplateVars {
  agencyName: string;
  trackingId: string;
  contactEmail: string;
}

// ---------------------------------------------------------------------------
// Subject Line
// ---------------------------------------------------------------------------

export function getCpraSubject(vars: CpraTemplateVars): string {
  return `California Public Records Act Request – Law Enforcement Policy Manual [${vars.trackingId}]`;
}

// ---------------------------------------------------------------------------
// Email Body (plain text)
// ---------------------------------------------------------------------------

export function getCpraBody(vars: CpraTemplateVars): string {
  return `To Whom It May Concern at ${vars.agencyName},

Under the California Public Records Act (Government Code §6250-6270), I am requesting a copy of the following public records maintained by your agency:

  • current law enforcement policy manual
  • use-of-force policies
  • arrest procedures
  • investigative procedures
  • training policies
  • internal affairs policies

Electronic copies (PDF or digital format) are preferred.

If these records are publicly available online, please provide the URL.

Please respond to this request at: ${vars.contactEmail}

Tracking Reference: ${vars.trackingId}

Under the CPRA, your agency is required to respond within 10 calendar days of receipt of this request. If you need additional time, please notify us of the extension within the initial 10-day period.

Thank you for your prompt attention to this request.

Sincerely,
Court Access Policy Acquisition System
Reference: ${vars.trackingId}`;
}

// ---------------------------------------------------------------------------
// Email Body (HTML)
// ---------------------------------------------------------------------------

export function getCpraBodyHtml(vars: CpraTemplateVars): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; font-size: 14px; color: #1a1a1a; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 20px;">
  <p>To Whom It May Concern at <strong>${escapeHtml(vars.agencyName)}</strong>,</p>

  <p>Under the <strong>California Public Records Act</strong> (Government Code §6250-6270), I am requesting a copy of the following public records maintained by your agency:</p>

  <ul style="margin: 16px 0; padding-left: 24px;">
    <li>current law enforcement policy manual</li>
    <li>use-of-force policies</li>
    <li>arrest procedures</li>
    <li>investigative procedures</li>
    <li>training policies</li>
    <li>internal affairs policies</li>
  </ul>

  <p>Electronic copies (PDF or digital format) are preferred.</p>

  <p>If these records are publicly available online, please provide the URL.</p>

  <p>Please respond to this request at: <a href="mailto:${escapeHtml(vars.contactEmail)}">${escapeHtml(vars.contactEmail)}</a></p>

  <p style="background: #f5f5f5; padding: 8px 12px; border-left: 3px solid #1E3A5F; font-size: 13px;">
    Tracking Reference: <strong>${escapeHtml(vars.trackingId)}</strong>
  </p>

  <p>Under the CPRA, your agency is required to respond within <strong>10 calendar days</strong> of receipt of this request. If you need additional time, please notify us of the extension within the initial 10-day period.</p>

  <p>Thank you for your prompt attention to this request.</p>

  <p>Sincerely,<br/>
  Court Access Policy Acquisition System<br/>
  <small style="color: #666;">Reference: ${escapeHtml(vars.trackingId)}</small></p>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// HTML Escape Helper
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
