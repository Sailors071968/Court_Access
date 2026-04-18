export function extractContradictions(events: any[]) {
  const contradictions: any[] = [];

  const normalize = (str: string) =>
    (str || "").toLowerCase();

  const denialEvents = events.filter(e =>
    normalize(e.action) === "deny" ||
    normalize(e.description).includes("not present") ||
    normalize(e.description).includes("wasn't there")
  );

  const presenceEvidence = events.filter(e => {
    const text = normalize(e.description);

    return (
      text.includes("enter") ||        // catches enter, entering, entered
      text.includes("inside") ||
      text.includes("see") ||          // catches see, seeing, seen
      text.includes("observ") ||       // catches observe, observed, observes
      text.includes("appear") ||
      text.includes("video shows")
    );
  });

  // --------------------------------------------------
  // 🔥 PRESENCE CONTRADICTION
  // --------------------------------------------------
  if (denialEvents.length > 0 && presenceEvidence.length > 0) {
    contradictions.push({
      type: "presence_conflict",
      severity: "HIGH",
      legalImpact: "identity",

      statements: [
        ...denialEvents.map(e => e.description),
        ...presenceEvidence.map(e => e.description)
      ]
    });
  }

  return contradictions;
}
