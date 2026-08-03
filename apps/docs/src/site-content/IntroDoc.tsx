import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';
import { DataFlowPlayer } from '../components/DataFlowPlayer';
import { demosById, getSpec } from './demos';
import { useLocale, useTranslation } from '../i18n';

// Contenu de /docs/intro rendu côté client à partir du dictionnaire i18n.
// Les `id` d'ancres sont fixes (indépendants de la langue) pour garder des
// liens profonds stables d'une locale à l'autre.
export function IntroDoc() {
  const { intro } = useTranslation();
  const locale = useLocale();

  return (
    <>
      <div className="docs-lead">
        <p>
          <strong>DataFlow Animator</strong>
          {intro.leadPost}
        </p>
      </div>

      <Heading as="h2" id="packages">
        {intro.packagesTitle}
      </Heading>
      <p>{intro.packagesIntro}</p>
      <table>
        <thead>
          <tr>
            <th>{intro.packagesCols.pkg}</th>
            <th>{intro.packagesCols.api}</th>
            <th>{intro.packagesCols.role}</th>
          </tr>
        </thead>
        <tbody>
          {intro.packages.map((pkg) => (
            <tr key={pkg.pkg}>
              <td>
                <code>{pkg.pkg}</code>
              </td>
              <td>
                <code>{pkg.api}</code>
              </td>
              <td>{pkg.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        {intro.packagesOutro}{' '}
        <Link to="/docs/reference/packages">{intro.packagesLink}</Link>
      </p>

      <Heading as="h2" id="overview">
        {intro.overviewTitle}
      </Heading>
      <p>{intro.overviewIntro}</p>
      <ul>
        {intro.overviewItems.map((item) => (
          <li key={item.strong}>
            {item.pre}
            <strong>{item.strong}</strong>
            {item.post}
          </li>
        ))}
      </ul>
      <p>{intro.overviewOutro}</p>

      <DataFlowPlayer
        mode="auto"
        spec={getSpec(demosById.clientServer, locale)}
      />

      <Heading as="h2" id="principles">
        {intro.principlesTitle}
      </Heading>
      <ul>
        {intro.principles.map((principle) => (
          <li key={principle.strong}>
            <strong>{principle.strong}</strong>
            {principle.rest}
          </li>
        ))}
      </ul>

      <Heading as="h2" id="further">
        {intro.furtherTitle}
      </Heading>
      <ul>
        {intro.furtherItems.map((item) => (
          <li key={item.to}>
            <Link to={item.to}>{item.label}</Link>
            {item.desc}
          </li>
        ))}
      </ul>
    </>
  );
}
