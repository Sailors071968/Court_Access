Demo Evidence Dataset — CourtAccess Pipeline Validation
=======================================================

Case: 2025-CR-04821 (Domestic Battery)

Files:
  1. sample-police-report.txt      — Officer Martinez supplemental report
  2. sample-bodycam-transcript.txt — BWC-7742 transcript (28 min)
  3. sample-cad-dispatch-log.txt   — CAD dispatch log with timestamps
  4. sample-witness-statement.txt  — Neighbor witness statement (David Park)

Key contradictions embedded for pipeline validation:
  - Arrival time: Officer report says 2253, CAD log says 2251:30, bodycam at 2250:15
  - Injury cause: Suspect says "cut on glass", victim says "cut hitting counter"
  - Physical contact: Suspect denies, victim reports grab + push
  - Glass breaking: Suspect says "knocked off by accident", victim says "swept in anger"

Expected pipeline outputs:
  Timeline Engine: 15-20 temporal events across 4 evidence sources
  Narrative Engine: 8-12 factual claims from police report
  Contradiction Detection: 3-4 contradictions (arrival time, injury cause, physical contact, glass)
  Impeachment Candidates: 2-3 high-severity candidates targeting suspect statements

Usage:
  Upload these files via POST /api/evidence/upload-url + POST /api/evidence
  Then trigger analysis via POST /api/narrative/analyze/:caseId
  and POST /api/timeline/rebuild/:caseId
