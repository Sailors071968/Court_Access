# Daily Operational Loop

> Every morning NIIS must tell the truth about who is newly booked into the Sacramento County Jail.

Architecture phase complete. Prefer this loop — see [REDUCE_HUMAN_REVIEW.md](./REDUCE_HUMAN_REVIEW.md).

## Effortless morning

```
Morning Dashboard → Upload today's PDF → Auto-compare → Proposed NEW
→ Investigator Workspace (least confident first) → Exceptions
→ Print Certified Report → Begin business
```

## Every day

1. **Upload** today's Sacramento County PDF (yesterday if needed)  
2. Let NIIS produce proposed classifications  
3. Review **highest-uncertainty** cases first (Manual Compare Assistant)  
4. **Certify** the report  
5. Capture every discrepancy  
6. Add it to the certification corpus / evidence package  
7. **Repeat** tomorrow  

Watch Automatic Classification Rate rise as unnecessary review shrinks.

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
