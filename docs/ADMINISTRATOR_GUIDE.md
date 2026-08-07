# Administrator Guide

You are the only role that can reach the certification portal, statutory
intelligence and production readiness. Everything here is administrator-only
and enforced in three places: the route table, the page, and every handler.

## Importing a certification case

**Admin → Gold Standard Certification → Import.**

Enter a reference and a label, then drag the discovery folder onto the page or
use **Select Folder**. Files go up in 8 MB chunks; the folder structure and the
modification times from your machine are preserved.

If the connection drops, reselect the same folder. The transfer continues from
what the server already holds rather than starting again — resume is derived
from the bytes on disk, so it cannot disagree with what was received.

Before anything is processed you see what arrived: documents, video, audio,
images, page counts, running times and an estimated processing time with the
basis for the estimate. **Nothing is processed until you confirm.**

Measured limits on this build: uploads to 10 GB complete. Ingestion caps a
single non-video file at 500 MB and a video at 10 GB. A discovery set with one
document above 500 MB needs those limits raised first.

## Statutory intelligence

**Admin → Statutory Intelligence.** Look up any section of any of the 29
California codes. The text comes from leginfo.legislature.ca.gov each time,
with the official URL, the act that last amended it, the effective date and a
SHA-256 fingerprint of the text.

The fingerprint is what makes synchronisation work. Running a sync re-reads
cached sections and reports which have been amended, repealed or renumbered
since they were last read. Previous versions are kept so an old analysis stays
reproducible.

**Refresh from source** bypasses the cache. Use it sparingly: leginfo is a
public service and requests are deliberately spaced out.

## Production readiness

**Admin → Production Readiness.** The release gate, evaluated from the
certification suites rather than asserted. The recommendation is derived from
the gate, so it cannot report ready while a criterion below it says otherwise.

Failing checks are named. Anything unmeasured is listed rather than folded into
the pass count.

## What you should check regularly

- **Quality assurance** runs as part of certification. If it fails, something
  is putting content in front of users that the record does not support. Treat
  it as a release blocker, because that is how the gate treats it.
- **Legislative synchronisation** tells you when a statute a case relies on has
  changed. A case pins the version it was analysed against, so the analysis
  stays reproducible, but you should know when the law has moved.
- **Failed evidence processing** appears in every user's action centre. A file
  that could not be read cannot support a finding.
