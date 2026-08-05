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
        <div className="w-full px-5 h-16 flex items-center gap-4">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 shrink-0 no-underline hover:no-underline"
          >
            <LogoText logoSize={32} />
          </Link>

          {/* Algolia search */}
          <div className="hidden nav:flex items-center">
            <SearchBar />
          </div>

          {/* Links + actions */}
          <div className="flex items-center gap-1 ml-auto">
            {/* Desktop links */}
            <nav className="hidden nav:flex items-center gap-1">
              <NavLink
                to="/docs/intro"
                label={t.nav.documentation}
                icon={<BookOpen size={13} />}
              />
              <NavLink
                to="/examples"
                label={t.nav.examples}
                icon={<LayoutGrid size={13} />}
              />
              <NavLink
                to="/playground"
                label={t.nav.playground}
                exact={true}
                icon={<Zap size={13} />}
              />
            </nav>

            {/* Mobile search (Algolia) */}
            <div className="nav:hidden flex items-center">
              <SearchBar />
            </div>

            {/* Separator + language + GitHub (desktop) */}
            <div className="hidden nav:flex items-center gap-2">
              <div className="w-px h-4 bg-slate-900/10 dark:bg-white/10 mx-1" />
              <LanguageSwitcher />
              <ThemeToggle />
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white rounded-lg transition-all no-underline hover:no-underline"
              >
                <FaGithub size={18} />
              </a>
            </div>

            {/* Mobile menu button */}
            <button
              className="nav:hidden p-2 text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white cursor-pointer bg-transparent border-none"
              onClick={mobileSidebar.toggle}
              aria-expanded={mobileOpen}
              aria-label={t.nav.toggleMenu}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
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
                  {[
                    { label: t.nav.documentation, to: '/docs/intro' },
                    { label: t.nav.examples, to: '/examples' },
                    { label: t.nav.playground, to: '/playground' },
                  ].map(({ label, to }) => (
                    <Link
                      key={to}
                      to={to}
                      className="px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 dark:text-white/60 dark:hover:text-white rounded-lg hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.05] transition-colors no-underline hover:no-underline"
                      onClick={mobileSidebar.toggle}
                    >
                      {label}
                    </Link>
                  ))}
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 dark:text-white/60 dark:hover:text-white rounded-lg hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.05] transition-colors no-underline hover:no-underline"
                    onClick={mobileSidebar.toggle}
                  >
                    <FaGithub size={15} /> {t.nav.sources}
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
      key={label}
      to={to}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors no-underline hover:no-underline font-sans border ${
        isActive
          ? 'text-violet-700 bg-violet-600/10 border-violet-500/25 dark:text-violet-300'
          : 'text-slate-600 hover:text-slate-900 border-transparent dark:text-white/50 dark:hover:text-white'
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
