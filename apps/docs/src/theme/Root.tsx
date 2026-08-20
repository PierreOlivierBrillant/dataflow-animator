import { useEffect, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { useAlternatePageUtils } from '@docusaurus/theme-common/internal';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { getStoredLocale, detectBrowserLocale } from '@site/src/i18n';

/**
 * Language redirection on 1st visit: as long as no explicit choice is
 * memorized, a French-speaking browser arriving at the English root is
 * sent to /fr/. A click on the switcher memorizes the choice and disables
 * this redirection. Client effect only → SSR-safe.
 *
 * We ONLY redirect from the default locale (never out of an explicit
 * locale like /fr/): otherwise the DocSearch crawler — whose browser is
 * in English — would be sent out of /fr/ and would never index French.
 */
export default function Root({ children }: { children: ReactNode }) {
  const { i18n } = useDocusaurusContext();
  const { createUrl } = useAlternatePageUtils();

  useEffect(() => {
    // In dev, `docusaurus start` only serves one locale: /fr/ doesn't exist, so
    // redirecting would break navigation. Detection only makes sense in prod, where
    // both locales are built and served.
    if (process.env.NODE_ENV !== 'production') return;
    if (i18n.currentLocale !== i18n.defaultLocale) return;
    if (getStoredLocale()) return;
    const desired = detectBrowserLocale();
    if (desired === i18n.currentLocale) return;
    window.location.replace(
      createUrl({ locale: desired, fullyQualified: false })
    );
  }, [i18n.currentLocale, i18n.defaultLocale, createUrl]);

  // `reducedMotion="user"` makes every `motion` component on the site honour
  // the system preference on its own: transform and layout animations collapse
  // to their final value, while opacity ones are kept (a fade carries no
  // movement, and dropping it would hide the reveal rather than calm it).
  // Setting it HERE rather than per component is what keeps a new animated
  // section from silently opting out.
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
