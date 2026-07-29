import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../i18n';
import { signalr } from './demos/signalr';
import { microservices } from './demos/microservices';
import { spa } from './demos/spa';
import { clientServer } from './demos/clientServer';
import { crypto } from './demos/crypto';
import { tls } from './demos/tls';
import { oauth } from './demos/oauth';
import { dos } from './demos/dos';
import { ddos } from './demos/ddos';
import { rateLimit } from './demos/rateLimit';
import { scrubbing } from './demos/scrubbing';
import { dns } from './demos/dns';
import { cicd } from './demos/cicd';
import { raft } from './demos/raft';
import { messageQueue } from './demos/messageQueue';
import { cdn } from './demos/cdn';
import { loadBalancer } from './demos/loadBalancer';
import { kubernetes } from './demos/kubernetes';
import { payment } from './demos/payment';
import { blockchain } from './demos/blockchain';
import { smtp } from './demos/smtp';
import { graphql } from './demos/graphql';
import { webhook } from './demos/webhook';
import { circular } from './demos/circular';
import { collision } from './demos/collision';
import { pushNotifications } from './demos/pushNotifications';
import { redBlackTree } from './demos/redBlackTree';
import { redBlackRotation } from './demos/redBlackRotation';
import { avlTree } from './demos/avlTree';
import { bstSearch } from './demos/bstSearch';
import { bstInsert } from './demos/bstInsert';
import { dijkstra } from './demos/dijkstra';
import { astar } from './demos/astar';
import { mst } from './demos/mst';
import { circuit } from './demos/circuit';
import { circuitParallel } from './demos/circuitParallel';
import { ohmsLaw } from './demos/ohmsLaw';
import { logicGates } from './demos/logicGates';
import { halfAdder } from './demos/halfAdder';
import { halfAdderNand } from './demos/halfAdderNand';
import { halfSubtractorNand } from './demos/halfSubtractorNand';
import { fullAdderNand } from './demos/fullAdderNand';
import { fullSubtractorNand } from './demos/fullSubtractorNand';
import { srLatch } from './demos/srLatch';
import { rcCircuit } from './demos/rcCircuit';

/** Clé de catégorie (stable, indépendante de la langue). Les libellés affichés
 * sont traduits via le dictionnaire (`gallery.categories`). */
export type DemoCategory =
  | 'web-api'
  | 'realtime'
  | 'security'
  | 'infrastructure'
  | 'distributed'
  | 'data-structures'
  | 'electronics'
  | 'engine';

/** Ordre d'affichage des catégories dans le filtre de la galerie. */
export const demoCategories: DemoCategory[] = [
  'web-api',
  'realtime',
  'security',
  'infrastructure',
  'distributed',
  'data-structures',
  'electronics',
  'engine',
];

/** Valeur localisée : `fr` est obligatoire (source) ; `en` est optionnel et
 * sert de traduction, avec repli sur `fr` tant qu'il manque. */
type Localized<T> = { fr: T; en?: T };

export function pickLocale<T>(value: Localized<T>, locale: Locale): T {
  return value[locale] ?? value.fr;
}

/** Une spec peut être un objet (pas encore traduit → FR dans les deux langues)
 * ou un builder qui rend la version localisée. */
type LocalizedSpec = DataFlowSpec | ((locale: Locale) => DataFlowSpec);

export function getSpec(demo: Demo, locale: Locale): DataFlowSpec {
  return typeof demo.spec === 'function' ? demo.spec(locale) : demo.spec;
}

export interface Demo {
  id: string;
  title: Localized<string>;
  description: Localized<string>;
  /** Catégorie de classement (filtre de la galerie). */
  category: DemoCategory;
  /** Mots-clés libres, indexés par la recherche textuelle de la galerie. */
  tags?: Localized<string[]>;
  spec: LocalizedSpec;
}

export const demos: Demo[] = [
  {
    id: 'clientServer',
    title: { fr: 'Client-Serveur', en: 'Client-Server' },
    description: {
      fr: 'Architecture client serveur',
      en: 'Client-server architecture',
    },
    category: 'web-api',
    tags: {
      fr: ['http', 'rest', 'sql', 'navigateur', 'base de données'],
      en: ['http', 'rest', 'sql', 'browser', 'database'],
    },
    spec: clientServer,
  },
  {
    id: 'signalr',
    title: {
      fr: 'Temps réel full-duplex (SignalR)',
      en: 'Full-duplex real-time (SignalR)',
    },
    description: {
      fr: 'Connexion WebSocket persistante : on voit le code client et le code du hub, puis un SendAll qui diffuse le message à tous les clients connectés.',
      en: 'Persistent WebSocket connection: we see the client code and the hub code, then a SendAll broadcasting the message to all connected clients.',
    },
    category: 'realtime',
    tags: {
      fr: ['websocket', 'hub', 'diffusion', 'full-duplex', 'signalr'],
      en: ['websocket', 'hub', 'broadcast', 'full-duplex', 'signalr'],
    },
    spec: signalr,
  },
  {
    id: 'microservices',
    title: {
      fr: 'Microservices derrière un proxy Nginx',
      en: 'Microservices behind an Nginx proxy',
    },
    description: {
      fr: 'Auth et Données derrière Nginx, chacun avec sa base : authentification (JWT) puis requête de données.',
      en: 'Auth and Data behind Nginx, each with its database: authentication (JWT) then data request.',
    },
    category: 'infrastructure',
    tags: {
      fr: ['nginx', 'jwt', 'proxy', 'auth', 'microservices'],
      en: ['nginx', 'jwt', 'proxy', 'auth', 'microservices'],
    },
    spec: microservices,
  },
  {
    id: 'spa',
    title: {
      fr: 'Chargement d’une SPA puis appels API',
      en: 'SPA loading then API calls',
    },
    description: {
      fr: 'Le navigateur charge le bundle depuis le serveur web, puis la SPA interroge le Web API et sa base.',
      en: 'The browser loads the bundle from the web server, then the SPA queries the Web API and its database.',
    },
    category: 'web-api',
    tags: {
      fr: ['react', 'bundle', 'api', 'single-page', 'navigateur'],
      en: ['react', 'bundle', 'api', 'single-page', 'browser'],
    },
    spec: spa,
  },
  {
    id: 'crypto',
    title: {
      fr: 'Cryptographie : Alice, Bob & Ève',
      en: 'Cryptography: Alice, Bob & Eve',
    },
    description: {
      fr: 'Échange de clés Diffie-Hellman sur un canal public écouté par Ève : elle voit passer les valeurs publiques mais ne peut pas reconstituer la clé partagée.',
      en: 'Diffie-Hellman key exchange on a public channel eavesdropped by Eve: she sees the public values pass by but cannot reconstruct the shared key.',
    },
    category: 'security',
    tags: {
      fr: [
        'diffie-hellman',
        'chiffrement',
        'mitm',
        'alice',
        'bob',
        'ève',
        'clé',
      ],
      en: [
        'diffie-hellman',
        'encryption',
        'mitm',
        'alice',
        'bob',
        'eve',
        'key',
      ],
    },
    spec: crypto,
  },
  {
    id: 'tls',
    title: { fr: 'Poignée de main TLS 1.3', en: 'TLS 1.3 handshake' },
    description: {
      fr: 'ClientHello / ServerHello, validation du certificat, dérivation de la clé de session, puis bascule en canal chiffré pour les données applicatives.',
      en: 'ClientHello / ServerHello, certificate validation, session key derivation, then switch to encrypted channel for application data.',
    },
    category: 'security',
    tags: {
      fr: ['https', 'handshake', 'certificat', 'chiffrement', 'tls'],
      en: ['https', 'handshake', 'certificate', 'encryption', 'tls'],
    },
    spec: tls,
  },
  {
    id: 'oauth',
    title: {
      fr: 'OAuth 2.0 — Authorization Code',
      en: 'OAuth 2.0 — Authorization Code',
    },
    description: {
      fr: 'Connexion déléguée : redirection vers le serveur d’autorisation, code à usage unique, échange contre un jeton sur le canal arrière, puis appel de l’API.',
      en: 'Delegated login: redirection to the authorization server, single-use code, exchange for a token on the back channel, then API call.',
    },
    category: 'security',
    tags: {
      fr: ['oauth2', 'oidc', 'jeton', 'authentification', 'sso'],
      en: ['oauth2', 'oidc', 'token', 'authentication', 'sso'],
    },
    spec: oauth,
  },
  {
    id: 'dos',
    title: {
      fr: 'Attaque par déni de service (DoS)',
      en: 'Denial-of-service attack (DoS)',
    },
    description: {
      fr: 'Une seule machine inonde le serveur de requêtes jusqu’à le saturer ; l’utilisateur légitime est alors privé de service. Comme tout vient d’une IP unique, l’attaque reste blocable.',
      en: 'A single machine floods the server with requests until it saturates; the legitimate user is then denied service. Since everything comes from one IP, the attack stays blockable.',
    },
    category: 'security',
    tags: {
      fr: ['dos', 'flood', 'saturation', 'déni de service', 'attaque'],
      en: ['dos', 'flood', 'saturation', 'denial of service', 'attack'],
    },
    spec: dos,
  },
  {
    id: 'ddos',
    title: {
      fr: 'Attaque par déni de service distribué (DDoS)',
      en: 'Distributed denial-of-service attack (DDoS)',
    },
    description: {
      fr: 'Un serveur de commande (C&C) ordonne à un botnet d’attaquer : tous les bots inondent la cible simultanément. Le trafic venant de milliers d’IP, on ne peut pas simplement bloquer une adresse.',
      en: 'A command-and-control server (C&C) orders a botnet to attack: every bot floods the target simultaneously. With traffic coming from thousands of IPs, you cannot just block one address.',
    },
    category: 'security',
    tags: {
      fr: ['ddos', 'botnet', 'flood', 'c&c', 'déni de service', 'attaque'],
      en: ['ddos', 'botnet', 'flood', 'c&c', 'denial of service', 'attack'],
    },
    spec: ddos,
  },
  {
    id: 'rateLimit',
    title: {
      fr: 'Parade DoS : limitation de débit',
      en: 'DoS countermeasure: rate limiting',
    },
    description: {
      fr: 'Un reverse proxy plafonne les requêtes par IP : le flood mono-source est rejeté en 429 dès la bordure, le backend reste sain et l’utilisateur légitime continue d’être servi.',
      en: 'A reverse proxy caps requests per IP: the single-source flood is rejected with 429 at the edge, the backend stays healthy and the legitimate user keeps being served.',
    },
    category: 'security',
    tags: {
      fr: [
        'rate limiting',
        'limitation de débit',
        '429',
        'reverse proxy',
        'mitigation',
        'dos',
      ],
      en: [
        'rate limiting',
        'throttling',
        '429',
        'reverse proxy',
        'mitigation',
        'dos',
      ],
    },
    spec: rateLimit,
  },
  {
    id: 'scrubbing',
    title: {
      fr: 'Parade DDoS : centre de nettoyage',
      en: 'DDoS countermeasure: scrubbing center',
    },
    description: {
      fr: 'Tout le trafic transite par une bordure de filtrage (type Cloudflare/Anycast) qui absorbe le volumétrique et jette les bots ; seule la requête légitime atteint l’origine, qui ne voit jamais l’attaque.',
      en: 'All traffic flows through a filtering edge (Cloudflare/Anycast-style) that absorbs the volumetric flood and drops the bots; only the legitimate request reaches the origin, which never sees the attack.',
    },
    category: 'security',
    tags: {
      fr: [
        'scrubbing',
        'nettoyage',
        'anycast',
        'cloudflare',
        'mitigation',
        'ddos',
      ],
      en: [
        'scrubbing',
        'cleaning',
        'anycast',
        'cloudflare',
        'mitigation',
        'ddos',
      ],
    },
    spec: scrubbing,
  },
  {
    id: 'dns',
    title: { fr: 'Résolution DNS récursive', en: 'Recursive DNS resolution' },
    description: {
      fr: 'Le résolveur interroge tour à tour la racine, le TLD puis le serveur autoritaire avant de renvoyer l’adresse IP au navigateur (et de la mettre en cache).',
      en: 'The resolver queries the root, the TLD and then the authoritative server in turn before returning the IP address to the browser (and caching it).',
    },
    category: 'infrastructure',
    tags: {
      fr: ['dns', 'résolution', 'récursif', 'résolveur', 'tld'],
      en: ['dns', 'resolution', 'recursive', 'resolver', 'tld'],
    },
    spec: dns,
  },
  {
    id: 'cicd',
    title: { fr: 'Pipeline CI/CD', en: 'CI/CD pipeline' },
    description: {
      fr: 'Du git push au déploiement : webhook, tests et build dans le runner, publication de l’image dans le registry, puis mise en production.',
      en: 'From git push to deployment: webhook, tests and build in the runner, publishing the image to the registry, then deploying to production.',
    },
    category: 'infrastructure',
    tags: {
      fr: ['git', 'pipeline', 'docker', 'déploiement', 'ci/cd'],
      en: ['git', 'pipeline', 'docker', 'deployment', 'ci/cd'],
    },
    spec: cicd,
  },
  {
    id: 'raft',
    title: {
      fr: 'Consensus Raft — élection de leader',
      en: 'Raft consensus — leader election',
    },
    description: {
      fr: 'Disposition circulaire : un candidat sollicite les votes des suiveurs, obtient la majorité, devient leader puis maintient son autorité par des battements de cœur.',
      en: 'Circular layout: a candidate requests votes from followers, gets the majority, becomes leader then maintains authority via heartbeats.',
    },
    category: 'distributed',
    tags: {
      fr: ['consensus', 'élection', 'leader', 'quorum', 'raft'],
      en: ['consensus', 'election', 'leader', 'quorum', 'raft'],
    },
    spec: raft,
  },
  {
    id: 'messageQueue',
    title: {
      fr: 'File de messages (publish/subscribe)',
      en: 'Message queue (publish/subscribe)',
    },
    description: {
      fr: 'Un producteur publie un événement dans un broker, qui le distribue à plusieurs workers ; chacun traite puis accuse réception.',
      en: 'A producer publishes an event in a broker, which distributes it to multiple workers; each processes then acknowledges.',
    },
    category: 'realtime',
    tags: {
      fr: ['pub/sub', 'broker', 'file', 'asynchrone', 'workers'],
      en: ['pub/sub', 'broker', 'queue', 'asynchronous', 'workers'],
    },
    spec: messageQueue,
  },
  {
    id: 'cdn',
    title: { fr: 'Cache CDN — MISS puis HIT', en: 'CDN cache — MISS then HIT' },
    description: {
      fr: 'La même ressource demandée deux fois : premier appel en cache MISS (aller jusqu’à l’origine), second en cache HIT servi immédiatement depuis le bord.',
      en: 'The same resource requested twice: first call is a cache MISS (goes to origin), second is a cache HIT served immediately from the edge.',
    },
    category: 'web-api',
    tags: {
      fr: ['cache', 'edge', 'latence', 'hit', 'miss', 'cdn'],
      en: ['cache', 'edge', 'latency', 'hit', 'miss', 'cdn'],
    },
    spec: cdn,
  },
  {
    id: 'loadBalancer',
    title: {
      fr: 'Répartiteur de charge (round-robin)',
      en: 'Load balancer (round-robin)',
    },
    description: {
      fr: 'Trois requêtes successives distribuées chacune à un backend différent ; la quatrième reboucle sur le premier.',
      en: 'Three successive requests distributed to different backends; the fourth loops back to the first.',
    },
    category: 'web-api',
    tags: {
      fr: ['répartiteur', 'round-robin', 'backend', 'scalabilité', 'nginx'],
      en: ['load balancer', 'round-robin', 'backend', 'scalability', 'nginx'],
    },
    spec: loadBalancer,
  },
  {
    id: 'kubernetes',
    title: { fr: 'Déploiement Kubernetes', en: 'Kubernetes deployment' },
    description: {
      fr: 'De kubectl apply au pod Running : l’API Server persiste l’état désiré dans etcd, le scheduler choisit un nœud, le kubelet lance le conteneur.',
      en: 'From kubectl apply to Running pod: the API Server persists the desired state in etcd, the scheduler picks a node, the kubelet starts the container.',
    },
    category: 'infrastructure',
    tags: {
      fr: ['k8s', 'pod', 'scheduler', 'conteneur', 'orchestration'],
      en: ['k8s', 'pod', 'scheduler', 'container', 'orchestration'],
    },
    spec: kubernetes,
  },
  {
    id: 'payment',
    title: {
      fr: 'Paiement en ligne (3-D Secure)',
      en: 'Online payment (3-D Secure)',
    },
    description: {
      fr: 'Intention de paiement, autorisation bancaire avec authentification forte, puis confirmation asynchrone de la boutique par webhook.',
      en: 'Payment intent, bank authorization with strong authentication, then asynchronous shop confirmation via webhook.',
    },
    category: 'web-api',
    tags: {
      fr: ['stripe', '3d secure', 'webhook', 'banque', 'e-commerce'],
      en: ['stripe', '3d secure', 'webhook', 'bank', 'e-commerce'],
    },
    spec: payment,
  },
  {
    id: 'blockchain',
    title: { fr: 'Transaction blockchain', en: 'Blockchain transaction' },
    description: {
      fr: 'Une transaction signée rejoint le mempool, plusieurs mineurs cherchent le nonce, l’un forge le bloc et le propage au réseau.',
      en: 'A signed transaction joins the mempool, multiple miners search for the nonce, one forges the block and propagates it to the network.',
    },
    category: 'distributed',
    tags: {
      fr: ['transaction', 'mempool', 'minage', 'preuve de travail', 'bitcoin'],
      en: ['transaction', 'mempool', 'mining', 'proof of work', 'bitcoin'],
    },
    spec: blockchain,
  },
  {
    id: 'smtp',
    title: { fr: 'Acheminement d’un courriel', en: 'Email routing' },
    description: {
      fr: 'Du client d’Alice à la boîte de Bob : envoi SMTP, résolution de l’enregistrement MX, relais entre serveurs de messagerie, puis relève IMAP.',
      en: "From Alice's client to Bob's inbox: SMTP dispatch, MX record resolution, relay between mail servers, then IMAP retrieval.",
    },
    category: 'infrastructure',
    tags: {
      fr: ['email', 'courriel', 'mx', 'imap', 'smtp', 'messagerie'],
      en: ['email', 'mail', 'mx', 'imap', 'smtp', 'messaging'],
    },
    spec: smtp,
  },
  {
    id: 'graphql',
    title: {
      fr: 'Passerelle GraphQL fédérée',
      en: 'Federated GraphQL gateway',
    },
    description: {
      fr: 'Une requête unique éclatée par la gateway vers plusieurs sous-graphes, dont les réponses sont recomposées en un seul objet.',
      en: 'A single request split by the gateway to multiple subgraphs, whose responses are recomposed into a single object.',
    },
    category: 'web-api',
    tags: {
      fr: ['graphql', 'gateway', 'fédération', 'sous-graphe', 'requête'],
      en: ['graphql', 'gateway', 'federation', 'subgraph', 'request'],
    },
    spec: graphql,
  },
  {
    id: 'webhook',
    title: {
      fr: 'Webhook avec ré-essais (back-off)',
      en: 'Webhook with retries (back-off)',
    },
    description: {
      fr: 'La livraison échoue deux fois (récepteur indisponible) puis réussit ; les temps morts entre tentatives matérialisent le back-off exponentiel.',
      en: 'Delivery fails twice (receiver unavailable) then succeeds; the dead times between attempts materialize the exponential back-off.',
    },
    category: 'realtime',
    tags: {
      fr: ['webhook', 'back-off', 'ré-essai', 'livraison', 'événement'],
      en: ['webhook', 'back-off', 'retry', 'delivery', 'event'],
    },
    spec: webhook,
  },
  {
    id: 'circular',
    title: { fr: 'Orchestration circulaire', en: 'Circular orchestration' },
    description: {
      fr: 'Disposition circulaire : un orchestrateur central distribue une commande aux services satellites puis agrège leurs confirmations.',
      en: 'Circular layout: a central orchestrator distributes a command to satellite services then aggregates their confirmations.',
    },
    category: 'engine',
    tags: {
      fr: ['disposition', 'circulaire', 'orchestrateur', 'layout', 'fan-out'],
      en: ['layout', 'circular', 'orchestrator', 'layout', 'fan-out'],
    },
    spec: circular,
  },
  {
    id: 'redBlackTree',
    title: {
      fr: 'Arbre rouge-noir — recoloration',
      en: 'Red-black tree — recoloring',
    },
    description: {
      fr: "Insertion d'une feuille rouge sous un parent rouge dont l'oncle est rouge aussi : le rééquilibrage se fait par pure recoloration (parent et oncle en noir, grand-parent en rouge), sans rotation. Illustre l'action set_color.",
      en: 'Inserting a red leaf under a red parent whose uncle is also red: rebalancing is a pure recoloring (parent and uncle to black, grandparent to red), no rotation. Showcases the set_color action.',
    },
    category: 'data-structures',
    tags: {
      fr: [
        'arbre',
        'rouge-noir',
        'recoloration',
        'set_color',
        'équilibrage',
        'structure de données',
      ],
      en: [
        'tree',
        'red-black',
        'recoloring',
        'set_color',
        'balancing',
        'data structure',
      ],
    },
    spec: redBlackTree,
  },
  {
    id: 'redBlackRotation',
    title: {
      fr: 'Arbre rouge-noir — rotation',
      en: 'Red-black tree — rotation',
    },
    description: {
      fr: "Le cas rotation : on insère un nœud rouge sous un parent rouge dont l'oncle est noir. La recoloration ne suffit pas — il faut une rotation puis une recoloration. Combine les actions rotate_subtree et set_color.",
      en: 'The rotation case: inserting a red node under a red parent whose uncle is black. Recoloring alone is not enough — it takes a rotation then a recoloring. Combines the rotate_subtree and set_color actions.',
    },
    category: 'data-structures',
    tags: {
      fr: [
        'arbre',
        'rouge-noir',
        'rotation',
        'rotate_subtree',
        'set_color',
        'équilibrage',
      ],
      en: [
        'tree',
        'red-black',
        'rotation',
        'rotate_subtree',
        'set_color',
        'balancing',
      ],
    },
    spec: redBlackRotation,
  },
  {
    id: 'avlTree',
    title: {
      fr: 'Arbre AVL — rotation',
      en: 'AVL tree — rotation',
    },
    description: {
      fr: "Insertion de 10, 20, 30 : l'arbre dégénère en chaîne à droite (facteur d'équilibre −2). Une seule rotation gauche le rééquilibre. Illustre direction:'tree' et l'action rotate_subtree (les nœuds glissent à leur nouvelle profondeur).",
      en: "Inserting 10, 20, 30 degenerates into a right-leaning chain (balance factor −2). A single left rotation rebalances it. Showcases direction:'tree' and the rotate_subtree action (nodes glide to their new depth).",
    },
    category: 'data-structures',
    tags: {
      fr: [
        'arbre',
        'avl',
        'rotation',
        'rotate_subtree',
        'équilibrage',
        'structure de données',
      ],
      en: [
        'tree',
        'avl',
        'rotation',
        'rotate_subtree',
        'balancing',
        'data structure',
      ],
    },
    spec: avlTree,
  },
  {
    id: 'bstSearch',
    title: {
      fr: 'Arbre binaire — recherche',
      en: 'Binary tree — search',
    },
    description: {
      fr: "Recherche d'une clé dans un arbre binaire de recherche : un jeton descend depuis la racine, compare à chaque nœud et bifurque à gauche ou à droite jusqu'à trouver la valeur. Illustre la descente pas à pas en O(log n).",
      en: 'Searching a key in a binary search tree: a token descends from the root, compares at each node and branches left or right until it finds the value. Shows the step-by-step O(log n) descent.',
    },
    category: 'data-structures',
    tags: {
      fr: [
        'arbre',
        'recherche',
        'bst',
        'parcours',
        'comparaison',
        'structure de données',
      ],
      en: [
        'tree',
        'search',
        'bst',
        'traversal',
        'comparison',
        'data structure',
      ],
    },
    spec: bstSearch,
  },
  {
    id: 'bstInsert',
    title: {
      fr: 'Arbre binaire — insertion',
      en: 'Binary tree — insertion',
    },
    description: {
      fr: "Insertion d'une clé dans un arbre binaire de recherche : la nouvelle clé arrive orpheline et descend pas à pas en comparant à chaque nœud, jusqu'au slot vide où le nœud est alors créé.",
      en: 'Inserting a key into a binary search tree: the new key arrives as an orphan and walks down step by step, comparing at each node, until the empty slot where the node is then created.',
    },
    category: 'data-structures',
    tags: {
      fr: [
        'arbre',
        'insertion',
        'bst',
        'orphelin',
        'descente',
        'structure de données',
      ],
      en: ['tree', 'insertion', 'bst', 'orphan', 'descent', 'data structure'],
    },
    spec: bstInsert,
  },
  {
    id: 'dijkstra',
    title: {
      fr: 'Plus court chemin — Dijkstra',
      en: 'Shortest path — Dijkstra',
    },
    description: {
      fr: "Algorithme de Dijkstra sur un graphe pondéré libre (direction:'graph', nœuds placés en x/y). On règle tour à tour le nœud non visité le plus proche ; chaque étape recolore le nœud et l’arête empruntée, faisant croître l’arbre des plus courts chemins jusqu’à la cible.",
      en: "Dijkstra's algorithm on a free weighted graph (direction:'graph', nodes placed via x/y). It settles the nearest unvisited node in turn; each step recolours the node and the edge it was reached through, growing the shortest-path tree to the target.",
    },
    category: 'data-structures',
    tags: {
      fr: [
        'graphe',
        'dijkstra',
        'plus court chemin',
        'pondéré',
        'x/y',
        'set_color',
      ],
      en: [
        'graph',
        'dijkstra',
        'shortest path',
        'weighted',
        'x/y',
        'set_color',
      ],
    },
    spec: dijkstra,
  },
  {
    id: 'astar',
    title: {
      fr: 'Plus court chemin — A*',
      en: 'Shortest path — A*',
    },
    description: {
      fr: "A* sur une grille (direction:'graph', nœuds placés en x/y) : Dijkstra guidé par une heuristique h(n) = distance de Manhattan restante. On développe toujours le nœud au plus petit f = g + h, si bien que la recherche file droit vers le but sans explorer les cases de côté.",
      en: "A* on a grid (direction:'graph', nodes placed via x/y): Dijkstra guided by a heuristic h(n) = Manhattan distance still to go. It always expands the node with the smallest f = g + h, so the search heads straight for the goal without exploring the sideways cells.",
    },
    category: 'data-structures',
    tags: {
      fr: ['graphe', 'a*', 'heuristique', 'plus court chemin', 'grille', 'x/y'],
      en: ['graph', 'a*', 'heuristic', 'shortest path', 'grid', 'x/y'],
    },
    spec: astar,
  },
  {
    id: 'mst',
    title: {
      fr: 'Arbre couvrant minimal — Kruskal',
      en: 'Minimum spanning tree — Kruskal',
    },
    description: {
      fr: "Algorithme de Kruskal (direction:'graph') : on trie les arêtes par poids et on ajoute la moins chère qui ne crée pas de cycle, jusqu’à relier les six nœuds par cinq arêtes. Les arêtes retenues passent au vert, celles qui formeraient un cycle sont écartées.",
      en: "Kruskal's algorithm (direction:'graph'): sort the edges by weight and add the cheapest one that does not form a cycle, until all six nodes are linked by five edges. Accepted edges turn green; those that would close a cycle are skipped.",
    },
    category: 'data-structures',
    tags: {
      fr: [
        'graphe',
        'kruskal',
        'arbre couvrant minimal',
        'recouvrement minimal',
        'cycle',
        'pondéré',
      ],
      en: [
        'graph',
        'kruskal',
        'minimum spanning tree',
        'mst',
        'cycle',
        'weighted',
      ],
    },
    spec: mst,
  },
  {
    id: 'collision',
    title: {
      fr: 'Anti-collision (voies parallèles)',
      en: 'Anti-collision (parallel lanes)',
    },
    description: {
      fr: 'Le segment App ↔ BD est emprunté dans les deux sens en même temps : le moteur décale automatiquement les trajets sur des voies parallèles.',
      en: 'The App ↔ DB segment is used in both directions simultaneously: the engine automatically offsets the paths into parallel lanes.',
    },
    category: 'engine',
    tags: {
      fr: ['anti-collision', 'voies parallèles', 'décalage', 'connexions'],
      en: ['anti-collision', 'parallel lanes', 'offset', 'connections'],
    },
    spec: collision,
  },
  {
    id: 'pushNotifications',
    title: { fr: 'Notifications push (FCM)', en: 'Push notifications (FCM)' },
    description: {
      fr: "Cycle de vie complet d'une notification push : comment l'appareil d'Alice fait connaître son adresse de livraison (le token FCM), puis comment un message envoyé par Bob est acheminé jusqu'à elle, même si son application est fermée.",
      en: "Full lifecycle of a push notification: how Alice's device registers its delivery address (the FCM token), then how a message sent by Bob is routed to her, even if her app is closed.",
    },
    category: 'realtime',
    tags: {
      fr: ['push', 'notification', 'fcm', 'firebase', 'mobile'],
      en: ['push', 'notification', 'fcm', 'firebase', 'mobile'],
    },
    spec: pushNotifications,
  },
  {
    id: 'circuit',
    title: {
      fr: 'Circuit électrique (courant)',
      en: 'Electrical circuit (current)',
    },
    description: {
      fr: 'Une boucle en série pile/interrupteur/résistance/LED sur `direction: circuit` : fils orthogonaux entre bornes nommées, fermeture de l’interrupteur (`toggle`) puis courant animé (`flow`) et LED qui s’allume.',
      en: 'A battery/switch/resistor/LED series loop on `direction: circuit`: orthogonal wires between named terminals, closing the switch (`toggle`), then animated current (`flow`) and the LED lighting up.',
    },
    category: 'electronics',
    tags: {
      fr: [
        'circuit',
        'électricité',
        'courant',
        'résistance',
        'led',
        'interrupteur',
        'bornes',
      ],
      en: [
        'circuit',
        'electricity',
        'current',
        'resistor',
        'led',
        'switch',
        'terminals',
      ],
    },
    spec: circuit,
  },
  {
    id: 'circuitParallel',
    title: {
      fr: 'Circuit parallèle (deux LED)',
      en: 'Parallel circuit (two LEDs)',
    },
    description: {
      fr: 'Deux LED en parallèle sur `direction: circuit` : le courant (`flow`) se sépare à la jonction, alimente les deux branches à la fois, puis se recombine.',
      en: 'Two LEDs in parallel on `direction: circuit`: the current (`flow`) splits at the junction, feeds both branches at once, then recombines.',
    },
    category: 'electronics',
    tags: {
      fr: ['circuit', 'électricité', 'parallèle', 'courant', 'led', 'jonction'],
      en: ['circuit', 'electricity', 'parallel', 'current', 'led', 'junction'],
    },
    spec: circuitParallel,
  },
  {
    id: 'ohmsLaw',
    title: {
      fr: 'Loi d’Ohm (tension, courant, puissance)',
      en: 'Ohm’s law (voltage, current, power)',
    },
    description: {
      fr: 'Explique la différence entre tension (différence de potentiel, aux bornes), courant (ampérage, à travers), résistance et puissance (V·I) sur un circuit série avec ampèremètre et voltmètre.',
      en: 'Explains the difference between voltage (potential difference, across), current (amperage, through), resistance and power (V·I) on a series circuit with an ammeter and a voltmeter.',
    },
    category: 'electronics',
    tags: {
      fr: [
        'loi d’ohm',
        'tension',
        'courant',
        'puissance',
        'résistance',
        'ampèremètre',
        'voltmètre',
        'volt',
        'ampère',
        'watt',
      ],
      en: [
        'ohms law',
        'voltage',
        'current',
        'power',
        'resistance',
        'ammeter',
        'voltmeter',
        'volt',
        'ampere',
        'watt',
      ],
    },
    spec: ohmsLaw,
  },
  {
    id: 'logicGates',
    title: { fr: 'Portes logiques', en: 'Logic gates' },
    description: {
      fr: 'Les six portes logiques de base (AND, OR, XOR, NAND, NOR, NOT), alimentées par les mêmes entrées, avec la règle de chacune et sa sortie.',
      en: 'The six core logic gates (AND, OR, XOR, NAND, NOR, NOT), fed the same inputs, with each one’s rule and output.',
    },
    category: 'electronics',
    tags: {
      fr: [
        'logique',
        'portes',
        'numérique',
        'and',
        'or',
        'xor',
        'nand',
        'nor',
        'not',
        'binaire',
      ],
      en: [
        'logic',
        'gates',
        'digital',
        'and',
        'or',
        'xor',
        'nand',
        'nor',
        'not',
        'binary',
      ],
    },
    spec: logicGates,
  },
  {
    id: 'halfAdder',
    title: {
      fr: 'Demi-additionneur (portes câblées)',
      en: 'Half-adder (wired gates)',
    },
    description: {
      fr: 'Diagramme numérique complet : deux bits A et B additionnés par un XOR (somme) et un AND (retenue), parcourant les quatre combinaisons.',
      en: 'A complete digital diagram: two bits A and B added by a XOR (sum) and an AND (carry), stepping through all four combinations.',
    },
    category: 'electronics',
    tags: {
      fr: [
        'additionneur',
        'demi-additionneur',
        'binaire',
        'xor',
        'and',
        'portes',
        'numérique',
        'somme',
        'retenue',
      ],
      en: [
        'adder',
        'half-adder',
        'binary',
        'xor',
        'and',
        'gates',
        'digital',
        'sum',
        'carry',
      ],
    },
    spec: halfAdder,
  },
  {
    id: 'halfAdderNand',
    title: {
      fr: 'Demi-additionneur (portes NAND)',
      en: 'Half-adder (NAND gates)',
    },
    description: {
      fr: 'Le demi-additionneur reconstruit uniquement avec des portes NAND (« universelles ») : cinq NAND reproduisent le XOR (somme) et le AND (retenue).',
      en: 'The half-adder rebuilt from NAND gates alone (the "universal" gate): five NANDs reproduce the XOR (sum) and AND (carry).',
    },
    category: 'electronics',
    tags: {
      fr: [
        'additionneur',
        'demi-additionneur',
        'nand',
        'porte universelle',
        'binaire',
        'portes',
        'numérique',
        'somme',
        'retenue',
      ],
      en: [
        'adder',
        'half-adder',
        'nand',
        'universal gate',
        'binary',
        'gates',
        'digital',
        'sum',
        'carry',
      ],
    },
    spec: halfAdderNand,
  },
  {
    id: 'halfSubtractorNand',
    title: {
      fr: 'Demi-soustracteur (portes NAND)',
      en: 'Half-subtractor (NAND gates)',
    },
    description: {
      fr: 'Le demi-soustracteur (A − B) construit uniquement avec des NAND : cinq portes donnent la différence (XOR) et l’emprunt (A′·B), en miroir du demi-additionneur.',
      en: 'The half-subtractor (A − B) from NAND gates alone: five gates give the difference (XOR) and the borrow (A′·B), mirroring the half-adder.',
    },
    category: 'electronics',
    tags: {
      fr: [
        'soustracteur',
        'demi-soustracteur',
        'nand',
        'porte universelle',
        'binaire',
        'portes',
        'numérique',
        'différence',
        'emprunt',
      ],
      en: [
        'subtractor',
        'half-subtractor',
        'nand',
        'universal gate',
        'binary',
        'gates',
        'digital',
        'difference',
        'borrow',
      ],
    },
    spec: halfSubtractorNand,
  },
  {
    id: 'fullAdderNand',
    title: {
      fr: 'Additionneur complet (portes NAND)',
      en: 'Full adder (NAND gates)',
    },
    description: {
      fr: 'L’additionneur complet (A + B + retenue) construit avec neuf portes NAND : deux XOR pour la somme, la retenue réutilisant leurs termes internes. La cellule de tout additionneur.',
      en: 'The full adder (A + B + carry) from nine NAND gates: two XORs for the sum, the carry reusing their inner terms. The cell of every adder.',
    },
    category: 'electronics',
    tags: {
      fr: [
        'additionneur',
        'additionneur complet',
        'nand',
        'porte universelle',
        'retenue',
        'binaire',
        'portes',
        'numérique',
        'somme',
      ],
      en: [
        'adder',
        'full adder',
        'nand',
        'universal gate',
        'carry',
        'binary',
        'gates',
        'digital',
        'sum',
      ],
    },
    spec: fullAdderNand,
  },
  {
    id: 'fullSubtractorNand',
    title: {
      fr: 'Soustracteur complet (portes NAND)',
      en: 'Full subtractor (NAND gates)',
    },
    description: {
      fr: 'Le soustracteur complet (A − B − emprunt) construit avec onze portes NAND : un double XOR pour la différence, l’emprunt réutilisant les termes internes du XOR.',
      en: 'The full subtractor (A − B − borrow) from eleven NAND gates: a double XOR for the difference, the borrow reusing the XOR’s inner terms.',
    },
    category: 'electronics',
    tags: {
      fr: [
        'soustracteur',
        'soustracteur complet',
        'nand',
        'porte universelle',
        'emprunt',
        'binaire',
        'portes',
        'numérique',
        'différence',
      ],
      en: [
        'subtractor',
        'full subtractor',
        'nand',
        'universal gate',
        'borrow',
        'binary',
        'gates',
        'digital',
        'difference',
      ],
    },
    spec: fullSubtractorNand,
  },
  {
    id: 'srLatch',
    title: {
      fr: 'Verrou SR (portes NAND)',
      en: 'SR latch (NAND gates)',
    },
    description: {
      fr: 'Deux portes NAND couplées en croix forment un verrou — un bit de mémoire. Entrées actives à l’état bas : mise à 1, remise à 0, et maintien (la mémoire).',
      en: 'Two cross-coupled NAND gates form a latch — one bit of memory. Active-low inputs stepping through set, reset and hold (the memory).',
    },
    category: 'electronics',
    tags: {
      fr: [
        'verrou',
        'bascule',
        'mémoire',
        'séquentiel',
        'nand',
        'sr',
        'numérique',
        'rebouclage',
      ],
      en: [
        'latch',
        'flip-flop',
        'memory',
        'sequential',
        'nand',
        'sr',
        'digital',
        'feedback',
      ],
    },
    spec: srLatch,
  },
  {
    id: 'rcCircuit',
    title: {
      fr: 'Circuit RC (charge)',
      en: 'RC circuit (charging)',
    },
    description: {
      fr: 'Une résistance charge un condensateur : le régime transitoire, la constante de temps τ = R·C, la montée exponentielle de la tension et l’arrêt du courant une fois chargé.',
      en: 'A resistor charges a capacitor: the transient response, the time constant τ = R·C, the exponential voltage rise, and the current stopping once charged.',
    },
    category: 'electronics',
    tags: {
      fr: [
        'rc',
        'condensateur',
        'charge',
        'transitoire',
        'constante de temps',
        'exponentiel',
        'résistance',
      ],
      en: [
        'rc',
        'capacitor',
        'charging',
        'transient',
        'time constant',
        'exponential',
        'resistor',
      ],
    },
    spec: rcCircuit,
  },
];

export const demosById: Record<string, Demo> = Object.fromEntries(
  demos.map((d) => [d.id, d])
);
