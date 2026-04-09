// ============================================================================
// CourtAccess — Event Normalization Engine (STABLE + SIGNAL FILTERED)
// ============================================================================

export function normalizeEvent(event: any): any[] {
  let attributes: any[] = [];

  try {
    const raw = event.rawText || "";
    const text = raw.toLowerCase();

    // ---------------------------------------------------------------------------
    // 🚫 HARD FILTER — SKIP GARBAGE INPUT
    // ---------------------------------------------------------------------------
    if (!/[a-zA-Z]{5,}/.test(text)) return [];
    if (/[<>{}=]{3,}/.test(text)) return [];
    if (text.length < 25) return [];

    // ---------------------------------------------------------------------------
    // 🕒 TIME (STRICT 24HR FORMAT ONLY)
    // ---------------------------------------------------------------------------
    const timeMatch = text.match(/\b(0?[0-9]|1[0-9]|2[0-3])[0-5][0-9]\b/);
    if (timeMatch) {
      attributes.push({
        type: "time",
        value: timeMatch[0],
      });
    }

    // ---------------------------------------------------------------------------
    // 🔪 WEAPON DETECTION
    // ---------------------------------------------------------------------------
    if (text.includes("knife") || text.includes("blade")) {
      attributes.push({
        type: "weapon",
        value: "knife",
      });
    }

    if (text.includes("gun") || text.includes("firearm")) {
      attributes.push({
        type: "weapon",
        value: "firearm",
      });
    }

    // ---------------------------------------------------------------------------
    // 🩸 VIOLENCE / FORENSIC SIGNAL
    // ---------------------------------------------------------------------------
    if (text.includes("blood") || text.includes("stab") || text.includes("wound")) {
      attributes.push({
        type: "violence",
        value: "injury",
      });
    }

    // ---------------------------------------------------------------------------
    // 🚗 VEHICLE DETECTION
    // ---------------------------------------------------------------------------
    if (text.includes("truck")) {
      attributes.push({
        type: "vehicle",
        value: "truck",
      });
    }

    if (text.includes("honda") || text.includes("cr-v")) {
      attributes.push({
        type: "vehicle",
        value: "honda",
      });
    }

    if (text.includes("car") || text.includes("vehicle")) {
      attributes.push({
        type: "vehicle",
        value: "vehicle",
      });
    }

    // ---------------------------------------------------------------------------
    // 🎨 COLOR DETECTION
    // ---------------------------------------------------------------------------
    if (text.includes("red")) {
      attributes.push({
        type: "color",
        value: "red",
      });
    }

    if (text.includes("blue")) {
      attributes.push({
        type: "color",
        value: "blue",
      });
    }

    if (text.includes("black")) {
      attributes.push({
        type: "color",
        value: "black",
      });
    }

    // ---------------------------------------------------------------------------
    // 👕 CLOTHING
    // ---------------------------------------------------------------------------
    if (text.includes("blouse") || text.includes("shirt") || text.includes("jacket")) {
      attributes.push({
        type: "clothing",
        value: "upper_body",
      });
    }

    // ---------------------------------------------------------------------------
    // ⚖️ LEGAL / CONSTITUTIONAL FLAGS (VERY IMPORTANT)
    // ---------------------------------------------------------------------------
    if (text.includes("without a warrant")) {
      attributes.push({
        type: "legal_issue",
        value: "warrantless_search",
      });
    }

    if (text.includes("miranda")) {
      attributes.push({
        type: "legal_issue",
        value: "miranda_violation",
      });
    }

    if (text.includes("consent") && text.includes("no")) {
      attributes.push({
        type: "legal_issue",
        value: "no_consent",
      });
    }

    if (text.includes("entered") && text.includes("without")) {
      attributes.push({
        type: "legal_issue",
        value: "illegal_entry",
      });
    }

    if (text.includes("searched") && text.includes("without")) {
      attributes.push({
        type: "legal_issue",
        value: "illegal_search",
      });
    }

    // ---------------------------------------------------------------------------
    // 📏 MEASUREMENTS (VERY IMPORTANT FOR CONTRADICTIONS)
    // ---------------------------------------------------------------------------
    const inchMatch = text.match(/\b\d+(\.\d+)?\s?(inch|inches|")\b/);
    if (inchMatch) {
      attributes.push({
        type: "measurement",
        value: inchMatch[0],
      });
    }

    // ---------------------------------------------------------------------------
    // 🔁 FINAL CLEANUP (REMOVE DUPLICATES)
    // ---------------------------------------------------------------------------
    const unique = attributes.filter(
      (item, index, self) =>
        index === self.findIndex(
          (t) => t.type === item.type && t.value === item.value
        )
    );

    return unique;
  } catch (err) {
    console.error("Normalization failed:", err);
    return [];
  }
}
