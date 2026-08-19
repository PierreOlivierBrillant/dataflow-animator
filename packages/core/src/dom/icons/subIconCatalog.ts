/**
 * The `subicon` tech-badge catalogue: badge name → the react-icons export that
 * draws it, and the colour it is painted in.
 *
 * This table is HAND-MAINTAINED and is core's source of truth. The glyph
 * geometry that goes with it is generated from it into
 * `subIconData.generated.ts` (`npm run generate:subicons`), because
 * react-icons ships its paths inlined inside React component bodies and exports
 * no data — and core may not import react.
 *
 * `npm run check:subicons` fails if the generated glyphs drift from this table.
 * Colours are chosen to stay readable on both light and dark backgrounds.
 */
export interface SubIconDef {
  /** react-icons export name, e.g. `SiReact`. */
  icon: string;
  color: string;
}

export const SUB_ICON_CATALOG: Record<string, SubIconDef> = {
  '5g': { icon: 'Md5G', color: '#64748b' },
  angular: { icon: 'SiAngular', color: '#DD0031' },
  api: { icon: 'TbApi', color: '#64748b' },
  apple: { icon: 'SiApple', color: '#A2AAAD' },
  'apple pay': { icon: 'SiApplepay', color: '#A2AAAD' },
  applepay: { icon: 'SiApplepay', color: '#A2AAAD' },
  aws: { icon: 'FaAws', color: '#FF9900' },
  azure: { icon: 'VscAzure', color: '#0078D4' },
  bank: { icon: 'FaPiggyBank', color: '#EC4899' },
  banque: { icon: 'FaPiggyBank', color: '#EC4899' },
  bluetooth: { icon: 'SiBluetooth', color: '#0082FC' },
  chrome: { icon: 'SiGooglechrome', color: '#4285F4' },
  csharp: { icon: 'SiSharp', color: '#8B5CF6' },
  css: { icon: 'SiCss', color: '#1572B6' },
  db: { icon: 'FaDatabase', color: '#FFD700' },
  digitalocean: { icon: 'SiDigitalocean', color: '#0080FF' },
  dns: { icon: 'MdDns', color: '#64748b' },
  docker: { icon: 'SiDocker', color: '#2496ED' },
  dotnet: { icon: 'SiDotnet', color: '#8B5CF6' },
  express: { icon: 'SiExpress', color: '#64748b' },
  firebase: { icon: 'SiFirebase', color: '#FFCA28' },
  firefox: { icon: 'SiFirefoxbrowser', color: '#FF7139' },
  git: { icon: 'SiGit', color: '#F05032' },
  go: { icon: 'SiGo', color: '#00ADD8' },
  'google pay': { icon: 'SiGooglepay', color: '#4285F4' },
  googlepay: { icon: 'SiGooglepay', color: '#4285F4' },
  gpay: { icon: 'SiGooglepay', color: '#4285F4' },
  graphql: { icon: 'SiGraphql', color: '#E10098' },
  html: { icon: 'SiHtml5', color: '#E34F26' },
  http: { icon: 'MdHttp', color: '#64748b' },
  java: { icon: 'FaJava', color: '#E76F00' },
  javascript: { icon: 'SiJavascript', color: '#E8C400' },
  k8s: { icon: 'SiKubernetes', color: '#326CE5' },
  kubernetes: { icon: 'SiKubernetes', color: '#326CE5' },
  linux: { icon: 'SiLinux', color: '#FCC624' },
  mastercard: { icon: 'SiMastercard', color: '#EB001B' },
  mongodb: { icon: 'SiMongodb', color: '#47A248' },
  mssql: { icon: 'DiMsqlServer', color: '#CC2927' },
  mysql: { icon: 'SiMysql', color: '#4479A1' },
  next: { icon: 'SiNextdotjs', color: '#64748b' },
  nextjs: { icon: 'SiNextdotjs', color: '#64748b' },
  nginx: { icon: 'SiNginx', color: '#009639' },
  node: { icon: 'SiNodedotjs', color: '#5FA04E' },
  oidc: { icon: 'SiOpenid', color: '#F78C40' },
  openid: { icon: 'SiOpenid', color: '#F78C40' },
  php: { icon: 'SiPhp', color: '#8993BE' },
  piggybank: { icon: 'FaPiggyBank', color: '#EC4899' },
  postgres: { icon: 'SiPostgresql', color: '#4169E1' },
  postgresql: { icon: 'SiPostgresql', color: '#4169E1' },
  python: { icon: 'SiPython', color: '#3776AB' },
  rails: { icon: 'SiRubyonrails', color: '#D30001' },
  react: { icon: 'SiReact', color: '#61DAFB' },
  redis: { icon: 'SiRedis', color: '#FF4438' },
  ruby: { icon: 'SiRuby', color: '#CC342D' },
  rubyonrails: { icon: 'SiRubyonrails', color: '#D30001' },
  rust: { icon: 'SiRust', color: '#DEA584' },
  typescript: { icon: 'SiTypescript', color: '#3178C6' },
  vercel: { icon: 'SiVercel', color: '#64748b' },
  visa: { icon: 'SiVisa', color: '#1434CB' },
  vue: { icon: 'SiVuedotjs', color: '#4FC08D' },
  wifi: { icon: 'MdWifi', color: '#64748b' },
  windows: { icon: 'FaWindows', color: '#00A4EF' },
};
