# Continuous daily certification datasets

Every verified morning becomes a production validation dataset and, once green, a permanent regression case.

**Do not wait** for historical PDFs. Record today’s investigator classification with:

```bash
cd backend && npm run cert:daily-truth -- \
  --date YYYY-MM-DD \
  --classification /path/to/manual-classification.md \
  --prior /path/to/yesterday.pdf \
  --current /path/to/today.pdf
```

Legacy `--gold` (NEW names only) still works but is marked **partial**.

Discrepancies enter the Learning Queue with defect categories
(parser / ocr / identity / comparison / source / manual_review).

## Layout

```
days/
  YYYY-MM-DD/                 ← current (today) roster date
    prior.pdf                 ← yesterday SACJAILSCAN
    current.pdf               ← today SACJAILSCAN
    manual-classification.md  ← gold standard (NEW/EXISTING/RETURNING/REVIEW)
    ground-truth-new.md       ← NEW section only (legacy / derived)
    niis-certification.json
    README.md
```

Canonical permanent corpus (preferred):

`fixtures/sacramento/certification-corpus/PRIOR__CURRENT/`

## How to add a day

1. Run the morning PDF comparison (manual + NIIS).  
2. Record the investigator’s full classification (not just a NEW count).  
3. Preserve both PDFs.  
4. Run `npm run cert:daily-truth` (writes corpus + ledger + certification).  
5. Release gate: `npm run cert:release -- --version X.Y.Z`

## Gold standard reminder

If tomorrow there are 41 new inmates, the gold standard is 41.
If tomorrow there are 112, the gold standard is 112.
Never optimize for a historical constant.

If any future code change disagrees with a previously verified day, release certification fails.
