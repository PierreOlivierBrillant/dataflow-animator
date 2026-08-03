import LogoSvg from '@site/static/img/logo.svg';

export function LogoText({ logoSize = 28 }: { logoSize?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoSvg height={logoSize} role="img" aria-label="DataFlow Animator" />
      <span className="text-sm font-semibold text-slate-900 dark:text-white font-heading">
        DataFlow Animator
      </span>
    </div>
  );
}
