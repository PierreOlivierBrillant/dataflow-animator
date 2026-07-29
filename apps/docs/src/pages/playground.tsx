import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@theme/Layout';
import { useColorMode } from '@docusaurus/theme-common';
import {
  DataFlowPlayer,
  type DataFlowSpec,
  type DataFlowPlayerProps,
  type PlayerTheme,
  dataFlowSchema,
} from '@dataflow-animator/react';
import { demos, demosById, getSpec, pickLocale } from '../site-content/demos';
import { useLocale, useTranslation } from '../i18n';
import type { SpecError } from '../site-content/validateSpec';
import { motion } from 'motion/react';
import { Copy, Check, AlertCircle, ChevronDown, WrapText } from 'lucide-react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';

// ─── Monaco cross-reference markers ──────────────────────────────────────────

function getValueAtPath(obj: unknown, segments: string[]): unknown {
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function setMonacoRefMarkers(
  errors: SpecError[],
  parsed: unknown,
  editor: Parameters<OnMount>[0] | null,
  monacoInst: Monaco | null
): void {
  if (!editor || !monacoInst) return;
  const model = editor.getModel();
  if (!model) return;

  const markers = errors
    .filter((e) => e.message.startsWith('ID inconnu'))
    .flatMap((err) => {
      const segments = err.path.split('/').filter(Boolean);
      if (segments.length === 0) return [];
      const key = segments[segments.length - 1];
      const value = getValueAtPath(parsed, segments);
      if (typeof value !== 'string') return [];
      const matches = model.findMatches(
        `"${key}": "${value}"`,
        false,
        false,
        false,
        null,
        false
      );
      return matches.map((m) => ({
        severity: monacoInst.MarkerSeverity.Warning,
        message: err.message,
        startLineNumber: m.range.startLineNumber,
        startColumn: m.range.startColumn,
        endLineNumber: m.range.endLineNumber,
        endColumn: m.range.endColumn,
      }));
    });

  monacoInst.editor.setModelMarkers(model, 'validateSpec', markers);
}

function clearMonacoRefMarkers(
  editor: Parameters<OnMount>[0] | null,
  monacoInst: Monaco | null
): void {
  if (!editor || !monacoInst) return;
  const model = editor.getModel();
  if (!model) return;
  monacoInst.editor.setModelMarkers(model, 'validateSpec', []);
}

/* ────────────── Component ────────────── */

// Rendered inside <Layout>, so the call to useColorMode() resolves against the
// ColorModeProvider that Docusaurus mounts in the layout tree (it is not
// available above <Layout> in PlaygroundPage).
function PlaygroundContent() {
  const locale = useLocale();
  const t = useTranslation();
  const { colorMode } = useColorMode();
  const [demoId, setDemoId] = useState<string>(demos[0].id);
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(getSpec(demos[0], locale), null, 2)
  );
  const [spec, setSpec] = useState<DataFlowSpec | null>(() =>
    getSpec(demos[0], locale)
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const [schemaErrors, setSchemaErrors] = useState<SpecError[]>([]);
  const [copied, setCopied] = useState(false);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [density, setDensity] =
    useState<NonNullable<DataFlowPlayerProps['density']>>('comfortable');
  // Palette only: the light/dark variant is the `mode` axis, and the preview
  // leaves it on 'auto' so it follows the site's own theme toggle.
  const [theme, setTheme] = useState<PlayerTheme>('default');

  // Resizing state
  const [leftWidth, setLeftWidth] = useState(44);
  const [isResizing, setIsResizing] = useState(false);
  // false during SSR and initial client render — set to true after hydration
  const [mounted, setMounted] = useState(false);

  // On mount: mark hydration done and sync state to ?demo= URL parameter
  useEffect(() => {
    setMounted(true);
    const id = new URLSearchParams(window.location.search).get('demo');
    if (id && demosById[id] && id !== demos[0].id) {
      setDemoId(id);
      setJsonText(JSON.stringify(getSpec(demosById[id], locale), null, 2));
      setSpec(getSpec(demosById[id], locale));
    }
  }, [locale]);

  // Sync URL when demoId changes — skip the initial mount to avoid
  // overwriting a ?demo= param before the URL-reading effect above has run.
  const didSyncUrlRef = useRef(false);
  useEffect(() => {
    if (!didSyncUrlRef.current) {
      didSyncUrlRef.current = true;
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('demo', demoId);
    window.history.replaceState({}, '', url);
  }, [demoId]);

  // Handle resizing
  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = (e.clientX / window.innerWidth) * 100;
      setLeftWidth(Math.max(20, Math.min(newWidth, 80)));
    };
    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Parse JSON + validation schema (debounced)
  useEffect(() => {
    const tid = setTimeout(async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        setParseError(`${t.playground.invalidJson} ${msg}`);
        setSchemaErrors([]);
        clearMonacoRefMarkers(editorRef.current, monacoRef.current);
        return;
      }
      setParseError(null);
      const { validateSpec } = await import('../site-content/validateSpec');
      const errors = validateSpec(parsed);
      setSchemaErrors(errors);
      setMonacoRefMarkers(errors, parsed, editorRef.current, monacoRef.current);
      if (errors.length === 0) {
        setSpec(parsed as DataFlowSpec);
      }
    }, 350);
    return () => clearTimeout(tid);
  }, [jsonText]);

  const handleTemplateChange = (key: string) => {
    setDemoId(key);
    const demo = demosById[key] ?? demos[0];
    setJsonText(JSON.stringify(getSpec(demo, locale), null, 2));
    setSpec(getSpec(demo, locale));
    setParseError(null);
    setSchemaErrors([]);
    clearMonacoRefMarkers(editorRef.current, monacoRef.current);
  };

  const handleFormat = () => {
    try {
      setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2));
    } catch {}
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const monoSize =
    density === 'compact' ? 11 : density === 'spacious' ? 14 : 13;

  const themeOptions: { value: PlayerTheme; label: string }[] = [
    { value: 'default', label: t.playground.themeDefault },
    { value: 'dots', label: t.playground.themeDots },
    { value: 'blueprint', label: t.playground.themeBlueprint },
    { value: 'pcb', label: t.playground.themePcb },
    { value: 'chalk', label: t.playground.themeChalk },
    { value: 'terminal', label: t.playground.themeTerminal },
    { value: 'paper', label: t.playground.themePaper },
    { value: 'neon', label: t.playground.themeNeon },
  ];

  // Structured, localized index of every example, embedded in the static HTML
  // so the Algolia crawler can emit one search record per example (deep-linked
  // to ?demo=<id>) instead of a single opaque "Playground" record. The crawler
  // `recordExtractor` that consumes `#rdfa-search-index` is documented in
  // docs/SEARCH.md. `<` is escaped so the JSON cannot terminate the <script>.
  const searchIndexJson = useMemo(
    () =>
      JSON.stringify(
        demos.map((demo) => ({
          id: demo.id,
          title: pickLocale(demo.title, locale),
          description: pickLocale(demo.description, locale),
          tags: demo.tags ? pickLocale(demo.tags, locale) : [],
        }))
      ).replace(/</g, '\\u003c'),
    [locale]
  );

  return (
    <main className="flex flex-col overflow-hidden bg-surface-alt h-[calc(100vh-var(--ifm-navbar-height,64px))] [color-scheme:light] dark:[color-scheme:dark]">
      {/* Search index for the Algolia crawler (see docs/SEARCH.md). Not rendered. */}
      <script
        type="application/json"
        id="rdfa-search-index"
        dangerouslySetInnerHTML={{ __html: searchIndexJson }}
      />
      {/* Page header — px-5 gutter aligned with the navbar and the rest of the site */}
      <div className="flex-none px-5 py-4 border-b border-slate-900/[0.08] dark:border-white/[.06] flex items-center gap-4">
        <div>
          <h1 className="text-slate-900 dark:text-white mb-0 font-heading text-xl font-bold leading-tight tracking-tight">
            {t.playground.title}
          </h1>
          <p className="text-xs mt-0.5 mb-0 text-slate-500 dark:text-white/35 font-sans">
            {t.playground.subtitle}
          </p>
        </div>
      </div>

      {/* Body: editor | preview */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        {/* ─── LEFT: JSON Editor ─── */}
        <div
          className="flex flex-col w-full md:min-w-[340px] flex-1 md:flex-none border-b md:border-b-0 overflow-hidden bg-surface-alt"
          style={{
            width:
              mounted && window.innerWidth >= 768 ? `${leftWidth}%` : undefined,
          }}
        >
          {/* Toolbar */}
          <div className="flex-none flex items-center gap-2 px-3 py-2 border-b border-slate-900/[0.08] dark:border-white/[.05] bg-slate-900/[0.015] dark:bg-white/[.015] flex-wrap">
            {/* Template select */}
            <div className="relative">
              <select
                value={demoId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs cursor-pointer outline-none bg-slate-900/[0.04] dark:bg-white/[.06] border border-slate-900/[0.1] dark:border-white/[.09] text-slate-700 dark:text-white/75 font-sans"
              >
                {demos.map((demo) => (
                  <option key={demo.id} value={demo.id}>
                    {pickLocale(demo.title, locale)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={11}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30"
              />
            </div>

            {/* Format */}
            <button
              onClick={handleFormat}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer bg-slate-900/[0.04] dark:bg-white/[.04] border border-slate-900/[0.08] dark:border-white/[.08] text-slate-600 dark:text-white/50 font-sans"
            >
              <WrapText size={11} />
              {t.playground.format}
            </button>

            {/* Density */}
            <div className="relative">
              <select
                value={density}
                onChange={(e) =>
                  setDensity(
                    e.target.value as NonNullable<
                      DataFlowPlayerProps['density']
                    >
                  )
                }
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs cursor-pointer outline-none bg-slate-900/[0.04] dark:bg-white/[.04] border border-slate-900/[0.08] dark:border-white/[.08] text-slate-600 dark:text-white/45 font-sans"
              >
                <option value="compact">{t.playground.densityCompact}</option>
                <option value="comfortable">
                  {t.playground.densityComfortable}
                </option>
                <option value="spacious">{t.playground.densitySpacious}</option>
              </select>
              <ChevronDown
                size={11}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30"
              />
            </div>

            {/* Theme (palette). The light/dark variant follows the site toggle. */}
            <div className="relative">
              <select
                value={theme}
                aria-label={t.playground.theme}
                title={t.playground.themeHint}
                onChange={(e) => setTheme(e.target.value as PlayerTheme)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs cursor-pointer outline-none bg-slate-900/[0.04] dark:bg-white/[.04] border border-slate-900/[0.08] dark:border-white/[.08] text-slate-600 dark:text-white/45 font-sans"
              >
                {themeOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={11}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30"
              />
            </div>

            {/* Copy */}
            <button
              onClick={handleCopy}
              className={`ml-auto p-1.5 rounded-lg transition-colors cursor-pointer bg-transparent border-none outline-none ${copied ? 'text-emerald-500 dark:text-[#34d399]' : 'text-slate-400 dark:text-white/30'}`}
              title={t.playground.copy}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>

          {/* Editor area */}
          <div className="relative flex-1 overflow-hidden">
            <Editor
              height="100%"
              language="json"
              theme={colorMode === 'dark' ? 'rdfa-dark' : 'rdfa-light'}
              value={jsonText}
              onChange={(value) => setJsonText(value || '')}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                monacoRef.current = monaco;
              }}
              beforeMount={(monaco) => {
                // Backgrounds mirror --ifm-background-surface-alt per mode so
                // the editor blends into its bg-surface-alt panel; the prop
                // above swaps between the two as the Docusaurus theme changes.
                monaco.editor.defineTheme('rdfa-dark', {
                  base: 'vs-dark',
                  inherit: true,
                  rules: [],
                  colors: {
                    'editor.background': '#0B0A10',
                    'editor.lineHighlightBackground': '#ffffff0a',
                  },
                });
                monaco.editor.defineTheme('rdfa-light', {
                  base: 'vs',
                  inherit: true,
                  rules: [],
                  colors: {
                    'editor.background': '#ECEBF5',
                    'editor.lineHighlightBackground': '#0000000a',
                  },
                });
                monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                  validate: true,
                  schemas: [
                    {
                      uri: 'http://dataflow-animator/schema.json',
                      fileMatch: ['*'],
                      schema: dataFlowSchema,
                    },
                  ],
                });
              }}
              options={{
                minimap: { enabled: false },
                fontSize: monoSize,
                fontFamily: "'JetBrains Mono', monospace",
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'none',
                hideCursorInOverviewRuler: true,
                scrollbar: {
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8,
                },
                padding: { top: 16, bottom: 16 },
                overviewRulerBorder: false,
              }}
              loading={
                <div className="flex items-center justify-center w-full h-full text-slate-500 dark:text-white/30 text-sm font-sans">
                  {t.playground.loadingEditor}
                </div>
              }
            />
          </div>

          {/* Error bar */}
          {parseError && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="flex-none flex items-start gap-2 px-3 py-2.5 text-xs bg-red-500/[.08] border-t border-red-500/20 text-red-600 dark:text-red-300 font-mono text-[10px]"
            >
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span className="break-all">{parseError}</span>
            </motion.div>
          )}
        </div>

        {/* Resizer Handle (Desktop only) */}
        <div
          className={`hidden md:block w-[1.5px] hover:w-1.5 hover:-ml-[2px] hover:-mr-[2px] cursor-col-resize hover:bg-violet-500 transition-colors z-10 shrink-0 ${isResizing ? 'bg-violet-500 w-1.5 -ml-[2px] -mr-[2px]' : 'bg-slate-900/[0.1] dark:bg-white/[.06]'}`}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
        />

        {/* ─── RIGHT: Preview ─── */}
        <div
          className="flex flex-col flex-1 overflow-hidden bg-surface-alt relative"
          style={{ pointerEvents: isResizing ? 'none' : 'auto' }}
        >
          {/* The player paints its own themed background (board green, chalk
              slate, CRT black…), so it must NOT be forced transparent here —
              otherwise every palette would look like the default one. */}
          <div className="flex-1 overflow-hidden relative">
            {spec ? (
              <DataFlowPlayer
                spec={spec}
                theme={theme}
                mode="auto"
                controls={true}
                exportable={true}
                density={density}
                height="100%"
                className="w-full h-full rounded-none border-x-0 border-t-0 border-none"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center text-sm text-slate-400 dark:text-white/20 font-sans">
                  {t.playground.emptyState}
                </div>
              </div>
            )}
          </div>
          {schemaErrors.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="flex-none overflow-hidden"
            >
              <ul className="rdfa-playground-errors">
                {schemaErrors.map((err, i) => (
                  <li key={i}>
                    <span className="rdfa-playground-errors-path">
                      {err.path}
                    </span>
                    {' — '}
                    {err.message}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PlaygroundPage() {
  const t = useTranslation();
  return (
    <Layout
      title={t.playground.pageTitle}
      description={t.playground.pageDescription}
    >
      <PlaygroundContent />
    </Layout>
  );
}
