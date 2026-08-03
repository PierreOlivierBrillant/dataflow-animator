import type { Highlighter } from '../types';
import { h, s, setAttrIfChanged, type Child } from './el';
import type { PlayerLabels } from './labels';

/**
 * Modal window showing the highlighted JSON spec — the port of `JsonDialog.tsx`.
 *
 * Unlike the controls, this is not on the animation path: it is created when the
 * dialog opens and destroyed when it closes, so there is no `create`/`apply`
 * split. The only thing that mutates is the transient "copied" state.
 *
 * It is a proper modal: `Escape` closes it, `Tab` is trapped inside its
 * buttons, focus moves in on open and is restored to the opener on close, and
 * its timer is cleared on teardown.
 *
 * One documented quirk remains: the copy button's `title` stays on
 * `labels.copyToClipboard` while its `aria-label` swaps to `labels.copied` for
 * COPIED_MS, so the two disagree for that window.
 */

export interface JsonDialogOptions {
  json: string;
  /** Syntax highlighting (Prism by default), applied to the `json` language. */
  highlight: Highlighter;
  /** Fully resolved by the caller — `mountPlayer` fills in the defaults. */
  labels: PlayerLabels;
  onCopy(): Promise<void>;
  onDownload(): void;
  onClose(): void;
}

export interface JsonDialogElement {
  readonly el: HTMLElement;
  /** Clears the pending copied-state timer. */
  destroy(): void;
}

/** How long the copy button shows its confirmation. `JsonDialog`'s. */
const COPIED_MS = 1500;

function lineIcon(paths: Child[]): SVGSVGElement {
  const svg = s('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  for (const p of paths) svg.appendChild(p as Node);
  return svg;
}

const copyIcon = (): SVGSVGElement =>
  lineIcon([
    s('rect', { x: '9', y: '9', width: '13', height: '13', rx: '2', ry: '2' }),
    s('path', {
      d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    }),
  ]);

const checkIcon = (): SVGSVGElement =>
  lineIcon([s('path', { d: 'M20 6 9 17l-5-5' })]);

const downloadIcon = (): SVGSVGElement =>
  lineIcon([
    s('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    s('path', { d: 'M7 10l5 5 5-5' }),
    s('path', { d: 'M12 15V3' }),
  ]);

function closeIcon(): SVGSVGElement {
  const svg = s('svg', {
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': 'true',
  });
  svg.appendChild(
    s('path', {
      d: 'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z',
    })
  );
  return svg;
}

export function createJsonDialog(
  options: JsonDialogOptions
): JsonDialogElement {
  const { json, highlight, labels, onCopy, onDownload, onClose } = options;

  // Restored when the dialog is destroyed, so closing returns the user to
  // whatever opened it (the JSON button in the controls bar).
  const opener =
    typeof document !== 'undefined'
      ? (document.activeElement as HTMLElement | null)
      : null;

  const backdrop = h('button', {
    type: 'button',
    class: 'rdfa-dialog-backdrop',
    'aria-label': labels.closeDialog,
    tabindex: '-1',
  });
  backdrop.addEventListener('click', onClose);

  const title = h('span', { class: 'rdfa-dialog-title' }, [labels.jsonSpec]);

  const downloadBtn = h(
    'button',
    {
      type: 'button',
      class: 'rdfa-btn',
      'aria-label': labels.download,
      title: labels.download,
    },
    [downloadIcon()]
  );
  downloadBtn.addEventListener('click', onDownload);

  const copyBtn = h(
    'button',
    {
      type: 'button',
      class: 'rdfa-btn rdfa-copy-btn',
      'aria-label': labels.copy,
      // Constant, unlike the aria-label — reproduced, see the header note.
      title: labels.copyToClipboard,
    },
    [copyIcon()]
  );

  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  const setCopied = (copied: boolean): void => {
    setAttrIfChanged(
      copyBtn,
      'class',
      `rdfa-btn rdfa-copy-btn${copied ? ' rdfa-copied' : ''}`
    );
    setAttrIfChanged(
      copyBtn,
      'aria-label',
      copied ? labels.copied : labels.copy
    );
    copyBtn.replaceChildren(copied ? checkIcon() : copyIcon());
  };
  copyBtn.addEventListener('click', () => {
    void onCopy().then(
      () => {
        setCopied(true);
        clearTimeout(copiedTimer);
        copiedTimer = setTimeout(() => setCopied(false), COPIED_MS);
      },
      () => setCopied(false)
    );
  });

  const closeBtn = h(
    'button',
    {
      type: 'button',
      class: 'rdfa-btn',
      'aria-label': labels.close,
      title: labels.close,
    },
    [closeIcon()]
  );
  closeBtn.addEventListener('click', onClose);

  // The spec routinely overflows the panel, so the `<pre>` scrolls — and a
  // scrollable box that cannot be focused cannot be scrolled with a keyboard at
  // all. `tabindex="0"` makes it a stop, the label gives that stop a name, and
  // the focus trap below lists it at its place in the document order.
  const pre = h('pre', {
    class: 'rdfa-dialog-code rdfa-code',
    tabindex: '0',
    'aria-label': labels.jsonSpec,
  });

  const code = h('code');
  // The React side uses `dangerouslySetInnerHTML` here — the highlighter
  // returns markup by contract, so this is the literal equivalent.
  code.innerHTML = highlight(json, 'json');
  pre.appendChild(code);

  const el = h(
    'div',
    {
      class: 'rdfa-dialog-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': labels.jsonSpec,
    },
    [
      backdrop,
      h('div', { class: 'rdfa-dialog' }, [
        h('div', { class: 'rdfa-dialog-head' }, [
          title,
          downloadBtn,
          copyBtn,
          closeBtn,
        ]),
        pre,
      ]),
    ]
  );

  // Tab cycles within these, IN DOCUMENT ORDER — the head's three buttons, then
  // the scrollable code. The backdrop is `tabindex="-1"` and stays out.
  const focusable: HTMLElement[] = [downloadBtn, copyBtn, closeBtn, pre];
  el.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const active = document.activeElement;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (active === null || !focusable.includes(active as HTMLElement)) {
      // Focus escaped the buttons (or never entered) — pull it back in.
      event.preventDefault();
      first.focus();
    }
  });

  // Move focus into the dialog once the caller has appended it. The append is
  // synchronous right after this returns, so a microtask lands after it.
  queueMicrotask(() => closeBtn.focus());

  return {
    el,
    destroy() {
      // React leaks this timer; a vanilla handle has an explicit teardown, so
      // there is no reason to reproduce a callback firing into a detached tree.
      clearTimeout(copiedTimer);
      el.remove();
      opener?.focus?.();
    },
  };
}
