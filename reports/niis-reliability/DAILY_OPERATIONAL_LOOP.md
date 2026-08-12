# Daily Operational Loop

> Every morning NIIS must tell the truth about who is newly booked into the Sacramento County Jail.

The architecture is mature. Prefer this loop over new architectural directives.

## Every day

1. **Upload** yesterday's certified PDF (if needed)  
2. **Upload** today's PDF  
3. Let NIIS **generate** the New Inmate Report  
4. Perform your **manual comparison**  
5. **Compare** NIIS to your manual results  
6. **Fix** every discrepancy  
7. **Add** every resolved discrepancy to the certification corpus / evidence package  
8. **Repeat** tomorrow  

## Commands that support the loop

```bash
cd backend

# After manual comparison
npm run cert:daily-truth -- \
  --date YYYY-MM-DD \
  --classification /path/to/manual-classification.md \
  --prior /path/yesterday.pdf \
  --current /path/today.pdf

# Release only after corpus agreement
npm run cert:release -- --version X.Y.Z --changelog ../reports/niis-reliability/INTENTIONAL_CHANGES.md

# Prove rebuildability from sealed packages
npm run cert:rebuild
```

## Operator surfaces

| Step | Where |
|---|---|
| Upload PDFs | `/admin/intelligence` → Upload |
| Morning readiness + silent failures | `/admin/intelligence` Morning Operations |
| Report | New Inmates / printable report |
| Manual vs NIIS | Daily Difference Viewer |
| Discrepancies | Learning Queue (review is a feature) |

## Success

NIIS improves when the certification corpus grows with real Sacramento County agreement — not when more architecture is added.
