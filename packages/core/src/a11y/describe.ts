import type {
  Action,
  DataFlowSpec,
  Node,
  ObjectContent,
  Packet,
} from '../types';
import type { Timeline } from '../engine/timeline';
import type { PlayerLabels } from '../dom/labels';

/**
 * The animation, rendered as sentences instead of pixels.
 *
 * This is the second renderer. `mountStage` turns a compiled timeline into a
 * moving picture; this turns the SAME timeline into an ordered text, and the
 * two are views of one source rather than a picture and a caption someone has
 * to keep in sync. Nothing here touches the DOM, and nothing here reads a
 * clock: given a spec it returns the whole script, exactly like
 * `evaluate(timeline, t)` returns the whole visual state — which is what makes
 * it testable and what lets a caller export the description, print it, or feed
 * it to a braille display without mounting anything.
 *
 * WHAT IT DESCRIBES, and what it deliberately does not: the events, never the
 * geometry. "GET /users travels from Browser to Web server" is the information;
 * the bezier it travelled along, the lane it sat in and the pixel it stopped at
 * are the sighted encoding OF that information, and repeating them would
 * describe the drawing rather than the subject. The one exception is colour in
 * `circuit` diagrams, where a wire's tint identifies its net — there the colour
 * IS data, and `set_color` says so.
 */

/** One root step of the timeline, as the control bar counts them. */
export interface DescribedStep {
  /**
   * Index into `spec.timeline`, which the compiler keeps one-to-one with
   * `timeline.steps` — one root action, one navigable step, one sentence here.
   */
  index: number;
  /** Instant the step starts at, in ms: what a caller seeks to. */
  startMs: number;
  /** The step, in one or more sentences. Never empty. */
  text: string;
}

export interface AnimationDescription {
  /**
   * What the animation is, before any step is read: its title if the spec
   * carries one, the cast of elements, and how many steps there are. A reader
   * who wants nothing more stops here.
   */
  summary: string;
  steps: DescribedStep[];
}

/** Replaces every `{key}` in a template with the matching value. */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? vars[key] : whole
  );
}

/**
 * Fills a counted template, taking the singular form at exactly one.
 *
 * Two whole templates rather than an inflection rule: a count is embedded in a
 * sentence, and which words around it change is the translator's business, not
 * something a suffix rule can decide from English.
 */
function fillCount(
  plural: string,
  singular: string,
  key: string,
  count: number,
  extra: Record<string, string> = {}
): string {
  return fill(count === 1 ? singular : plural, {
    ...extra,
    [key]: String(count),
  });
}

/** Ends a fragment with a period unless it already ends in punctuation. */
function sentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  return /[.!?…:;]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Collapses whitespace and clips overlong content to one readable clause. */
function condense(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/**
 * How an element is called out loud.
 *
 * Falls back to the id, and that fallback is load-bearing rather than
 * defensive: an unlabelled node is invisible to a sighted viewer too, but its
 * id is the only handle anyone has on it — silence would drop the element from
 * the story entirely.
 */
function nodeName(node: Node | undefined, id: string): string {
  const text = node?.text?.trim();
  return text && isSpeakable(text) ? text : id;
}

/**
 * Whether a string can serve as a NAME when spoken.
 *
 * A label made only of spaces, punctuation or symbols is not a name: a screen
 * reader verbalises each character, so `" "` is announced "space" and `"→"`
 * "right arrow" — the listener learns nothing about what just moved. Requiring
 * one letter or digit is what separates a label from a decoration.
 */
function isSpeakable(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

/**
 * What KIND of thing a packet is, when nothing it carries can name it.
 *
 * The fallback used to be the packet's id, and an id is a name for the author,
 * not for the listener: `"rows travels from Database to API"` says nothing,
 * while `"a SQL response of 12 rows travels from Database to API"` says
 * exactly what moved. An id is a last resort below this, not above it.
 */
function packetKindName(packet: Packet, labels: PlayerLabels): string {
  switch (packet.kind) {
    case 'http_packet':
      return labels.describePacketHttp;
    case 'sql_request':
      return labels.describePacketSqlRequest;
    case 'sql_response': {
      const rows = packet.response_content?.rows;
      return rows === undefined
        ? labels.describePacketSqlResponse
        : fillCount(
            labels.describePacketRows,
            labels.describePacketRowsOne,
            'rows',
            rows
          );
    }
    case 'subicon':
      return labels.describePacketBadge;
    default:
      return labels.describePacketPanel;
  }
}

/**
 * How a packet is called out loud, taken from whichever content field its
 * `kind` actually fills — the header of an HTTP packet, the SQL of a request,
 * the badge of a travelling `subicon`. Failing all of those, what it IS.
 */
function packetName(
  packet: Packet | undefined,
  id: string,
  labels: PlayerLabels
): string {
  if (!packet) return id;
  const candidates = [
    packet.packet_content?.header,
    packet.request_content,
    packet.response_content?.header,
    packet.header,
    packet.body,
    packet.icon,
  ];
  for (const candidate of candidates) {
    const text = candidate?.trim();
    if (text && isSpeakable(text)) return condense(text, 40);
  }
  return packetKindName(packet, labels);
}

/** Resolves a `"node"` or `"node:pin"` reference to the node's spoken name. */
function refName(ref: string, nodes: Map<string, Node>): string {
  const id = ref.split(':')[0];
  return nodeName(nodes.get(id), id);
}

interface Cast {
  nodes: Map<string, Node>;
  packets: Map<string, Packet>;
  /** Connection ids, so `highlight`/`set_color` can tell a wire from a node. */
  connections: Set<string>;
}

/** Names whatever `object` points at — a node, a packet, or a connection. */
function objectName(id: string, cast: Cast, labels: PlayerLabels): string {
  const node = cast.nodes.get(id);
  if (node) return nodeName(node, id);
  const packet = cast.packets.get(id);
  if (packet) return packetName(packet, id, labels);
  if (cast.connections.has(id)) return fill(labels.describeConnection, { id });
  return id;
}

/** The content a `set_content` puts on a node, as one spoken clause. */
function contentName(content: ObjectContent, labels: PlayerLabels): string {
  const { type, value, url, columns, rows_data: rows } = content;
  if (type === 'image') return labels.describeContentImage;
  if (type === 'table') {
    return fillCount(
      labels.describeContentTable,
      labels.describeContentTableOne,
      'rows',
      rows?.length ?? 0,
      { columns: (columns ?? []).join(', ') }
    );
  }
  const text = value?.trim();
  if (!text) return url?.trim() ?? labels.describeContentEmpty;
  return condense(text);
}

/**
 * One action, in one sentence.
 *
 * A `parallel` folds its children into a single "at the same time" clause
 * rather than a nested list: the simultaneity is the point, and a reader who
 * hears three sentences in a row cannot tell them from three steps.
 */
function describeAction(
  action: Action,
  cast: Cast,
  labels: PlayerLabels
): string {
  const name = (id: string): string => objectName(id, cast, labels);

  switch (action.type) {
    case 'move':
      return fill(labels.describeMove, {
        object: name(action.object),
        from: name(action.from),
        to: name(action.to),
      });

    case 'arrow': {
      const text = action.text?.trim();
      const template = text
        ? labels.describeArrowLabelled
        : labels.describeArrow;
      return fill(template, {
        from: name(action.from),
        to: name(action.to),
        text: text ?? '',
      });
    }

    case 'parallel': {
      const parts = action.actions
        .map((child) => describeAction(child, cast, labels))
        .filter((part) => part !== '');
      if (parts.length === 0) return '';
      return fill(labels.describeParallel, { actions: parts.join(' ') });
    }

    case 'loading':
      return fill(labels.describeLoading, { object: name(action.object) });

    case 'set_content':
      return fill(labels.describeSetContent, {
        object: name(action.object),
        content: contentName(action.content, labels),
      });

    case 'comment':
      // The comment is ALREADY the author's own narration of the step — the
      // sentence they wrote for the sighted viewer. It is repeated verbatim,
      // never paraphrased.
      return action.object === undefined
        ? sentence(action.text)
        : fill(labels.describeCommentOn, {
            object: name(action.object),
            text: action.text.trim(),
          });

    case 'highlight':
      return fill(labels.describeHighlight, { object: name(action.object) });

    case 'set_visible':
      return fill(
        action.visible ? labels.describeAppear : labels.describeDisappear,
        { object: name(action.object) }
      );

    case 'set_color':
      return fill(labels.describeSetColor, { object: name(action.object) });

    case 'set_icon': {
      const icon = action.icon.trim();
      return fill(icon ? labels.describeSetIcon : labels.describeClearIcon, {
        object: name(action.object),
        icon,
      });
    }

    case 'rotate':
      return fill(action.spin ? labels.describeSpin : labels.describeRotate, {
        object: name(action.object),
      });

    case 'rotate_subtree':
      return fill(labels.describeRotateSubtree, {
        object: name(action.object),
      });

    case 'flow': {
      const route = action.route.map((ref) => refName(ref, cast.nodes));
      return fill(labels.describeFlow, { route: route.join(' → ') });
    }

    case 'toggle':
      return fill(
        action.closed ? labels.describeToggleClosed : labels.describeToggleOpen,
        { object: name(action.object) }
      );

    case 'wait':
      return labels.describePause;
  }
}

/**
 * The whole animation as an ordered text.
 *
 * `timeline` is passed in rather than compiled here for one reason: the player
 * has already compiled it, and compiling a second time would let the two copies
 * disagree about where a step starts — which is exactly the number a caller
 * seeks to when the reader activates a step.
 */
export function describeAnimation(
  spec: DataFlowSpec,
  timeline: Timeline,
  labels: PlayerLabels
): AnimationDescription {
  const cast: Cast = {
    nodes: new Map(spec.nodes.map((node) => [node.id, node])),
    packets: new Map(spec.packets.map((packet) => [packet.id, packet])),
    connections: new Set(
      (spec.connections ?? [])
        .map((connection) => connection.id)
        .filter((id): id is string => id !== undefined)
    ),
  };

  const steps: DescribedStep[] = [];
  spec.timeline.forEach((action, index) => {
    const step = timeline.steps[index];
    if (!step) return;
    // An author's own words win over the generated sentence: they know why the
    // step exists, and the spec only knows what it does.
    const authored = action.description?.trim();
    const text = sentence(authored || describeAction(action, cast, labels));
    if (text === '') return;
    steps.push({ index, startMs: step.startMs, text });
  });

  const actors = spec.nodes
    .filter((node) => node.visible !== false)
    .map((node) => nodeName(node, node.id));

  const summaryParts = [
    spec.description?.trim(),
    actors.length > 0
      ? fill(labels.describeActors, { list: actors.join(', ') })
      : '',
    fillCount(
      labels.describeStepCount,
      labels.describeStepCountOne,
      'count',
      steps.length
    ),
  ]
    .map((part) => sentence(part ?? ''))
    .filter((part) => part !== '');

  return { summary: summaryParts.join(' '), steps };
}
