# Browser Validation Checklist

After deployment, open `https://courtaccess.net` in Chrome.

---

## 1. Console Tab (F12 → Console)

| Check | Expected | Fail Indicator | Rollback? |
|-------|----------|----------------|-----------|
| CSP violations | Zero red errors containing `Content-Security-Policy` | Red CSP errors | YES if frontend broken |
| Mixed content | Zero mixed-content warnings | Yellow/red mixed-content warnings | NO — document |
| Uncaught exceptions | Zero `Uncaught` errors | `Uncaught TypeError`, `Uncaught ReferenceError` | YES if rendering fails |
| 401/403 errors | Zero unexpected auth errors | `401 Unauthorized` on public routes | Investigate — auth hook may be active |
| Network errors | Zero `net::ERR_` errors | `ERR_CONNECTION_REFUSED`, `ERR_CERT_` | YES — backend or NGINX issue |

Action: Right-click Console → Save as → `browser-console.txt`

---

## 2. Network Tab (F12 → Network)

| Check | Expected | Fail Indicator | Rollback? |
|-------|----------|----------------|-----------|
| Page load | All resources load (no red rows) | Red failed requests | Depends on resource |
| `/api/health` | Status 200 | Status 500, 502, 504 | YES |
| Response headers | `Content-Security-Policy` present | Missing CSP | Investigate |
| Response time | < 500ms for health | > 2000ms | NO — performance issue |
| CORS errors | None | Red CORS error in console | YES if frontend can't reach API |

Action: Filter by `Fetch/XHR` to see API calls only.

---

## 3. Application Tab (F12 → Application)

### Cookies

| Check | Expected | Fail Indicator | Rollback? |
|-------|----------|----------------|-----------|
| Secure flag | All cookies have `Secure` ✓ | Missing `Secure` on any cookie | NO — document for Phase B |
| HttpOnly flag | Auth cookies have `HttpOnly` ✓ | Missing `HttpOnly` on auth cookies | NO — document for Phase B |
| SameSite | `Strict` or `Lax` | `None` or missing | NO — document for Phase B |
| Domain | `courtaccess.net` | `localhost` or blank | Investigate |

Note: Cookie flags may only be verifiable after a login attempt. If auth hooks are disabled, cookies may not be set.

### localStorage

| Check | Expected | Fail Indicator | Rollback? |
|-------|----------|----------------|-----------|
| Auth tokens | May or may not be present | N/A — informational | NO |
| Stale dev data | No `localhost` URLs in stored values | `http://localhost:*` in any value | NO — clear manually |

### sessionStorage

| Check | Expected | Fail Indicator | Rollback? |
|-------|----------|----------------|-----------|
| Clean state | Empty or minimal | Large amounts of stale data | NO — informational |

---

## 4. CSP Violation Detection

If CSP violations appear in Console:

1. Note the exact violation message
2. Identify the blocked resource (script, style, image, font, connect)
3. Check if the resource is from the app or a third party

Common CSP violations after hardening:
- `Refused to execute inline script` → inline `<script>` tag in HTML
- `Refused to load the script` → external script from blocked domain
- `Refused to connect to` → API call to non-allowed origin

If violations block the frontend from rendering: ROLLBACK.
If violations are warnings on non-critical resources: DOCUMENT and continue.

---

## 5. Mixed-Content Detection

Check Console for:
- `Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://...'`

Common causes:
- Hardcoded `http://` URLs in frontend code
- API responses containing `http://` links
- Image/font URLs using `http://`

Action: Document but do not rollback unless functionality is broken.

---

## 6. Auth Redirect Validation

| Scenario | Action | Expected | Fail Indicator |
|----------|--------|----------|----------------|
| Visit protected route directly | Navigate to `https://courtaccess.net/dashboard` | Redirect to login page OR render dashboard (auth hooks disabled) | White screen, infinite loop, 500 error |
| Visit login page | Navigate to `https://courtaccess.net/login` | Login form renders | White screen, CSP error preventing render |
| Hard refresh | Ctrl+Shift+R on any page | Page reloads normally | White screen, NGINX 404, stale cache |
| Incognito window | Open incognito → navigate to site | Clean session, login page or public content | Different behavior than normal window |

---

## 7. Quick Validation Script (run in Console)

Paste into Chrome DevTools Console:

```javascript
// Quick Phase 0 browser validation
(async () => {
  console.log('=== Phase 0 Browser Validation ===');
  
  // Check API health
  try {
    const r = await fetch('/api/health');
    const d = await r.json();
    console.log('Health:', d.status, '| Env:', d.environment, '| Uptime:', d.uptime + 's');
  } catch (e) {
    console.error('FAIL: /api/health unreachable:', e.message);
  }
  
  // Check deep health
  try {
    const r = await fetch('/api/health/deep');
    const d = await r.json();
    console.log('Deep health:', d.status);
    for (const [k, v] of Object.entries(d.components)) {
      console.log('  ', k + ':', v.status);
    }
  } catch (e) {
    console.error('FAIL: /api/health/deep unreachable:', e.message);
  }
  
  // Check for CSP meta tag
  const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  console.log('CSP meta tag:', cspMeta ? 'PRESENT' : 'not found (OK — using header)');
  
  console.log('=== Validation Complete ===');
})();
```

---

## Evidence Capture

After completing all checks:

1. Console tab → Right-click → Save as → `browser-console.txt`
2. Network tab → Screenshot (or export HAR: right-click → Save all as HAR)
3. Application tab → Screenshot of Cookies section
4. Copy validation script output from Console
