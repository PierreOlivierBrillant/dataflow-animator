import { Globe } from 'lucide-react';
import { useAlternatePageUtils } from '@docusaurus/theme-common/internal';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { setStoredLocale, useTranslation, type Locale } from '../i18n';

// Native i18n locale switcher: each language is a distinct URL, so we use
// links (full navigation) rather than a state toggle. Clicking memorizes
// the choice to neutralize browser redirection (see Root.tsx).
//
// Its shell is `.rdfa-chip` and its segments are 28px tall — the same two
// numbers ThemeToggle uses, so the pair reads as one control family.
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const t = useTranslation();
  const { i18n } = useDocusaurusContext();
  const { createUrl } = useAlternatePageUtils();

  return (
    <div
      role="group"
      aria-label={t.nav.languageLabel}
      className={`rdfa-chip flex items-center gap-0.5 px-1 ${className}`}
    >
      <Globe
        size={14}
        className="mx-1 shrink-0 text-slate-400 dark:text-white/30"
        aria-hidden="true"
      />
      {i18n.locales.map((locale) => {
        const active = locale === i18n.currentLocale;
        return (
          <a
            key={locale}
            href={createUrl({ locale, fullyQualified: false })}
            onClick={() => setStoredLocale(locale as Locale)}
            aria-current={active ? 'true' : undefined}
            className={`flex h-7 items-center rounded-md px-2 text-xs font-semibold uppercase no-underline transition-colors hover:no-underline ${
              active
                ? 'bg-violet-600/25 text-violet-700 dark:text-violet-200'
                : 'bg-transparent text-slate-500 hover:bg-[var(--rdfa-chip-bg-hover)] hover:text-slate-900 dark:text-white/45 dark:hover:text-white'
            }`}
          >
            {locale}
          </a>
        );
      })}
    </div>
  );
}
