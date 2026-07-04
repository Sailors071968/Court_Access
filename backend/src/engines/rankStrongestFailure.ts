// ============================================================================
// 🧠 COURTACCESS — STRATEGIC FAILURE RANKING ENGINE (STABLE BUILD)
// ============================================================================

type RankElement = { failed?: boolean; label?: string; name?: string; id?: string };
type RankContradiction = { impact?: string; severity?: string; description?: string; type?: string; legalImpact?: string };
type RankArgument = { mapping?: { element?: string }; strength?: number };

export function rankStrongestFailure(
  elements: RankElement[],
  contradictions: RankContradiction[],
  argumentsList: RankArgument[],
) {
  const ELEMENT_PRIORITY: Record<string, number> = {
    identity: 1.0,
    entry: 0.95,
    act: 0.9,
    possession: 0.85,
    intent: 0.8,
    knowledge: 0.75,
    time: 0.5,
    location: 0.5,
    object: 0.5,
    general: 0.6,
  };

  function getSeverityScore(c: RankContradiction) {
    if (c.impact === 'DESTROYS') return 100;

    switch (c.severity) {
      case 'CRITICAL': return 95;
      case 'HIGH': return 80;
      case 'MEDIUM': return 60;
      case 'LOW': return 40;
      default: return 50;
    }
  }

  function getElementName(e: RankElement) {
    return (e.label || e.name || e.id || 'unknown').toLowerCase();
  }

  function getContradictionsForElement(name: string, list: RankContradiction[]) {
    return (list || []).filter((c) => {
      const text = `${c.description || ''} ${c.type || ''} ${c.legalImpact || ''}`.toLowerCase();
      return text.includes(name);
    });
  }

  function getArgumentImpactMultiplier(name: string, list: RankArgument[]) {
    const related = list.filter((a) => (a.mapping?.element || '').toLowerCase().includes(name));
    if (!related.length) return 1;

    const destroyed = related.filter((a) => a.strength === 0).length;
    if (destroyed === related.length) return 1.5;
    if (destroyed > 0) return 1.2;
    return 1;
  }

  const results: Array<{ element: string; reason: string; damageScore: number }> = [];

  for (const element of elements) {
    if (!element.failed) continue;

    const name = getElementName(element);
    const priority = ELEMENT_PRIORITY[name] ?? ELEMENT_PRIORITY.general;
    const relatedContradictions = getContradictionsForElement(name, contradictions);

    let contradictionScore = 0;
    let reason = '';

    for (const c of relatedContradictions) {
      const score = getSeverityScore(c);
      if (score > contradictionScore) {
        contradictionScore = score;
        if (c.description) reason = c.description;
      }
    }

    if (!reason) {
      reason = `Failure of element "${name}"`;
    }

    const multiplier = getArgumentImpactMultiplier(name, argumentsList);
    const damageScore = Math.round(contradictionScore * priority * multiplier);

    results.push({ element: name, reason, damageScore });
  }

  return results.sort((a, b) => b.damageScore - a.damageScore);
}
