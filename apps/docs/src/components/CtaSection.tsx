import { motion } from 'motion/react';
import { ArrowRight, GitBranch } from 'lucide-react';
import Link from '@docusaurus/Link';
import { useTranslation } from '../i18n';

export function CtaSection() {
  const t = useTranslation();
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-[linear-gradient(90deg,transparent,rgba(124,58,237,0.4),transparent)]" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.12)_0%,transparent_70%)]" />

      <div className="relative max-w-3xl mx-auto px-5 text-center">
        <motion.p
          className="text-xs uppercase tracking-widest mb-4 text-violet-600 dark:text-violet-400 font-mono"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {t.cta.eyebrow}
        </motion.p>
        <motion.h2
          className="text-slate-900 dark:text-white text-3xl md:text-4xl font-bold mb-5 font-heading"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {t.cta.titlePre}
          <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            {t.cta.titleHighlight}
          </span>
        </motion.h2>
        <motion.p
          className="mb-10 text-[1.05rem] leading-[1.7] text-slate-600 dark:text-slate-100/45 font-sans"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          {t.cta.subtitle}
        </motion.p>
        <motion.div
          className="flex items-center justify-center gap-4 flex-wrap"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
        >
          <Link
            to="/playground"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white no-underline transition-all hover:brightness-110 bg-gradient-to-br from-violet-600 to-violet-800 font-sans shadow-[0_0_40px_rgba(124,58,237,0.4)]"
          >
            {t.cta.primary}
            <ArrowRight size={15} />
          </Link>
          <a
            href="https://github.com/PierreOlivierBrillant/dataflow-animator"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm no-underline transition-all hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.07] border border-slate-900/15 dark:border-white/10 text-slate-700 dark:text-white/85 font-sans"
          >
            <GitBranch size={15} />
            {t.cta.secondary}
          </a>
        </motion.div>
      </div>
    </section>
  );
}
