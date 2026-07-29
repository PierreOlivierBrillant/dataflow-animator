/**
 * Demos covering risk areas: set_content (spa, messageQueue), dense
 * move (clientServer), parallel composition (microservices), tight layout
 * case (collision). Shared by every harness-based gate (visual-regression
 * goldens, A/B self-test, A/B compare) so extending the list is one edit,
 * not three copies to keep in sync.
 */
export const RISK_DEMOS = [
  'spa',
  'clientServer',
  'messageQueue',
  'microservices',
  'collision',
] as const;
