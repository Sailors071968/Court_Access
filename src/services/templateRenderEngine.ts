// ============================================
// Court Access — Template Render Engine (Phase O3)
// Deterministic Template Renderer
//
// Strict deterministic renderer for communication templates.
// No AI. No dynamic rewriting. No fuzzy matching.
//
// Rules:
//   - Replace exact placeholders only ({{VARIABLE_NAME}})
//   - FAIL if placeholder missing from variables
//   - FAIL if unknown variable provided (not in template)
//   - ASCII-only replacement
//   - No regex fuzzy matching
//   - Deterministic string substitution
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Binary PASS/FAIL where applicable
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No .toLowerCase()
//   - No mutation of input entities
//   - No AI API calls
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  TemplateVersion,
  TemplateRenderResult,
  TemplateRenderValidation,
} from '../models/EscalationModel';

// ---------------------------------------------------------------------------
// Extract Placeholders from Template String
// ---------------------------------------------------------------------------

/**
 * Extract all {{PLACEHOLDER}} tokens from a template string.
 *
 * Scans character-by-character for '{{' and '}}' boundaries.
 * No regex. Deterministic forward scan.
 * Returns deduplicated array sorted by ASCII comparator.
 *
 * Placeholder names must be non-empty strings between {{ and }}.
 */
function extractPlaceholders(text: string): string[] {
  const placeholders: string[] = [];
  const seen: Set<string> = new Set();
  let i = 0;

  while (i < text.length - 3) {
    // Look for '{{'
    if (text[i] === '{' && text[i + 1] === '{') {
      // Find matching '}}'
      const startIdx = i + 2;
      let endIdx = startIdx;
      while (endIdx < text.length - 1) {
        if (text[endIdx] === '}' && text[endIdx + 1] === '}') {
          break;
        }
        endIdx++;
      }

      if (endIdx < text.length - 1 && text[endIdx] === '}' && text[endIdx + 1] === '}') {
        const name = text.substring(startIdx, endIdx);
        if (name.length > 0 && !seen.has(name)) {
          seen.add(name);
          placeholders.push(name);
        }
        i = endIdx + 2;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  // Sort ASC by ASCII comparator
  return placeholders.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Validate Template Rendering
// ---------------------------------------------------------------------------

/**
 * Validate that a template can be rendered with the given variables.
 *
 * Checks:
 *   1. All placeholders in template are present in variables
 *   2. All variables provided are present as placeholders in template
 *
 * Returns:
 *   - PASS if all placeholders resolved and no unknown variables
 *   - FAIL if any missing placeholders or unknown variables
 *
 * Binary PASS/FAIL only.
 * Deterministic — same inputs always produce same result.
 */
export function validateTemplateRender(
  template: TemplateVersion,
  variables: Record<string, string>
): TemplateRenderValidation {
  // Extract placeholders from subject and body
  const subjectPlaceholders = extractPlaceholders(template.subject);
  const bodyPlaceholders = extractPlaceholders(template.body);

  // Deduplicate all template placeholders
  const allPlaceholderSet: Set<string> = new Set();
  for (let i = 0; i < subjectPlaceholders.length; i++) {
    allPlaceholderSet.add(subjectPlaceholders[i]);
  }
  for (let i = 0; i < bodyPlaceholders.length; i++) {
    allPlaceholderSet.add(bodyPlaceholders[i]);
  }

  // Check for missing placeholders (in template but not in variables)
  const missingPlaceholders: string[] = [];
  const allPlaceholderArray = Array.from(allPlaceholderSet);
  for (let i = 0; i < allPlaceholderArray.length; i++) {
    const placeholder = allPlaceholderArray[i];
    if (!(placeholder in variables)) {
      missingPlaceholders.push(placeholder);
    }
  }

  // Check for unknown variables (in variables but not in template)
  const unknownVariables: string[] = [];
  const variableKeys = Object.keys(variables);
  for (let i = 0; i < variableKeys.length; i++) {
    const key = variableKeys[i];
    if (!allPlaceholderSet.has(key)) {
      unknownVariables.push(key);
    }
  }

  // Sort for deterministic output
  missingPlaceholders.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  unknownVariables.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const pass = missingPlaceholders.length === 0 && unknownVariables.length === 0;

  return {
    result: pass ? 'PASS' : 'FAIL',
    missingPlaceholders,
    unknownVariables,
  };
}

// ---------------------------------------------------------------------------
// Replace Placeholders in a Single String
// ---------------------------------------------------------------------------

/**
 * Replace all {{PLACEHOLDER}} tokens in a string with variable values.
 *
 * Forward scan. No regex.
 * Replaces exact match of {{NAME}} with variables[NAME].
 * If a placeholder is not in variables, it is left as-is.
 * (Caller should validate first using validateTemplateRender.)
 *
 * Deterministic — same inputs always produce same output.
 */
function replacePlaceholders(
  text: string,
  variables: Record<string, string>
): string {
  let result = '';
  let i = 0;

  while (i < text.length) {
    // Look for '{{'
    if (i < text.length - 3 && text[i] === '{' && text[i + 1] === '{') {
      // Find matching '}}'
      const startIdx = i + 2;
      let endIdx = startIdx;
      while (endIdx < text.length - 1) {
        if (text[endIdx] === '}' && text[endIdx + 1] === '}') {
          break;
        }
        endIdx++;
      }

      if (endIdx < text.length - 1 && text[endIdx] === '}' && text[endIdx + 1] === '}') {
        const name = text.substring(startIdx, endIdx);
        if (name.length > 0 && name in variables) {
          result += variables[name];
        } else {
          // Leave as-is if not found
          result += text.substring(i, endIdx + 2);
        }
        i = endIdx + 2;
      } else {
        result += text[i];
        i++;
      }
    } else {
      result += text[i];
      i++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Render Template
// ---------------------------------------------------------------------------

/**
 * Render a template with the given variables.
 *
 * Rules:
 *   1. Validate all placeholders are provided and no unknown variables exist
 *   2. If validation fails, return null (caller must handle)
 *   3. If validation passes, replace all {{PLACEHOLDER}} tokens
 *   4. Return rendered subject and body
 *
 * No AI. No dynamic rewriting. No fuzzy matching.
 * Deterministic string substitution only.
 * ASCII-only replacement.
 *
 * Returns TemplateRenderResult or null if validation fails.
 * Deterministic — same inputs always produce same output.
 */
export function renderTemplate(
  template: TemplateVersion,
  variables: Record<string, string>
): TemplateRenderResult | null {
  // Validate first
  const validation = validateTemplateRender(template, variables);
  if (validation.result === 'FAIL') {
    return null;
  }

  // Render subject and body
  const renderedSubject = replacePlaceholders(template.subject, variables);
  const renderedBody = replacePlaceholders(template.body, variables);

  return {
    subject: renderedSubject,
    body: renderedBody,
  };
}

// ---------------------------------------------------------------------------
// Enforce Template Render Gate — Binary PASS/FAIL
// ---------------------------------------------------------------------------

/**
 * Binary enforcement gate for template rendering.
 *
 * PASS: template can be rendered with given variables.
 * FAIL: missing placeholders or unknown variables.
 *
 * No bypass. No warning mode.
 * Deterministic — same inputs always produce same result.
 */
export function enforceTemplateRenderGate(
  template: TemplateVersion,
  variables: Record<string, string>
): 'PASS' | 'FAIL' {
  const validation = validateTemplateRender(template, variables);
  return validation.result;
}
