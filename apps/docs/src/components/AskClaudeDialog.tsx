import { useEffect, useRef, useState } from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { Check, Copy, Download, ExternalLink, Sparkles, X } from 'lucide-react';
import { useTranslation } from '../i18n';

/**
 * "Ask Claude" from the playground: the visitor describes an animation, copies
 * a complete prompt — the authoring guide, the field reference, the circuit
 * terminals and seven real examples, generated at build time into
 * `static/claude/prompt.md` — and pastes it into claude.ai.
 *
 * The clipboard, not a URL parameter: the context is ~90 KB, far past what a
 * link can carry, and the site is static, so it cannot call the Claude API on
 * the visitor's behalf without a key it must not hold.
 *
 * A native `<dialog>` opened with `showModal()`: the browser makes the page
 * behind it inert, traps the focus, closes on Escape and hands the focus back
 * to the opener — the four obligations of a modal, without re-implementing them.
 */

const CLAUDE_NEW_CHAT = 'https://claude.ai/new';

type CopyState = 'idle' | 'copied' | 'failed';

export function AskClaudeDialog({
  open,
  onClose,
  currentSpec,
}: {
  open: boolean;
  onClose: () => void;
  /** The editor's JSON, offered as a starting point when it parses. */
  currentSpec: string;
}) {
  const t = useTranslation();
  const c = t.playground.claude;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptUrl = useBaseUrl('/claude/prompt.md');
  const skillUrl = useBaseUrl('/claude/dataflow-animator-skill.zip');
  const [context, setContext] = useState<string | null>(null);
  const [request, setRequest] = useState('');
  const [includeCurrent, setIncludeCurrent] = useState(false);
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first focusable element — the close button.
      // The visitor came to type a request.
      textareaRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Fetched when the dialog opens, so the copy itself can run synchronously
  // inside the click: Safari refuses a clipboard write that follows an await.
  useEffect(() => {
    if (!open || context !== null) return;
    let cancelled = false;
    fetch(promptUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.statusText))))
      .then((text) => {
        if (!cancelled) setContext(text);
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [open, context, promptUrl]);

  const currentParses = (() => {
    try {
      JSON.parse(currentSpec);
      return true;
    } catch {
      return false;
    }
  })();

  const buildPrompt = (base: string) => {
    const parts = [base.trimEnd(), '', request.trim() || c.defaultRequest];
    if (includeCurrent && currentParses) {
      parts.push(
        '',
        c.startFromCurrent,
        '',
        '```json',
        currentSpec.trim(),
        '```'
      );
    }
    return parts.join('\n') + '\n';
  };

  const handleCopy = () => {
    if (context === null) {
      setState('failed');
      return;
    }
    // Copy only. Opening claude.ai from the same click would move the focus
    // to the new tab while the write is in flight, and a write from an
    // unfocused document is rejected — so the tab is a second, explicit click.
    navigator.clipboard.writeText(buildPrompt(context)).then(
      () => setState('copied'),
      () => setState('failed')
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="ask-claude-title"
      // Escape and the backdrop close the dialog natively; mirror that into
      // React state so the next open starts from a closed dialog.
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[min(560px,calc(100vw-2rem))] p-0 rounded-2xl border border-slate-900/10 dark:border-white/10 bg-surface text-slate-700 dark:text-white/75 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-900/[0.08] dark:border-white/[0.07]">
        <Sparkles size={18} className="mt-1 shrink-0 text-violet-500" />
        <div className="flex-1 min-w-0">
          <h2
            id="ask-claude-title"
            className="text-slate-900 dark:text-white text-lg font-bold font-heading leading-tight mb-1"
          >
            {c.title}
          </h2>
          <p className="text-[13px] leading-relaxed mb-0 font-sans">
            {c.intro}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={c.close}
          className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer bg-transparent border-none"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3 font-sans">
        <label
          htmlFor="ask-claude-request"
          className="text-sm font-semibold text-slate-900 dark:text-white"
        >
          {c.requestLabel}
        </label>
        <textarea
          ref={textareaRef}
          id="ask-claude-request"
          rows={4}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder={c.requestPlaceholder}
          className="w-full resize-y rounded-lg px-3 py-2 text-sm bg-slate-900/[0.04] dark:bg-white/[.05] border border-slate-900/[0.12] dark:border-white/[.1] text-slate-800 dark:text-white/85 outline-none focus:border-violet-500"
        />
        <label className="flex items-center gap-2 text-[13px] cursor-pointer">
          <input
            type="checkbox"
            checked={includeCurrent && currentParses}
            disabled={!currentParses}
            onChange={(e) => setIncludeCurrent(e.target.checked)}
          />
          {c.includeCurrent}
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white bg-violet-600/90 hover:bg-violet-600 transition-colors cursor-pointer border-none"
          >
            {state === 'copied' ? <Check size={14} /> : <Copy size={14} />}
            {c.copyPrompt}
          </button>
          <a
            href={CLAUDE_NEW_CHAT}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm no-underline border border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10"
          >
            {c.openClaude}
            <ExternalLink size={14} />
          </a>
        </div>
        {/* Announced: the outcome of the button is otherwise invisible to a
            screen reader — the clipboard has no UI, and the new tab opens
            elsewhere. */}
        <p
          role="status"
          className="text-[13px] leading-relaxed mb-0 min-h-[1lh]"
        >
          {state === 'copied' && c.copied}
          {state === 'failed' && c.copyFailed}
        </p>
      </div>

      <div className="px-5 py-4 border-t border-slate-900/[0.08] dark:border-white/[0.07] font-sans">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
          {c.skillTitle}
        </h3>
        <p className="text-[13px] leading-relaxed mb-3">{c.skillBody}</p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={skillUrl}
            download
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] no-underline bg-slate-900/[0.05] dark:bg-white/[.06] border border-slate-900/[0.1] dark:border-white/[.1] text-slate-700 dark:text-white/80 hover:border-violet-500"
          >
            <Download size={13} />
            {c.skillDownload}
          </a>
          <Link to="/docs/claude" className="text-[13px]">
            {c.learnMore}
          </Link>
        </div>
      </div>
    </dialog>
  );
}
