import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { DataFlowSpec } from '@dataflow-animator/react';
import { DataFlowPlayer } from './DataFlowPlayer';
import Link from '@docusaurus/Link';
import { Search, X, ExternalLink, Sparkles } from 'lucide-react';
import {
  demos,
  demosById,
  demoCategories,
  getSpec,
  pickLocale,
  type Demo,
  type DemoCategory,
} from '../site-content/demos';
import { useLocale, useTranslation } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

/** Makes a string case and accent insensitive for search. */
const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

// ─── Thumbnail ────────────────────────────────────────────────────────────────

/**
 * Animated preview of a demo. Lazily mounted on first entry into the
 * viewport (IntersectionObserver), then playback is driven by
 * VISIBILITY: an on-screen card plays its animation (`autoPlay` + `loop`) upon
 * entering the page; as soon as it leaves the view it is remounted as a static
 * image (`idle` key, no rAF loop). This limits the number of active animations
 * to what is actually visible — without this safeguard, 21 rAF loops
 * would run constantly (performance issue). Playback resumes on
 * scroll.
 */
function DemoThumbnail({ spec }: { spec: DataFlowSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      setMounted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((e) => e.isIntersecting);
        setVisible(isVisible);
        if (isVisible) setMounted(true);
      },
      { rootMargin: '80px', threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // Decorative, and deliberately so: the card is a button, and every string
    // this player renders would otherwise be concatenated into its accessible
    // name — a name that would then CHANGE on every frame of the animation. The
    // card states what the demo is in its own text; the moving picture is the
    // sighted half of the same information.
    <div
      ref={ref}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    >
      {mounted && (
        <DataFlowPlayer
          key={visible && !reducedMotion ? 'play' : 'idle'}
          spec={spec}
          mode="auto"
          controls={false}
          autoPlay={visible && !reducedMotion}
          loop
          height="100%"
          density="spacious"
          className="h-full w-full border-none bg-transparent"
        />
      )}
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────

function DemoCard({ demo, onOpen }: { demo: Demo; onOpen: () => void }) {
  const t = useTranslation();
  const locale = useLocale();
  const tags = demo.tags ? pickLocale(demo.tags, locale) : [];

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="group flex flex-col text-left appearance-none p-0 rounded-2xl overflow-hidden border border-slate-900/[0.08] dark:border-white/[0.07] bg-slate-900/[0.02] dark:bg-white/[0.02] hover:border-violet-500/40 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
    >
      {/* Preview */}
      <div className="relative aspect-[16/9] overflow-hidden bg-surface border-b border-slate-900/[0.08] dark:border-white/[0.06]">
        <DemoThumbnail spec={getSpec(demo, locale)} />
        <span className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider bg-black/55 backdrop-blur-sm text-violet-300 border border-violet-500/30">
          {t.gallery.categories[demo.category]}
        </span>
        {/* Hover affordance: it says what activating the button does, which
            the button's own role already conveys. Announced, it would just
            pad every card's name with the same sentence. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-1.5 py-2 text-[11px] font-sans text-white/90 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Sparkles size={12} className="text-violet-300" />
          {t.gallery.openLarge}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4">
        {/* A `span`, not a heading: this text lives inside a button, where a
            heading is flattened into the accessible name and disappears from
            the document's heading list. Demoting it costs nothing and stops
            the outline from advertising 45 headings no reader can reach. */}
        <span className="block text-slate-900 dark:text-white text-[15px] font-semibold mb-1.5 font-heading leading-snug">
          {pickLocale(demo.title, locale)}
        </span>
        <p className="text-[13px] leading-relaxed text-slate-600 dark:text-white/45 font-sans line-clamp-2 mb-3">
          {pickLocale(demo.description, locale)}
        </p>
        {tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 dark:text-white/40 bg-slate-900/[0.04] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.06]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ─── Preview Modal ──────────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function DemoModal({ demo, onClose }: { demo: Demo; onClose: () => void }) {
  const t = useTranslation();
  const locale = useLocale();
  const reducedMotion = usePrefersReducedMotion();
  const title = pickLocale(demo.title, locale);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = `demo-modal-title-${demo.id}`;

  /**
   * The three obligations `aria-modal="true"` takes on, and that the markup
   * alone does not honour.
   *
   * Declaring the dialog modal tells assistive technology that everything
   * outside it is inert — so leaving the focus on the card that opened it
   * strands the reader in a region their own screen reader has just been told
   * to ignore. The focus has to MOVE in, STAY in while the dialog is open, and
   * COME BACK to the trigger on close; the last one is what makes closing feel
   * like a return rather than a reset to the top of a 45-card grid.
   */
  // `onClose` is a fresh arrow on every render of the gallery, so the effect
  // below MUST NOT depend on it: it has to run once, on open, and undo itself
  // once, on close. Through a ref it always calls the current one anyway.
  //
  // This is not a tidiness point. With `[onClose]` as the dependency, every
  // re-render tore the effect down and set it up again — and the teardown ends
  // by handing the focus back to the opener. A single re-render (the
  // reduced-motion probe resolving is enough) therefore yanked the focus out of
  // the open dialog, and the "opener" captured by the next setup was whatever
  // element the previous teardown had just focused. The trap then compared the
  // focus against a panel it no longer contained, and let Tab walk out.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      // `Array.from`, NOT `[...nodeList]`. The docs site re-transpiles through
      // Babel in loose mode, where a spread over a non-array iterable becomes
      // `[].concat(nodeList)` — an array holding the NodeList itself. The trap
      // then saw exactly one "element", compared the focus against it, matched
      // nothing, and let Tab walk out of the dialog with every test green.
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.getClientRects().length > 0);
      // Nothing to cycle through: hold the focus on the panel rather than let
      // Tab walk it out into the inert page behind.
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        // The dialog is the PANEL, not the backdrop it floats on. Naming the
        // backdrop the dialog puts a click-to-close surface the size of the
        // viewport inside the dialog's own boundaries.
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-4xl rounded-2xl overflow-hidden border border-slate-900/10 dark:border-white/10 bg-surface shadow-2xl outline-none"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-5 py-4 border-b border-slate-900/[0.08] dark:border-white/[0.07]">
          <div className="flex-1 min-w-0">
            <span className="inline-block mb-1 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider text-violet-700 dark:text-violet-300 bg-violet-500/10 border border-violet-500/25">
              {t.gallery.categories[demo.category]}
            </span>
            <h2
              id={titleId}
              className="text-slate-900 dark:text-white text-lg font-bold font-heading leading-tight mb-0"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.gallery.close}
            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer bg-transparent border-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Player */}
        <div className="bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.08)_0%,transparent_70%)]">
          <DataFlowPlayer
            key={demo.id}
            spec={getSpec(demo, locale)}
            mode="auto"
            controls
            autoPlay={!reducedMotion}
            loop={!reducedMotion}
            height={420}
            className="border-none bg-transparent rounded-none"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-900/[0.08] dark:border-white/[0.07]">
          <p className="text-[13px] leading-relaxed text-slate-600 dark:text-white/55 font-sans mb-3">
            {pickLocale(demo.description, locale)}
          </p>
          <Link
            to={`/playground?demo=${demo.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-sans text-white bg-violet-600/90 hover:bg-violet-600 transition-colors no-underline"
          >
            {t.gallery.openInPlayground}
            <ExternalLink size={14} />
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Gallery ──────────────────────────────────────────────────────────────────

export function DemoGallery() {
  const t = useTranslation();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DemoCategory | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: demos.length };
    for (const c of demoCategories)
      map[c] = demos.filter((d) => d.category === c).length;
    return map;
  }, []);

  const filtered = useMemo(() => {
    const terms = fold(query.trim()).split(/\s+/).filter(Boolean);
    return demos.filter((d) => {
      if (category !== 'all' && d.category !== category) return false;
      if (terms.length === 0) return true;
      const haystack = fold(
        [
          pickLocale(d.title, locale),
          pickLocale(d.description, locale),
          t.gallery.categories[d.category],
          d.id,
          ...(d.tags ? pickLocale(d.tags, locale) : []),
        ].join(' ')
      );
      return terms.every((term) => haystack.includes(term));
    });
  }, [query, category, locale, t]);

  const openDemo = openId ? demosById[openId] : null;

  return (
    <div className="max-w-6xl mx-auto px-5 py-12">
      {/* Search */}
      <div className="relative mb-5">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.gallery.searchPlaceholder}
          aria-label={t.gallery.searchAria}
          className="w-full pl-10 pr-10 py-3 rounded-xl text-sm font-sans text-slate-900 dark:text-white bg-slate-900/[0.03] dark:bg-white/[0.03] border border-slate-900/[0.1] dark:border-white/[0.09] outline-none placeholder:text-slate-400 dark:placeholder:text-white/30 focus:border-violet-500/50 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t.gallery.clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white/70 transition-colors cursor-pointer bg-transparent border-none"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Category filters */}
      <div
        role="group"
        aria-label={t.gallery.filterAria}
        className="flex flex-wrap items-center gap-2 mb-8"
      >
        <CategoryChip
          label={t.gallery.allCategory}
          count={counts.all}
          active={category === 'all'}
          onClick={() => setCategory('all')}
        />
        {demoCategories.map((c) => (
          <CategoryChip
            key={c}
            label={t.gallery.categories[c]}
            count={counts[c]}
            active={category === c}
            onClick={() => setCategory(c)}
          />
        ))}
      </div>

      {/* Filtering rewrites the grid without moving the focus, which leaves a
          screen-reader user typing into a search box with no feedback at all.
          One polite announcement per settled result set says how many cards
          are now below — the count a sighted visitor reads at a glance. */}
      <p className="sr-only" role="status">
        {t.gallery.resultsCount(filtered.length)}
      </p>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((demo) => (
            <DemoCard
              key={demo.id}
              demo={demo}
              onOpen={() => setOpenId(demo.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-slate-500 dark:text-white/50 font-sans mb-1">
            {t.gallery.noResults(query)}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategory('all');
            }}
            className="text-sm text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 cursor-pointer bg-transparent border-none font-sans"
          >
            {t.gallery.resetFilters}
          </button>
        </div>
      )}

      <AnimatePresence>
        {openDemo && (
          <DemoModal demo={openDemo} onClose={() => setOpenId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // The selected filter is styled, not stated. `aria-pressed` is what makes
      // "which category am I looking at?" answerable without seeing the violet.
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-colors cursor-pointer ${
        active
          ? 'bg-violet-600/20 border border-violet-600/50 text-violet-700 dark:text-violet-200'
          : 'bg-slate-900/[0.03] dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.07] text-slate-600 hover:text-slate-900 dark:text-white/50 dark:hover:text-white/80'
      }`}
    >
      {label}{' '}
      <span
        className={`ml-1.5 ${active ? 'text-violet-500/80 dark:text-violet-300/70' : 'text-slate-400 dark:text-white/30'}`}
      >
        {count}
      </span>
    </button>
  );
}
