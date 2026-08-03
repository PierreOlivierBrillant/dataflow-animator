import { useState } from 'react';
import { motion } from 'motion/react';
import { Copy, Check, ArrowRight, BookOpen } from 'lucide-react';
import { DataFlowPlayer } from './DataFlowPlayer';
import { demosById, getSpec } from '../site-content';
import Link from '@docusaurus/Link';
import { useLocale, useTranslation } from '../i18n';

const INSTALL_CMD = 'npm install @dataflow-animator/react';

// Framework names — language invariants, so they stay out of the dictionary
// (only the `Works with` lead-in is translated).
const TARGETS = ['React', 'Angular', 'Web Components', 'Vanilla JS'];

export function HeroSection() {
  const t = useTranslation();
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative min-h-[calc(100vh-60px)] flex items-center overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute rounded-full w-[700px] h-[700px] -top-[15%] -left-[12%] blur-[1px] bg-[radial-gradient(circle,rgba(124,58,237,0.22)_0%,transparent_65%)]"
          animate={{ x: [0, 25, 0], y: [0, -18, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full w-[600px] h-[600px] -bottom-[5%] -right-[8%] blur-[1px] bg-[radial-gradient(circle,rgba(34,211,238,0.14)_0%,transparent_65%)]"
          animate={{ x: [0, -20, 0], y: [0, 22, 0] }}
          transition={{
            duration: 11,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />
        <motion.div
          className="absolute rounded-full w-[400px] h-[400px] top-[40%] left-[30%] blur-[1px] bg-[radial-gradient(circle,rgba(244,114,182,0.10)_0%,transparent_65%)]"
          animate={{ x: [0, 15, 0], y: [0, -25, 0] }}
          transition={{
            duration: 13,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 4,
          }}
        />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[length:64px_64px] bg-[linear-gradient(rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.04)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 py-20 grid lg:grid-cols-[1fr_1.05fr] gap-12 xl:gap-20 items-center w-full">
        {/* Left: text */}
        <div>
          <motion.h1
            className="text-slate-900 dark:text-white mb-5 text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-tight font-heading font-extrabold"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            {t.hero.titlePre}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              {t.hero.titleHighlight}
            </span>
            {t.hero.titlePost}
          </motion.h1>

          <motion.p
            className="mb-8 leading-relaxed max-w-lg text-[1.075rem] text-slate-600 dark:text-slate-100/50 font-sans"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {t.hero.subtitle}
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center gap-3 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            <Link
              to="/playground"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white no-underline transition-all hover:brightness-110 active:scale-[0.98] bg-gradient-to-br from-violet-600 to-violet-800 font-sans shadow-[0_0_30px_rgba(124,58,237,0.3)]"
            >
              {t.hero.ctaPlayground}
              <ArrowRight size={15} />
            </Link>
            <Link
              to="/docs/intro"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium no-underline transition-all hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] border border-slate-900/15 dark:border-white/10 text-slate-700 dark:text-white/70 font-sans"
            >
              <BookOpen size={14} />
              {t.hero.ctaDocs}
            </Link>
          </motion.div>

          {/* Install command */}
          <motion.button
            onClick={handleCopy}
            className="flex items-center gap-3 rounded-xl text-sm cursor-pointer w-full max-w-sm transition-all hover:border-slate-900/20 dark:hover:border-white/20 active:scale-[0.99] bg-slate-900/[0.03] dark:bg-white/[0.03] border border-slate-900/[0.1] dark:border-white/[0.08] px-4 py-2.5 font-mono"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36 }}
          >
            <span className="text-slate-400 dark:text-white/25">$</span>
            <code className="text-violet-700 dark:text-violet-400 flex-1 text-left bg-transparent border-none p-0">
              {INSTALL_CMD}
            </code>
            <span
              className={`transition-colors duration-200 ${copied ? 'text-emerald-500 dark:text-emerald-400/90' : 'text-slate-400 dark:text-white/25'}`}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </span>
          </motion.button>

          {/* The suite is four packages: say so where the install command is,
              or the React one above reads as the only way in. */}
          <motion.div
            className="flex flex-wrap items-center gap-2 mt-4 text-xs font-sans text-slate-500 dark:text-white/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.44 }}
          >
            <span>{t.hero.targetsLabel}</span>
            {TARGETS.map((target) => (
              <span
                key={target}
                className="px-2 py-0.5 rounded-md border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] text-slate-600 dark:text-white/55"
              >
                {target}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Right: Demo */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.2, 0, 0, 1] }}
          className="relative"
        >
          {/* Glow behind demo */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none bg-[radial-gradient(ellipse_at_50%_50%,rgba(124,58,237,0.18)_0%,transparent_70%)] blur-2xl scale-110" />
          <div className="relative rounded-2xl overflow-hidden bg-surface border border-slate-900/[0.08] dark:border-white/[0.07] shadow-[0_25px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.5)]">
            <DataFlowPlayer
              mode="auto"
              spec={getSpec(demosById.clientServer, locale)}
              autoPlay
              loop
              controls={false}
              height={320}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
