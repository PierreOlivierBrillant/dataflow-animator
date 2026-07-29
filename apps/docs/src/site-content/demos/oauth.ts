import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    user: 'User',
    app: 'Application',
    idp: 'Authorization Server',
    api: 'Resource API',
    loginHeader: 'Login',
    consentHeader: 'I authorize ✅',
    comment1: '1. The user clicks on "Login"',
    comment2: '2. The app redirects the browser to the authorization server',
    comment3: '3. The user authenticates and grants the requested permissions',
    comment4: '4. The server returns a one-time authorization code',
    comment5:
      '5. Back channel: the app exchanges the code for a token (with its secret)',
    comment6: '6. With the access token, the app calls the resource API',
    comment7: 'Profile obtained, user logged in 🎉',
  },
  fr: {
    user: 'Utilisateur',
    app: 'Application',
    idp: 'Serveur d’autorisation',
    api: 'API de ressources',
    loginHeader: 'Se connecter',
    consentHeader: 'J’autorise ✅',
    comment1: '1. L’utilisateur clique sur « Se connecter »',
    comment2: '2. L’app redirige le navigateur vers le serveur d’autorisation',
    comment3:
      '3. L’utilisateur s’authentifie et accorde les permissions demandées',
    comment4: '4. Le serveur renvoie un code d’autorisation à usage unique',
    comment5:
      '5. Canal arrière : l’app échange le code contre un jeton (avec son secret)',
    comment6: '6. Munie du jeton d’accès, l’app appelle l’API de ressources',
    comment7: 'Profil obtenu, utilisateur connecté 🎉',
  },
};

/**
 * OAuth 2.0 / OpenID Connect — flot « Authorization Code ». Quatre acteurs :
 * l'utilisateur, l'application cliente, le serveur d'autorisation et l'API de
 * ressources. On distingue bien le canal frontal (redirections) du canal
 * arrière (échange code ↔ token), d'où le rythme étalé.
 */
export const oauth = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'user', type: 'user', text: s.user, lane: 1 },
      { id: 'app', type: 'server', text: s.app, icon: 'react', lane: 2 },
      {
        id: 'idp',
        type: 'server',
        text: s.idp,
        icon: 'OIDC',
        lane: 3,
      },
      {
        id: 'api',
        type: 'server',
        text: s.api,
        icon: 'node',
        lane: 3,
      },
    ],
    connections: [
      { from: 'user', to: 'app', style: 'dotted' },
      { from: 'app', to: 'idp', style: 'dotted' },
      { from: 'app', to: 'api', style: 'dotted' },
    ],
    packets: [
      {
        id: 'login',
        kind: 'http_packet',
        packet_content: { header: s.loginHeader },
      },
      {
        id: 'redirect',
        kind: 'http_packet',
        packet_content: {
          header: '302 → /authorize',
          body: { type: 'text', value: 'client_id, scope, state' },
        },
      },
      {
        id: 'consent',
        kind: 'http_packet',
        packet_content: { header: s.consentHeader },
      },
      {
        id: 'code',
        kind: 'http_packet',
        packet_content: {
          header: '302 → /callback',
          body: { type: 'text', value: 'code=AUTH_CODE' },
        },
      },
      {
        id: 'exchange',
        kind: 'http_packet',
        packet_content: {
          header: 'POST /token',
          body: { type: 'text', value: 'code + client_secret' },
        },
      },
      {
        id: 'token',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK',
          body: { type: 'text', value: 'access_token (JWT)' },
        },
      },
      {
        id: 'call',
        kind: 'http_packet',
        packet_content: {
          header: 'GET /me',
          body: { type: 'text', value: 'Bearer access_token' },
        },
      },
      {
        id: 'profile',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK',
          body: { type: 'text', value: '{ "name": "Alice" }' },
        },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'user',
        text: s.comment1,
        duration: 2000,
      },
      {
        type: 'move',
        object: 'login',
        from: 'user',
        to: 'app',
        duration: 1200,
      },
      {
        type: 'comment',
        object: 'app',
        text: s.comment2,
        duration: 2200,
      },
      {
        type: 'move',
        object: 'redirect',
        from: 'app',
        to: 'idp',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'idp',
        text: s.comment3,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'consent',
        from: 'user',
        to: 'idp',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'idp',
        text: s.comment4,
        duration: 2200,
      },
      { type: 'move', object: 'code', from: 'idp', to: 'app', duration: 1300 },
      {
        type: 'comment',
        object: 'app',
        text: s.comment5,
        duration: 2600,
      },
      {
        type: 'move',
        object: 'exchange',
        from: 'app',
        to: 'idp',
        duration: 1300,
      },
      { type: 'loading', id: 'mint', object: 'idp', duration: 1000 },
      {
        type: 'move',
        object: 'token',
        from: 'idp',
        to: 'app',
        duration: 1300,
        wait_for: 'mint',
      },
      {
        type: 'comment',
        object: 'app',
        text: s.comment6,
        duration: 2400,
      },
      { type: 'move', object: 'call', from: 'app', to: 'api', duration: 1300 },
      { type: 'loading', id: 'check', object: 'api', duration: 900 },
      {
        type: 'move',
        object: 'profile',
        from: 'api',
        to: 'app',
        duration: 1300,
        wait_for: 'check',
      },
      {
        type: 'comment',
        object: 'app',
        text: s.comment7,
        duration: 2000,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
