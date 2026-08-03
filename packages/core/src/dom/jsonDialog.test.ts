/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJsonDialog } from './jsonDialog';
import { DEFAULT_PLAYER_LABELS } from './labels';

const escape = (code: string): string =>
  code.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function make(over: Partial<Parameters<typeof createJsonDialog>[0]> = {}) {
  const onCopy = vi.fn(() => Promise.resolve());
  const onDownload = vi.fn();
  const onClose = vi.fn();
  const dialog = createJsonDialog({
    json: '{"a":1}',
    highlight: escape,
    labels: DEFAULT_PLAYER_LABELS,
    onCopy,
    onDownload,
    onClose,
    ...over,
  });
  document.body.appendChild(dialog.el);
  return { dialog, onCopy, onDownload, onClose };
}

const byLabel = (root: Element, label: string): HTMLButtonElement =>
  root.querySelector(`button[aria-label="${label}"]`)!;

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createJsonDialog — accessibility surface', () => {
  it('is a labelled modal dialog', () => {
    const { dialog } = make();

    expect(dialog.el.getAttribute('role')).toBe('dialog');
    expect(dialog.el.getAttribute('aria-modal')).toBe('true');
    expect(dialog.el.getAttribute('aria-label')).toBe('JSON specification');
  });

  it('keeps the backdrop out of the tab order', () => {
    const { dialog } = make();
    const backdrop = dialog.el.querySelector('.rdfa-dialog-backdrop')!;

    // Clickable but not tabbable: it is a dismissal target, not a stop.
    expect(backdrop.getAttribute('tabindex')).toBe('-1');
    expect(backdrop.getAttribute('aria-label')).toBe('Close the dialog');
  });

  it('offers download, copy and close in that focus order', () => {
    const { dialog } = make();
    const tabbable = [...dialog.el.querySelectorAll('button')].filter(
      (b) => b.getAttribute('tabindex') !== '-1'
    );

    expect(tabbable.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Download the JSON',
      'Copy',
      'Close',
    ]);
  });

  it('titles its head with the same string as the dialog label', () => {
    const { dialog } = make();

    expect(dialog.el.querySelector('.rdfa-dialog-title')!.textContent).toBe(
      'JSON specification'
    );
  });

  it('renders the highlighted JSON inside a pre > code', () => {
    const { dialog } = make({ json: '{"a":"<b>"}' });
    const code = dialog.el.querySelector('pre.rdfa-dialog-code > code')!;

    expect(code.innerHTML).toBe('{"a":"&lt;b&gt;"}');
  });

  // The panel scrolls, and a scrollable box that is not focusable cannot be
  // scrolled with a keyboard at all.
  it('makes the scrollable code a named tab stop', () => {
    const { dialog } = make();
    const pre = dialog.el.querySelector('pre.rdfa-dialog-code')!;

    expect(pre.getAttribute('tabindex')).toBe('0');
    expect(pre.getAttribute('aria-label')).toBe('JSON specification');
  });
});

describe('createJsonDialog — wiring', () => {
  it('closes from the backdrop and from the close button', () => {
    const { dialog, onClose } = make();

    (dialog.el.querySelector('.rdfa-dialog-backdrop') as HTMLElement).click();
    byLabel(dialog.el, 'Close').click();

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('downloads on demand', () => {
    const { dialog, onDownload } = make();

    byLabel(dialog.el, 'Download the JSON').click();

    expect(onDownload).toHaveBeenCalled();
  });

  it('confirms a copy for 1.5s, then reverts', async () => {
    vi.useFakeTimers();
    const { dialog } = make();
    const btn = byLabel(dialog.el, 'Copy');

    btn.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(
      dialog.el.querySelector('button[aria-label="Copied"]')
    ).not.toBeNull();
    expect(
      dialog.el
        .querySelector('.rdfa-copy-btn')!
        .classList.contains('rdfa-copied')
    ).toBe(true);

    await vi.advanceTimersByTimeAsync(1500);

    expect(dialog.el.querySelector('button[aria-label="Copy"]')).not.toBeNull();
  });

  // Reproduced from React rather than repaired: the title does NOT follow the
  // aria-label, so the two disagree while the confirmation shows.
  it('leaves the copy title constant while the label swaps', async () => {
    vi.useFakeTimers();
    const { dialog } = make();

    byLabel(dialog.el, 'Copy').click();
    await vi.advanceTimersByTimeAsync(0);

    expect(
      dialog.el.querySelector('.rdfa-copy-btn')!.getAttribute('title')
    ).toBe('Copy to clipboard');
  });

  it('stays un-confirmed when the copy is refused', async () => {
    const { dialog } = make({ onCopy: () => Promise.reject(new Error('no')) });

    byLabel(dialog.el, 'Copy').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(dialog.el.querySelector('button[aria-label="Copied"]')).toBeNull();
  });
});

describe('createJsonDialog — teardown', () => {
  it('detaches and cancels a pending confirmation timer', async () => {
    vi.useFakeTimers();
    const { dialog } = make();
    byLabel(dialog.el, 'Copy').click();
    await vi.advanceTimersByTimeAsync(0);

    dialog.destroy();

    // The React component leaks this timer; firing it into a detached tree is
    // exactly what an explicit handle exists to prevent.
    expect(() => vi.advanceTimersByTime(1500)).not.toThrow();
    expect(document.querySelector('.rdfa-dialog-overlay')).toBeNull();
  });
});

describe('createJsonDialog — modal behaviour', () => {
  const press = (el: Element, key: string, shiftKey = false): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', {
      key,
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
    return event;
  };

  it('closes on Escape', () => {
    const { dialog, onClose } = make();
    const event = press(dialog.el, 'Escape');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('moves focus into the dialog on open', async () => {
    const { dialog } = make();
    await Promise.resolve(); // let the queued focus land

    expect(document.activeElement).toBe(byLabel(dialog.el, 'Close'));
  });

  it('traps Tab within its stops, the code panel last', async () => {
    const { dialog } = make();
    await Promise.resolve(); // let the queued focus land
    const download = byLabel(dialog.el, 'Download the JSON');
    const close = byLabel(dialog.el, 'Close');
    const pre = dialog.el.querySelector<HTMLElement>('pre.rdfa-dialog-code')!;

    // The code panel sits after the buttons in the document, so "Close" is no
    // longer the last stop: Tab there is left to the browser's native move
    // rather than wrapped round (jsdom performs no native move of its own).
    close.focus();
    expect(press(close, 'Tab').defaultPrevented).toBe(false);

    // From the LAST stop — the code panel — Tab wraps to the first.
    pre.focus();
    press(pre, 'Tab');
    expect(document.activeElement).toBe(download);

    // On the first, Shift+Tab wraps to the last — the code panel.
    download.focus();
    press(download, 'Tab', true);
    expect(document.activeElement).toBe(pre);
  });

  it('restores focus to the opener on destroy', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { dialog } = make();
    await Promise.resolve();
    expect(document.activeElement).not.toBe(opener);

    dialog.destroy();
    expect(document.activeElement).toBe(opener);
  });
});
