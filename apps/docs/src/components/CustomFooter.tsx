import Link from '@docusaurus/Link';
import { FooterColumnItem, MultiColumnFooter } from '@docusaurus/theme-common';
import { FaGithub as Github } from 'react-icons/fa';
import { LogoText } from './LogoText';
import { useTranslation } from '../i18n';

export function CustomFooter({
  footerData,
}: {
  footerData: MultiColumnFooter;
}) {
  const t = useTranslation();
  return (
    <footer className="relative py-12 w-full z-10 bg-black/[0.03] dark:bg-[#000]/20 border-t border-slate-900/10 dark:border-white/5">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <LogoText logoSize={28} />
            <p className="text-xs leading-relaxed text-slate-500 dark:text-white/50 font-sans m-0 mt-3">
              {t.footer.taglineLine1}
              <br />
              {t.footer.taglineLine2}
            </p>
          </div>
          {footerData.links.map((linkSection, index) => (
            <FooterLinkColumn key={index} section={linkSection} />
          ))}
        </div>
        {FooterCopyright({
          copyright: footerData.copyright,
          repoAria: t.footer.repoAria,
        })}
      </div>
    </footer>
  );
}

function FooterLinkColumn({ section }: { section: FooterColumnItem }) {
  const t = useTranslation();
  if (!('items' in section)) return null;

  const title =
    'title' in section && typeof section.title === 'string'
      ? section.title
      : '';

  // The Docusaurus config provides the structure (FR); we re-translate each
  // displayed label via the `footer.labels` table, falling back to the original.
  const tr = (label: string | undefined) =>
    label ? (t.footer.labels[label] ?? label) : '';

  return (
    <div>
      {title && (
        <p className="text-xs font-semibold mb-3 uppercase tracking-wider text-slate-600 dark:text-white/60 font-sans m-0">
          {tr(title)}
        </p>
      )}
      <ul className="flex flex-col gap-2 p-0 m-0 list-none">
        {section.items.map((item) => (
          <li key={item.label} className="m-0">
            <Link
              to={item.href || item.to || '#'}
              className="text-xs font-sans text-slate-600 dark:text-white/55 no-underline transition-colors hover:text-slate-900 dark:hover:text-white/90 hover:no-underline"
            >
              {tr(item.label)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterCopyright({
  copyright,
  repoAria,
}: {
  copyright?: string;
  repoAria: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8 border-t border-slate-900/10 dark:border-white/5">
      <p className="text-xs m-0 text-slate-500 dark:text-white/45 font-sans">
        {copyright || ''}
      </p>
      <div className="flex items-center gap-4">
        <a
          href="https://github.com/PierreOlivierBrillant/dataflow-animator"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={repoAria}
          className="text-slate-500 hover:text-slate-900 dark:text-white/45 dark:hover:text-white/80 transition-colors no-underline"
        >
          <Github size={15} />
        </a>
      </div>
    </div>
  );
}
