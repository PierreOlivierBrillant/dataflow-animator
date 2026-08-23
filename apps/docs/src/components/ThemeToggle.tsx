import { useCallback, useEffect, useState } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTranslation } from '../i18n';

const STORAGE_KEY = 'theme-preference';
type Preference = 'light' | 'dark' | 'system';

function getStoredPreference(): Preference | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* SSR / blocked storage */
  }
  return null;
}

function storePreference(pref: Preference) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* blocked storage */
  }
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

// Three-mode theme toggle (light / system / dark) wired to Docusaurus'
// color mode. Shares `.rdfa-chip` and the 28px segment with LanguageSwitcher. The "system" option follows the OS preference and reacts
// live to changes (e.g. macOS auto-switch). The preference is persisted
// independently from Docusaurus' own storage so that the "system" concept
// survives reloads.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { setColorMode } = useColorMode();
  const t = useTranslation();

  // Read the persisted preference once on mount. If nothing is stored,
  // default to "system" so returning visitors get OS-sync by default.
  const [preference, setPreference] = useState<Preference>(
    () => getStoredPreference() ?? 'system'
  );

  // Apply a preference: resolve "system" to an actual mode, then push it
  // into Docusaurus and persist the choice.
  const apply = useCallback(
    (pref: Preference) => {
      setPreference(pref);
      storePreference(pref);
      setColorMode(pref === 'system' ? getSystemTheme() : pref);
    },
    [setColorMode]
  );

  // On mount, apply the stored preference (handles "system" → actual
  // mode) and listen for OS theme changes so that "system" stays synced.
  useEffect(() => {
    apply(preference);
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (preference === 'system') {
        setColorMode(getSystemTheme());
      }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [apply, preference, setColorMode]);

  const options: { value: Preference; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: t.nav.themeLight },
    { value: 'system', icon: Monitor, label: t.nav.themeSystem },
    { value: 'dark', icon: Moon, label: t.nav.themeDark },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t.nav.toggleTheme}
      className={`rdfa-chip flex items-center gap-0.5 px-1 ${className}`}
    >
      {options.map(({ value, icon: Icon, label }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => apply(value)}
            // The unselected branch carries its own `bg-transparent`: sharing a
            // base one with the selected branch left two background utilities on
            // the element, and which won was down to their order in the emitted
            // stylesheet rather than to anything written here.
            className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none transition-colors ${
              active
                ? 'bg-violet-600/25 text-violet-700 dark:text-violet-200'
                : 'bg-transparent text-slate-400 hover:bg-[var(--rdfa-chip-bg-hover)] hover:text-slate-900 dark:text-white/30 dark:hover:text-white'
            }`}
          >
            <Icon size={14} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
