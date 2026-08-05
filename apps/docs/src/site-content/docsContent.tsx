/* eslint-disable react-refresh/only-export-components -- module de contenu (données + rendu), pas un module HMR */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Heading from '@theme/Heading';
import { NodeView, dataFlowSchema } from '@dataflow-animator/react';
import type { DataFlowSpec, Node, NodeType } from '@dataflow-animator/react';
import { DataFlowPlayer } from '../components/DataFlowPlayer';
import { getApiExamples } from './apiExamples';
import { useLocale, useTranslation } from '../i18n';

// ---------------------------------------------------------------------------
// Référence API générée à partir du JSON Schema
// ---------------------------------------------------------------------------

interface SchemaNode {
  // Un tableau pour une union (`"type": ["string", "number"]`).
  type?: string | string[];
  const?: string;
  title?: string;
  description?: string;
  enum?: readonly string[];
  examples?: readonly unknown[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  required?: readonly string[];
  $ref?: string;
  allOf?: readonly SchemaNode[];
}

const defs = (
  dataFlowSchema as unknown as { definitions: Record<string, SchemaNode> }
).definitions;
const root = defs.DataFlowSpec;

// ---------------------------------------------------------------------------
// Aperçus des types de nœud, rendus par le composant réel (NodeView) et injectés
// DANS la ligne `type` du tableau Node (jamais une section à part) : complément
// visuel à la spec. Pilotés par l'énum du schéma → un nouveau type apparaît seul.
// ---------------------------------------------------------------------------

/** Échantillons soignés pour les panneaux et les formes (sinon `body` = le nom
 *  du type). Court par construction : le `body` d'une forme ne doit pas déborder. */
const NODE_SAMPLES: Partial<Record<NodeType, Pick<Node, 'header' | 'body'>>> = {
  simple_node: { body: 'Worker' },
  complex_node: { header: 'POST /login', body: '200 OK' },
  square: { body: 'API' },
  diamond: { body: '?' },
  circle: { body: 'Start' },
  triangle: { body: 'Run' },
  parallelogram: { body: 'I/O' },
  height_rectangle: { body: 'Queue' },
  width_rectangle: { body: 'Bus' },
  star: { body: 'New' },
};

function nodeSample(type: NodeType): Node {
  // `body` par défaut = nom du type : un futur nœud-panneau ou forme sans
  // échantillon dédié s'affiche quand même (les pictogrammes ignorent `body`).
  return { id: type, type, body: type, ...NODE_SAMPLES[type] };
}

/**
 * Ne monte ses enfants que lorsqu'ils approchent du viewport, et les démonte en
 * sortant. La page de référence porte ~40 players ; sans ce gardiennage, tous
 * les players animés (autoplay/loop) feraient tourner leur boucle rAF en
 * permanence.
 *
 * IMPORTANT : la HAUTEUR est réservée par CE conteneur, pas par un wrapper
 * interne — il occupe donc la même boîte que le player soit monté ou non. Sinon,
 * en scrollant, chaque montage/démontage changerait la hauteur de la ligne. La
 * largeur, elle, vient de la colonne (`table-layout: fixed`, cf. CSS
 * `.api-col-*`) : elle ne dépend plus de ce qui est monté dans la cellule.
 */
function InView({
  className,
  height,
  children,
}: {
  className: string;
  height: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => setShown(entries.some((e) => e.isIntersecting)),
      { rootMargin: '250px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{ height }}>
      {shown ? children : null}
    </div>
  );
}

/**
 * Démo d'une propriété : un VRAI `<DataFlowPlayer>` rendant une spec qui isole
 * l'effet de la propriété. Une spec avec timeline est jouée en boucle (le
 * comportement doit être visible) ; sinon c'est un aperçu statique. La taille du
 * cadre et l'échelle dépendent du nombre de nœuds — l'auto-scaler du Stage vise
 * un grand canevas et rapetisse trop un aperçu, donc on force `--rdfa-scale` via
 * une classe (cf. CSS `.api-prop-demo--*`).
 */
function PropDemo({ spec, note }: { spec: DataFlowSpec; note?: string }) {
  const animated = spec.timeline.length > 0;
  const n = spec.nodes.length;
  const sizeClass =
    n <= 1
      ? 'api-prop-demo--single'
      : n <= 2
        ? 'api-prop-demo--pair'
        : 'api-prop-demo--multi';
  const height = n <= 1 ? 188 : n <= 2 ? 166 : 196;
  return (
    <div className={`api-prop-demo ${sizeClass}`}>
      <InView className="api-prop-demo-stage" height={height}>
        <DataFlowPlayer
          spec={spec}
          controls={false}
          autoPlay={animated}
          loop={animated}
          height={height}
          mode="auto"
        />
      </InView>
      {note ? (
        <p className="api-prop-demo-note">{renderInlineMarkdown(note)}</p>
      ) : null}
    </div>
  );
}

function refName(ref: string): string {
  return ref.replace('#/definitions/', '');
}

/** Rend le markdown inline des descriptions du schéma : `code`, **gras** et les
 *  `{@link X}` JSDoc (laissés tels quels par le générateur) → `code`. Les
 *  descriptions viennent du JSON Schema sous forme de texte brut, donc ce
 *  formatage n'est pas fait par MDX : on le rend nous-mêmes. */
function renderInlineMarkdown(text: string): ReactNode {
  const normalized = text.replace(
    /\{@link\s+([^}]+?)\s*\}/g,
    (_, name: string) => `\`${name.trim()}\``
  );
  const out: ReactNode[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    if (m.index > last) out.push(normalized.slice(last, m.index));
    if (m[1] != null) {
      out.push(
        <code className="inline" key={key++}>
          {m[1]}
        </code>
      );
    } else {
      out.push(<strong key={key++}>{m[2]}</strong>);
    }
    last = re.lastIndex;
  }
  if (last < normalized.length) out.push(normalized.slice(last));
  return out;
}

function typeLabel(node: SchemaNode): string {
  if (node.$ref) {
    const target = defs[refName(node.$ref)];
    return target?.title ?? refName(node.$ref);
  }
  if (node.const) return `"${node.const}"`;
  if (node.enum) return 'enum';
  if (node.type === 'array')
    return `${node.items ? typeLabel(node.items) : 'any'}[]`;
  // Union : sans ce cas, le tableau était rendu par React tel quel, membres
  // collés (« stringnumber »).
  if (Array.isArray(node.type)) return node.type.join(' | ');
  return node.type ?? 'object';
}

// Définitions qui ont leur propre section dans <ApiReference/> : un type qui les
// référence devient un lien d'ancrage. Les autres réfs (PacketContent, Zone, les
// énums…) n'ont pas de section et restent en texte simple.
const SECTION_ANCHORS: Record<string, string> = {
  Node: 'api-node',
  Connection: 'api-connection',
  Packet: 'api-packet',
  ObjectContent: 'api-content',
  Action: 'api-actions',
};

/** Un nom de type en PascalCase (`HighlightLanguage`) ou un discriminant
 *  (`"set_content"`) est UN seul mot pour le moteur de retour à la ligne : dans la
 *  colonne Type, étroite, il se couperait n'importe où (« Highligh / tLanguag /
 *  e »). `<wbr>` offre une coupure entre les mots — avant une majuscule, après un
 *  souligné — et n'ajoute rien au texte copié. La colonne est dimensionnée pour
 *  le plus long de ces MOTS, pas pour le plus long label. */
function withWordBreaks(label: string): ReactNode[] {
  return label
    .split(/(?=[A-Z])|(?<=_)/)
    .flatMap((word, i) => (i === 0 ? [word] : [<wbr key={i} />, word]));
}

/** Rend le type d'un champ ; si c'est une réf. vers une définition documentée,
 *  le rend cliquable vers sa section. Les tableaux relaient sur le type d'item
 *  (`Node[]` → lien sur `Node`). */
function TypeCell({ node }: { node: SchemaNode }): ReactNode {
  if (node.type === 'array' && node.items) {
    return (
      <>
        <TypeCell node={node.items} />
        {/* Sans ce `<wbr>`, `Connection[]` est un mot insécable de plus que la
            colonne : il se couperait au milieu du nom plutôt qu'avant les crochets. */}
        <wbr />
        []
      </>
    );
  }
  if (node.$ref) {
    const name = refName(node.$ref);
    const label = defs[name]?.title ?? name;
    const anchor = SECTION_ANCHORS[name];
    return anchor ? (
      <a className="api-type-link" href={`#${anchor}`}>
        {withWordBreaks(label)}
      </a>
    ) : (
      <>{withWordBreaks(label)}</>
    );
  }
  return <>{withWordBreaks(typeLabel(node))}</>;
}

interface Row {
  name: string;
  node: SchemaNode;
  required: boolean;
}

/** Aplati les propriétés d'une définition (résout allOf = champs communs). */
function rowsOf(node: SchemaNode): Row[] {
  const required = new Set<string>(node.required ?? []);
  const collected: Record<string, SchemaNode> = {};
  for (const part of node.allOf ?? []) {
    const target = part.$ref ? defs[refName(part.$ref)] : part;
    Object.assign(collected, target?.properties);
    for (const r of target?.required ?? []) required.add(r);
  }
  Object.assign(collected, node.properties);
  return Object.entries(collected).map(([name, n]) => ({
    name,
    node: n,
    required: required.has(name),
  }));
}

function PropsTable({ node, defName }: { node: SchemaNode; defName: string }) {
  const t = useTranslation();
  const locale = useLocale();
  const { specs, notes } = getApiExamples(locale);
  const rows = rowsOf(node);
  // Chaque exemple est un player démontrant la propriété (registre `apiExamples`,
  // clé `${defName}.${prop}`). Les énums (options acceptées) restent dans la
  // Description. Si aucun champ de la table n'a de démo, pas de colonne Exemples.
  const demoOf = (row: Row): DataFlowSpec | undefined =>
    specs[`${defName}.${row.name}`];
  const noteOf = (row: Row): string | undefined =>
    notes[`${defName}.${row.name}`];
  const hasExamples = rows.some((row) => demoOf(row) != null);
  // Le wrapper est le CONTENEUR de requête (cf. CSS `.api-table-wrap`) : la
  // largeur disponible dépend de la sidebar ET du sommaire de droite, qui
  // apparaissent à des largeurs de viewport différentes — seule la largeur réelle
  // du conteneur dit si les 4 colonnes tiennent. Les `<col>` portent ces largeurs
  // (`table-layout: fixed`) pour que rien ne puisse dépasser horizontalement.
  return (
    <div className="api-table-wrap">
      <table className="api-table">
        <colgroup>
          <col className="api-col-name" />
          <col className="api-col-type" />
          <col className="api-col-desc" />
          {hasExamples ? <col className="api-col-demo" /> : null}
        </colgroup>
        <thead>
          <tr>
            <th>{t.apiRef.property}</th>
            <th>Type</th>
            <th>Description</th>
            {hasExamples ? <th>{t.apiRef.examples}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const enumValues = row.node.$ref
              ? defs[refName(row.node.$ref)]?.enum
              : row.node.enum;
            // La galerie des `NodeType` reste INLINE dans la Description
            // (exception demandée). Les autres énums (options acceptées)
            // s'affichent aussi dans la Description ; seule la colonne
            // « Exemples » porte démos + `@example`.
            const isNodeType =
              row.node.$ref != null && refName(row.node.$ref) === 'NodeType';
            return (
              <tr key={row.name} id={`api-${defName}-${row.name}`}>
                <td className="name">
                  <a
                    className="api-prop-anchor"
                    href={`#api-${defName}-${row.name}`}
                    aria-label={t.apiRef.linkTo(row.name)}
                  >
                    #
                  </a>
                  {row.name}
                  {row.required ? <span className="api-req"> *</span> : null}
                </td>
                <td>
                  <span className="api-type">
                    <TypeCell node={row.node} />
                  </span>
                </td>
                <td>
                  {renderInlineMarkdown(row.node.description ?? '')}
                  {enumValues ? (
                    isNodeType ? (
                      <div
                        className="rdfa-player api-node-enum"
                        data-mode="auto"
                      >
                        {enumValues.map((v) => (
                          <div className="api-node-enum-item" key={v}>
                            <div className="api-node-enum-visual">
                              <NodeView node={nodeSample(v as NodeType)} />
                            </div>
                            <code className="api-enum">{v}</code>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="api-enum-list">
                        {enumValues.map((v) => (
                          <span className="api-enum" key={v}>
                            {v}
                          </span>
                        ))}
                      </div>
                    )
                  ) : null}
                </td>
                {hasExamples ? (
                  <td>
                    {demoOf(row) ? (
                      <PropDemo spec={demoOf(row)!} note={noteOf(row)} />
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const ACTION_DEFS = [
  'MoveAction',
  'ArrowAction',
  'ParallelAction',
  'LoadingAction',
  'SetContentAction',
  'CommentAction',
  'HighlightAction',
  'RotateAction',
] as const;

/** Discriminant `type` affiché pour une action (fallback : nom de la définition). */
function actionTypeLabel(key: (typeof ACTION_DEFS)[number]): string {
  return defs[key].properties?.['type']?.const ?? key;
}

export function ApiReference() {
  const t = useTranslation();
  // Le browser tente le scroll vers le hash avant que React ait rendu le
  // contenu dynamique. On relit le hash après hydration et on force le scroll.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ block: 'start' });
  }, []);

  return (
    <>
      <Heading as="h2" id="api-dataflowspec">
        DataFlowSpec
      </Heading>
      <p>{renderInlineMarkdown(t.apiRef.rootIntro)}</p>
      <PropsTable node={root} defName="DataFlowSpec" />

      <Heading as="h2" id="api-node">
        Node
      </Heading>
      <p>{renderInlineMarkdown(t.apiRef.nodeIntro)}</p>
      <PropsTable node={defs.Node} defName="Node" />

      <Heading as="h2" id="api-connection">
        Connection
      </Heading>
      <p>{renderInlineMarkdown(t.apiRef.connectionIntro)}</p>
      <PropsTable node={defs.Connection} defName="Connection" />

      <Heading as="h2" id="api-packet">
        Packet
      </Heading>
      <p>{renderInlineMarkdown(t.apiRef.packetIntro)}</p>
      <PropsTable node={defs.Packet} defName="Packet" />

      <Heading as="h2" id="api-content">
        ObjectContent
      </Heading>
      <PropsTable node={defs.ObjectContent} defName="ObjectContent" />

      <Heading as="h2" id="api-actions">
        Actions
      </Heading>
      <p>{renderInlineMarkdown(t.apiRef.actionsIntro)}</p>
      {ACTION_DEFS.map((key) => {
        const node = defs[key];
        return (
          <div key={key} className="api-subsection">
            <Heading as="h3" id={`api-${key}`}>
              {actionTypeLabel(key)}
            </Heading>
            {node.description ? (
              <p>{renderInlineMarkdown(node.description)}</p>
            ) : null}
            <PropsTable node={node} defName={key} />
          </div>
        );
      })}
    </>
  );
}

interface TocItem {
  readonly value: string;
  readonly id: string;
  readonly level: number;
}

/**
 * Table des matières de la page « Référence API ». Ses titres sont rendus par
 * <ApiReference/> en JSX, donc invisibles pour le générateur de TOC de
 * Docusaurus (qui ne lit que les titres Markdown du source MDX). On la fournit
 * explicitement : `api.mdx` la réexporte en `toc`, et Docusaurus respecte un
 * export `toc` manuel sans l'écraser. La partie « actions » dérive des mêmes
 * `ACTION_DEFS` que le rendu pour ne pas se désynchroniser.
 */
export const apiReferenceToc: TocItem[] = [
  { value: 'DataFlowSpec', id: 'api-dataflowspec', level: 2 },
  { value: 'Node', id: 'api-node', level: 2 },
  { value: 'Connection', id: 'api-connection', level: 2 },
  { value: 'Packet', id: 'api-packet', level: 2 },
  { value: 'ObjectContent', id: 'api-content', level: 2 },
  { value: 'Actions', id: 'api-actions', level: 2 },
  ...ACTION_DEFS.map((key) => ({
    value: actionTypeLabel(key),
    id: `api-${key}`,
    level: 3,
  })),
];
