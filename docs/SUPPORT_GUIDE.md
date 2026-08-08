# Support Guide

## Before you start

There is **no customer support console** in this build. There is no ticket
model, no per-subscriber diagnostic view and no support workspace. That is a
known gap, recorded in `COURTACCESS_STATUS.md`, not an oversight in this guide.

What follows is how to diagnose an issue with the tools that do exist.

## The first three questions

1. **Is it their session?** Access tokens last fifteen minutes and renew
   automatically. If renewal fails the user is returned to sign-in with an
   explanation. A user reporting "it logged me out" who then signs in fine has
   probably hit a renewal that could not complete — check whether their refresh
   token was still valid.
2. **Is it a file that could not be read?** Evidence that fails processing is
   stored but nothing in it is searchable. It appears in the user's action
   centre with the reason. This is the most common cause of "the analysis is
   missing things".
3. **Is it the charges?** Every analysis reads the operative charging document.
   A case with no charging document filed will show empty CALCRIM, mens rea and
   coverage — correctly, and it says so, but users read it as a fault.

## Common reports and what they usually mean

**"A finding disappeared."** The charges changed. Everything built on them
follows the newest filing. Case → Charges shows every filing and what each one
changed, in words.

**"The statute is wrong."** Statutes are retrieved from
leginfo.legislature.ca.gov, not stored. Open the official URL shown beside the
section and compare. If they differ, the cache is stale — an administrator can
force a refresh from source.

**"It says UNKNOWN."** That is deliberate. The platform reports UNKNOWN rather
than guessing. The page will say why: no CALCRIM correspondence is recorded for
that section, the statute states no mental state, nothing in the record matches
an element.

**"The upload stopped."** Uploads resume. Reselect the same folder and the
transfer continues from what the server holds. Check the file is not above the
ingestion cap: 500 MB for a non-video file, 10 GB for a video.

## What to escalate

- Any quality assurance failure. It means content is being shown that the
  record does not support, and it blocks release for a reason.
- Any citation that does not match the document it names. That is the platform's
  core claim failing.
- Any statement of guilt, merit or outcome anywhere in the product.
