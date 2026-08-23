import { useState, useEffect, type ReactNode } from 'react';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {
  useLockBodyScroll,
  useNavbarMobileSidebar,
  useNavbarSecondaryMenu,
} from '@docusaurus/theme-common/internal';
import SearchBar from '@theme/SearchBar';
import { Menu, X, BookOpen, LayoutGrid, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { FaGithub } from 'react-icons/fa';
import { LogoText } from './LogoText';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { useTranslation } from '../i18n';

const GITHUB_URL = 'https://github.com/PierreOlivierBrillant/dataflow-animator';

export function CustomNavbar() {
  const t = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  // The open/closed state of the mobile menu is Docusaurus', not ours. It has to
  // be: the doc sidebar it hosts is rendered by `DocSidebar/Mobile`, whose items
  // call `mobileSidebar.toggle()` on click. Owning a second `useState` here left
  // that call toggling a state nobody read, so the menu stayed open across the
  // navigation. Reusing the framework's also gets the Android back button and the
  // automatic close when the viewport crosses back into desktop.
  const mobileSidebar = useNavbarMobileSidebar();
  // The doc sidebar arrives through the navbar's secondary-menu portal: on a
  // /docs page below 997px, Docusaurus renders no sidebar of its own and fills
  // this instead. Rendering it is the ONLY way the sub-sections are reachable —
  // this navbar replaces the theme's, which is what used to render it.
  const secondaryMenu = useNavbarSecondaryMenu();
  const mobileOpen = mobileSidebar.shown;
  useLockBodyScroll(mobileOpen);
  const location = useLocation().pathname;
  // Derived, never hardcoded: `useBaseUrl('/')` already carries baseUrl AND the
  // locale prefix, so the transparent navbar follows the home page of BOTH
  // locales and survives a baseUrl rename.
  const home = useBaseUrl('/');
  const isHome = location === home || `${location}/` === home;
  const isSolid = !isHome || scrolled;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    handler(); // initialize
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <>
      {!isHome && (
        <style>{`
          .main-wrapper {
            padding-top: var(--ifm-navbar-height);
          }
        `}</style>
      )}
      <header
        className={`navbar navbar--fixed-top fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isSolid || mobileOpen
            ? 'bg-bg/85 backdrop-blur-[20px] border-b border-slate-900/[.08] dark:border-white/[.06]'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="flex h-16 w-full items-center gap-4 px-5">
          {/* Brand. No gap here: LogoText already spaces its own two halves. */}
          <Link
            to="/"
            className="flex shrink-0 items-center no-underline hover:no-underline"
          >
            <LogoText logoSize={32} />
          </Link>

          {/* Primary navigation, anchored to the brand it belongs to. Pushed to
              the far right it left a void between itself and the search. */}
          <nav className="hidden nav:flex items-center gap-1">
            <NavLink
              to="/docs/intro"
              label={t.nav.documentation}
              icon={<BookOpen size={16} />}
            />
            <NavLink
              to="/examples"
              label={t.nav.examples}
              icon={<LayoutGrid size={16} />}
            />
            <NavLink
              to="/playground"
              label={t.nav.playground}
              exact={true}
              icon={<Zap size={16} />}
            />
          </nav>

          {/* Tools, right-aligned. ONE SearchBar across every width: the layout
              used to mount a second one for the mobile row, and each instance
              registers DocSearch's own Ctrl-K handler — the shortcut opened two
              stacked modals, and dismissing one left the other. */}
          <div className="ml-auto flex items-center gap-2">
            <SearchBar />

            <div className="hidden nav:flex items-center gap-2">
              <div className="h-5 w-px bg-[var(--rdfa-hairline)]" />
              <LanguageSwitcher />
              <ThemeToggle />
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.nav.sources}
                title={t.nav.sources}
                className="rdfa-chip flex w-9 items-center justify-center text-slate-600 no-underline transition-colors hover:bg-[var(--rdfa-chip-bg-hover)] hover:text-slate-900 hover:no-underline dark:text-white/70 dark:hover:text-white"
              >
                <FaGithub size={16} />
              </a>
            </div>

            {/* Mobile menu button — same chip as the controls it replaces. */}
            <button
              className="rdfa-chip flex nav:hidden w-9 cursor-pointer items-center justify-center text-slate-600 transition-colors hover:bg-[var(--rdfa-chip-bg-hover)] hover:text-slate-900 dark:text-white/70 dark:hover:text-white"
              onClick={mobileSidebar.toggle}
              aria-expanded={mobileOpen}
              aria-label={t.nav.toggleMenu}
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="nav:hidden absolute top-full left-0 right-0 w-full overflow-hidden border-b border-slate-900/[0.08] dark:border-white/[0.06] bg-white dark:bg-[#05040e] shadow-2xl"
            >
              {/* The doc tree makes this panel arbitrarily tall, so the scroll
                  belongs INSIDE it — the panel itself keeps `overflow-hidden`,
                  which is what the height animation needs. */}
              <div className="max-h-[calc(100dvh_-_var(--ifm-navbar-height))] overflow-y-auto px-5 pb-5">
                <div className="flex flex-col gap-1 pt-3">
                  {/* Same labels, same icons, same 16px as the desktop row —
                      the two navigations are one list rendered twice. */}
                  {[
                    {
                      label: t.nav.documentation,
                      to: '/docs/intro',
                      icon: <BookOpen size={16} />,
                    },
                    {
                      label: t.nav.examples,
                      to: '/examples',
                      icon: <LayoutGrid size={16} />,
                    },
                    {
                      label: t.nav.playground,
                      to: '/playground',
                      icon: <Zap size={16} />,
                    },
                  ].map(({ label, to, icon }) => (
                    <Link
                      key={to}
                      to={to}
                      className="flex h-11 items-center gap-2.5 rounded-lg px-3 text-sm text-slate-600 no-underline transition-colors hover:bg-[var(--rdfa-chip-bg-hover)] hover:text-slate-900 hover:no-underline dark:text-white/60 dark:hover:text-white"
                      onClick={mobileSidebar.toggle}
                    >
                      {icon}
                      {label}
                    </Link>
                  ))}
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 items-center gap-2.5 rounded-lg px-3 text-sm text-slate-600 no-underline transition-colors hover:bg-[var(--rdfa-chip-bg-hover)] hover:text-slate-900 hover:no-underline dark:text-white/60 dark:hover:text-white"
                    onClick={mobileSidebar.toggle}
                  >
                    <FaGithub size={16} />
                    {t.nav.sources}
                  </a>
                  <div className="flex items-center gap-2 px-3 pt-2">
                    <LanguageSwitcher />
                    <ThemeToggle />
                  </div>
                </div>
                {/* Present only on a /docs page: the sidebar of the current
                    version, straight from the theme (`menu` carries the Infima
                    styles the items are written against). Its own items close
                    the panel — they call `mobileSidebar.toggle()`. */}
                {secondaryMenu.content && (
                  <div className="menu mt-3 border-t border-slate-900/[0.08] pt-1 dark:border-white/[0.06]">
                    {secondaryMenu.content}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}

interface NavLinkProps {
  to: string;
  label: string;
  icon?: ReactNode;
  exact?: boolean;
}

function NavLink({ to, label, icon, exact = false }: NavLinkProps) {
  const currentPath = useLocation().pathname;
  // `to` is relative to the site root; useLocation returns the real pathname,
  // including baseUrl (/dataflow-animator/...). So we compare on the same basis.
  const target = useBaseUrl(to);

  const isActive = exact
    ? currentPath === target || currentPath === `${target}/`
    : currentPath.startsWith(target);

  return (
    <Link
      to={to}
      className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 font-sans text-sm no-underline transition-colors hover:no-underline ${
        isActive
          ? 'border-violet-500/25 bg-violet-600/10 text-violet-700 dark:text-violet-300'
          : 'border-transparent text-slate-600 hover:bg-[var(--rdfa-chip-bg)] hover:text-slate-900 dark:text-white/50 dark:hover:text-white'
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
