/**
 * Demos covering risk areas: set_content (spa, messageQueue), dense
 * move (clientServer), parallel composition (microservices), tight layout
 * case (collision), tree layout (avlTree). Shared by every harness-based gate
 * (visual-regression goldens, A/B self-test, mount-vs-update, element) so
 * extending the list is one edit, not four copies to keep in sync.
 *
 * WHY A TREE DEMO IS IN THE LIST. Every other entry is a linear or graph
 * layout, whose edges all come from `connections[]`. `direction: 'tree'` is a
 * second, independent path: the parent→child edges are DERIVED from `tree`
 * rather than declared, so nothing in `connections[]` covers them. That gap is
 * not hypothetical — the vanilla renderer shipped without drawing those edges
 * at all (lost with the React renderer in cf96860) and all five demos above
 * stayed green through it. `avlTree` exercises the whole tree path in one
 * spec: auto-drawn edges, a `set_visible` reveal with its staggered edge
 * draw-in, and a `rotate_subtree` reflow that interpolates placements.
 */
export const RISK_DEMOS = [
  'spa',
  'clientServer',
  'messageQueue',
  'microservices',
  'collision',
  'avlTree',
] as const;
