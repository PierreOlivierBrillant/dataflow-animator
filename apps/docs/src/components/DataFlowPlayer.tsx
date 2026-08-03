import { DataFlowPlayer as Player } from '@dataflow-animator/react';
import type { DataFlowPlayerProps } from '@dataflow-animator/react';
import { useTranslation } from '../i18n';

/**
 * The site-wide `<DataFlowPlayer>`: the React binding with its chrome localised
 * to the current Docusaurus locale.
 *
 * Every player the site renders — TSX components and MDX pages alike — imports
 * THIS wrapper instead of `@dataflow-animator/react`. That is the bilingual
 * hard rule applied to the player chrome with one injection point, rather than
 * a `labels` prop to keep in sync at every call site. The name is kept on
 * purpose so the live demos read like the code blocks next to them.
 *
 * An explicit `labels` prop on a call site still wins: it spreads after the
 * dictionary's.
 */
export function DataFlowPlayer(props: DataFlowPlayerProps) {
  const t = useTranslation();
  return <Player labels={t.player} {...props} />;
}
