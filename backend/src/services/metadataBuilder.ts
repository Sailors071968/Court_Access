// ============================================================================
// Metadata Builder (Schema-Safe Embedding)
// ============================================================================

export function buildMetadataPrefix(data: Record<string, any>): string {
  try {
    return JSON.stringify(data) + " ";
  } catch {
    return "";
  }
}
