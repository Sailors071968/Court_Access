# Motion Intelligence Certification (Program 49)

**Method:** static audit of `motionRecommendationEngine.ts` + `litigationRecommendationGenerator.ts`. Runtime output UNKNOWN (no live stack). Evidence only.

**Generated:** 2026-07-06.

---

## 1. Motion types supported (evidence)

`motionRecommendationEngine` `motionType` union: **`suppression | brady | pitchess |
discovery | dismiss | other`**, each detected via observation pattern-matching with a
`confidence` score, merged into the litigation generator **with evidence citations**.

| Required motion | Supported | Evidence |
|-----------------|:---------:|----------|
| Motion to Suppress | ✅ | suppression patterns |
| Pitchess | ✅ | pitchess pattern (CA officer records) |
| Discovery | ✅ | discovery pattern |
| Dismissal | ✅ | dismiss pattern |
| Brady | ✅ | brady pattern |
| Severance | ❌ | not modeled |
| Continuance | ❌ | not modeled |
| Protective Orders | ❌ | not modeled |
| Evidence Exclusion | ⚠️ | overlaps suppression; no distinct type |
| Expert Motions | ❌ | not modeled |

**6 of 10** motion categories have dedicated detection.

## 2. Required per-motion fields

| Field | Status |
|-------|--------|
| Supporting authorities | ⚠️ authorities repo exists; not attached to each motion rec |
| Supporting evidence | ✅ generator merges evidence citations |
| Timeline | ✅ available via case timeline (not embedded per motion) |
| Contradictions | ✅ contradiction analysis feeds recommendations |
| Unknowns | ✅ unresolved → UNKNOWN |
| Audit links | ⚠️ intelligence audit trail exists; per-motion audit not persisted |

## 3. Caveats

- **Confidence is heuristic** (hardcoded 0.75–0.90 per matched pattern), not
  evidence-derived — must be replaced with a real metric or marked UNKNOWN.
- Authority + audit are **not consistently attached per motion**.

## 4. Verdict

**Motion Intelligence Certification: PARTIAL — DENIED complete.**
Suppression/Brady/Pitchess/Discovery/Dismissal detection with evidence citations is
real and integrated. **Gaps:** severance, continuance, protective orders, expert
motions, distinct evidence-exclusion; heuristic confidence; inconsistent per-motion
authority/audit. Runtime output UNKNOWN.
