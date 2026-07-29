/* eslint-disable react-refresh/only-export-components -- module de contenu (données + rendu), pas un module HMR */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Heading from '@theme/Heading';
import {
  DataFlowPlayer,
  NodeView,
  dataFlowSchema,
} from '@dataflow-animator/react';
import type { DataFlowSpec, Node, NodeType } from '@dataflow-animator/react';
import { demosById, getSpec } from './demos';
import { getApiExamples } from './apiExamples';
import { useLocale, useTranslation } from '../i18n';

// Lecteur d'une démo référencée par id, avec spec résolue selon la locale
// courante (les specs peuvent être des builders localisés).
function DemoPlayer({ demoId }: { demoId: string }) {
  const locale = useLocale();
  return (
    <DataFlowPlayer mode="auto" spec={getSpec(demosById[demoId], locale)} />
  );
}

interface DocPage {
  id: string;
  label: string;
  group: string;
  title: string;
  render: () => ReactNode;
}

const install = `npm install @dataflow-animator/react`;

const usage = `import { DataFlowPlayer } from '@dataflow-animator/react';
import '@dataflow-animator/core/styles.css';

<DataFlowPlayer spec={spec} />`;

// ---------------------------------------------------------------------------
// Référence API générée à partir du JSON Schema
// ---------------------------------------------------------------------------

interface SchemaNode {
  type?: string;
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
 * IMPORTANT : la classe de taille (largeur + hauteur fixes) est portée par CE
 * conteneur, pas par un wrapper interne — il occupe donc la MÊME boîte que le
 * player soit monté ou non. Sinon, en scrollant, chaque montage/démontage
 * changerait la largeur de la cellule et le tableau se réagencerait (bug visuel).
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

/** Rend le type d'un champ ; si c'est une réf. vers une définition documentée,
 *  le rend cliquable vers sa section. Les tableaux relaient sur le type d'item
 *  (`Node[]` → lien sur `Node`). */
function TypeCell({ node }: { node: SchemaNode }): ReactNode {
  if (node.type === 'array' && node.items) {
    return (
      <>
        <TypeCell node={node.items} />
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
        {label}
      </a>
    ) : (
      <>{label}</>
    );
  }
  return <>{typeLabel(node)}</>;
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
  return (
    <table className="api-table">
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
          // La galerie des `NodeType` reste INLINE dans la Description (exception
          // demandée). Les autres énums (options acceptées) s'affichent aussi dans
          // la Description ; seule la colonne « Exemples » porte démos + `@example`.
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
                    <div className="rdfa-player api-node-enum" data-mode="auto">
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

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export const docPages: DocPage[] = [
  {
    id: 'introduction',
    label: 'Introduction',
    group: 'Démarrer',
    title: 'Introduction',
    render: () => (
      <>
        <p className="docs-lead">
          React DataFlow Animator compile une spécification JSON en une
          animation déterministe et navigable de flux de données.
        </p>
        <h2 id="apercu">Aperçu</h2>
        <p>
          Tu décris des <strong>nœuds</strong> (statiques), des{' '}
          <strong>paquets</strong> (dynamiques) et une liste d’
          <strong>actions</strong>. Le moteur place les nœuds, trace les
          connexions et joue les actions sur une chronologie.
        </p>
        <DemoPlayer demoId="clientServer" />
        <h2 id="principes">Principes</h2>
        <ul>
          <li>
            Le temps est l’unique source de vérité (moteur déterministe, sans
            GSAP).
          </li>
          <li>Aucune coordonnée à fournir : placement automatique.</li>
          <li>SSR-safe : s’intègre directement dans Docusaurus.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'installation',
    label: 'Installation',
    group: 'Démarrer',
    title: 'Installation',
    render: () => (
      <>
        <p className="docs-lead">
          React 18 ou 19 est requis (peer dependency).
        </p>
        <h2 id="npm">Installation npm</h2>
        <pre className="code">{install}</pre>
        <h2 id="utilisation">Utilisation</h2>
        <pre className="code">{usage}</pre>
        <h2 id="docusaurus">Docusaurus</h2>
        <p>
          Le composant est SSR-safe. Importe le CSS une fois (par ex. dans{' '}
          <code className="inline">src/css/custom.css</code>) puis utilise{' '}
          <code className="inline">&lt;DataFlowPlayer /&gt;</code> dans
          n’importe quel fichier <code className="inline">.mdx</code>.
        </p>
      </>
    ),
  },
  {
    id: 'layout',
    label: 'Disposition',
    group: 'Concepts',
    title: 'Disposition (layout)',
    render: () => (
      <>
        <p className="docs-lead">
          Les nœuds sont placés sans coordonnées, via{' '}
          <code className="inline">direction</code> et{' '}
          <code className="inline">lane</code>.
        </p>
        <h2 id="lanes">Grilles & lanes</h2>
        <p>
          En <code className="inline">left-to-right</code>,{' '}
          <code className="inline">lane</code> est la colonne (la position le
          long du flux) ; plusieurs nœuds d’une même lane sont empilés sur l’axe
          transverse. Les directions{' '}
          <code className="inline">right-to-left</code>,{' '}
          <code className="inline">top-to-bottom</code> et{' '}
          <code className="inline">bottom-to-top</code> inversent/échangent les
          axes.
        </p>
        <h2 id="alignement">Alignement entre lanes</h2>
        <p>
          <code className="inline">align_with</code> aligne un nœud sur l’axe
          transverse d’un autre (vertical si la direction est horizontale) —
          utile pour aligner deux nœuds de lanes différentes qui ne tomberaient
          pas naturellement en face l’un de l’autre.
        </p>
        <h2 id="circular">Disposition circulaire</h2>
        <p>
          En <code className="inline">circular</code>, le nœud{' '}
          <code className="inline">main</code> est au centre et les autres sont
          répartis sur un cercle.
        </p>
        <DemoPlayer demoId="circular" />
      </>
    ),
  },
  {
    id: 'timeline',
    label: 'Timeline & étapes',
    group: 'Concepts',
    title: 'Timeline & navigation par étapes',
    render: () => (
      <>
        <p className="docs-lead">
          Les actions racines sont jouées séquentiellement ; chacune devient une
          étape logique.
        </p>
        <h2 id="arrets">Points d’arrêt</h2>
        <p>
          La navigation Précédent/Suivant s’arrête sur des{' '}
          <strong>points d’arrêt</strong> (marques de la timeline). Un{' '}
          <code className="inline">move</code> en produit deux : à l’apparition
          du paquet et à son arrivée.
        </p>
        <h2 id="pause">Pause entre étapes</h2>
        <p>
          Une courte pause sépare deux étapes pour que chaque arrêt montre
          l’étape « posée » seule, sans chevaucher l’apparition de la suivante.
        </p>
        <h2 id="wait-for">Synchronisation (wait_for)</h2>
        <p>
          Une action peut démarrer à la <em>fin</em> d’une autre via{' '}
          <code className="inline">wait_for</code> (par ID), pour des séquences
          asynchrones (ex: attendre la fin d’un{' '}
          <code className="inline">loading</code>).
        </p>
      </>
    ),
  },
  {
    id: 'lifecycle',
    label: 'Cycle de vie',
    group: 'Concepts',
    title: 'Cycle de vie des éléments',
    render: () => (
      <>
        <p className="docs-lead">
          Par défaut, un élément temporaire disparaît à la fin de son animation.
          Deux mécanismes prolongent sa visibilité.
        </p>
        <h2 id="keep-until-next">keep_until_next</h2>
        <p>
          Maintient l’élément visible jusqu’au{' '}
          <strong>début de l’étape racine suivante</strong> (donc à travers la
          pause inter-étapes). Valeurs par défaut :
        </p>
        <ul>
          <li>
            <code className="inline">false</code> pour{' '}
            <code className="inline">move</code> et{' '}
            <code className="inline">loading</code> ;
          </li>
          <li>
            <code className="inline">true</code> pour{' '}
            <code className="inline">arrow</code>,{' '}
            <code className="inline">comment</code> et{' '}
            <code className="inline">set_content</code>.
          </li>
        </ul>
        <p>On peut toujours forcer la valeur explicitement dans l’action.</p>
        <h2 id="keep-until">keep_until</h2>
        <p>
          Maintient l’élément visible jusqu’au <strong>début</strong> de
          l’action ciblée (par ID) — utile pour garder une flèche ou un bloc de
          code à l’écran sur plusieurs étapes.
        </p>
        <h2 id="keep-until-end">keep_until_end</h2>
        <p>
          Booléen : maintient l’élément visible jusqu’à la <strong>fin</strong>{' '}
          de la chronologie.
        </p>
      </>
    ),
  },
  {
    id: 'collision',
    label: 'Connexions & anti-collision',
    group: 'Concepts',
    title: 'Connexions & anti-collision',
    render: () => (
      <>
        <p className="docs-lead">
          Les flèches permanentes (décor) vivent dans le tableau racine{' '}
          <code className="inline">connections</code>.
        </p>
        <h2 id="path-shifting">Voies parallèles</h2>
        <p>
          Quand un segment A↔B est emprunté dans les deux sens (flèches ou
          paquets), le moteur décale automatiquement les trajets sur des voies
          parallèles pour éviter la superposition.
        </p>
        <DemoPlayer demoId="collision" />
      </>
    ),
  },
  {
    id: 'actions',
    label: 'Types d’actions',
    group: 'Référence',
    title: 'Types d’actions',
    render: () => (
      <>
        <p className="docs-lead">Les six actions disponibles.</p>
        <ul>
          <li>
            <strong>move</strong> — déplace un objet dynamique de{' '}
            <code className="inline">from</code> vers{' '}
            <code className="inline">to</code>.
          </li>
          <li>
            <strong>arrow</strong> — trace une flèche animée (styles{' '}
            <code className="inline">solid</code>/
            <code className="inline">dotted</code>/
            <code className="inline">dashed</code>).
          </li>
          <li>
            <strong>parallel</strong> — exécute plusieurs actions au même
            instant.
          </li>
          <li>
            <strong>loading</strong> — spinner de chargement sur un nœud.
          </li>
          <li>
            <strong>set_content</strong> — mute le contenu d’un nœud (code,
            texte, image).
          </li>
          <li>
            <strong>comment</strong> — bulle de texte près d’un nœud.
          </li>
          <li>
            <strong>highlight</strong> — surligne un nœud statique ou une
            connexion (par ID).
          </li>
        </ul>
        <p>
          Voir la <a href="#/docs/api">référence API</a> pour les champs
          détaillés de chaque action.
        </p>
      </>
    ),
  },
  {
    id: 'api',
    label: 'Référence API',
    group: 'Référence',
    title: 'Référence API',
    render: () => <ApiReference />,
  },
];

export const docPagesById = Object.fromEntries(docPages.map((p) => [p.id, p]));
