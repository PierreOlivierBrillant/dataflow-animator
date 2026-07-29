import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    client: 'Client',
    data: 'Data',
    authdb: 'Auth DB',
    datadb: 'Data DB',
    jsonBody: '[ orders ]',
    comment1: '1. Authentication',
    comment2: '2. Data Request (with JWT)',
    comment3: 'Data displayed ✅',
  },
  fr: {
    client: 'Client',
    data: 'Données',
    authdb: 'Auth DB',
    datadb: 'Data DB',
    jsonBody: '[ orders ]',
    comment1: '1. Authentification',
    comment2: '2. Requête de données (avec le JWT)',
    comment3: 'Données affichées ✅',
  },
};

export const microservices = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      {
        id: 'client',
        type: 'laptop',
        text: s.client,
        icon: 'react',
        lane: 1,
      },
      {
        id: 'nginx',
        type: 'server',
        text: 'Nginx',
        icon: 'nginx',
        lane: 2,
      },
      {
        id: 'auth',
        type: 'server',
        text: 'Auth',
        icon: 'dotnet',
        lane: 3,
      },
      {
        id: 'data',
        type: 'server',
        text: s.data,
        icon: 'node',
        lane: 3,
      },
      {
        id: 'authdb',
        type: 'database',
        text: s.authdb,
        icon: 'postgres',
        lane: 4,
      },
      {
        id: 'datadb',
        type: 'database',
        text: s.datadb,
        icon: 'mongodb',
        lane: 4,
      },
    ],
    connections: [
      { from: 'client', to: 'nginx', style: 'dotted' },
      { from: 'nginx', to: 'auth', style: 'dotted' },
      { from: 'nginx', to: 'data', style: 'dotted' },
      { from: 'auth', to: 'authdb', style: 'dotted' },
      { from: 'data', to: 'datadb', style: 'dotted' },
    ],
    packets: [
      {
        id: 'login',
        kind: 'http_packet',
        packet_content: { header: 'POST /login' },
      },
      {
        id: 'authq',
        kind: 'sql_request',
        request_content: 'SELECT * FROM users WHERE email=…',
      },
      { id: 'authr', kind: 'sql_response', response_content: { rows: 1 } },
      {
        id: 'token',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK',
          body: { type: 'text', value: 'JWT' },
        },
      },
      {
        id: 'get',
        kind: 'http_packet',
        packet_content: {
          header: 'GET /orders',
          body: { type: 'text', value: 'Bearer JWT' },
        },
      },
      {
        id: 'dataq',
        kind: 'sql_request',
        request_content: 'db.orders.find()',
      },
      {
        id: 'datar',
        kind: 'sql_response',
        response_content: { rows: 12 },
      },
      {
        id: 'json',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK',
          body: { type: 'text', value: s.jsonBody },
        },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'client',
        text: s.comment1,
        duration: 500,
      },
      {
        type: 'move',
        object: 'login',
        from: 'client',
        to: 'nginx',
        duration: 600,
      },
      {
        type: 'move',
        object: 'login',
        from: 'nginx',
        to: 'auth',
        duration: 600,
      },
      { type: 'loading', object: 'auth', duration: 500 },
      {
        type: 'move',
        object: 'authq',
        from: 'auth',
        to: 'authdb',
        duration: 600,
      },
      {
        type: 'loading',
        id: 'authdbwork',
        object: 'authdb',
        duration: 600,
      },
      {
        type: 'move',
        object: 'authr',
        from: 'authdb',
        to: 'auth',
        duration: 600,
        wait_for: 'authdbwork',
      },
      {
        type: 'move',
        object: 'token',
        from: 'auth',
        to: 'nginx',
        duration: 600,
      },
      {
        type: 'move',
        object: 'token',
        from: 'nginx',
        to: 'client',
        duration: 600,
      },
      {
        type: 'comment',
        object: 'client',
        text: s.comment2,
        duration: 500,
      },
      {
        type: 'move',
        object: 'get',
        from: 'client',
        to: 'nginx',
        duration: 600,
      },
      {
        type: 'move',
        object: 'get',
        from: 'nginx',
        to: 'data',
        duration: 600,
      },
      { type: 'loading', object: 'data', duration: 500 },
      {
        type: 'move',
        object: 'dataq',
        from: 'data',
        to: 'datadb',
        duration: 600,
      },
      {
        type: 'loading',
        id: 'datadbwork',
        object: 'datadb',
        duration: 600,
      },
      {
        type: 'move',
        object: 'datar',
        from: 'datadb',
        to: 'data',
        duration: 600,
        wait_for: 'datadbwork',
      },
      {
        type: 'move',
        object: 'json',
        from: 'data',
        to: 'nginx',
        duration: 600,
      },
      {
        type: 'move',
        object: 'json',
        from: 'nginx',
        to: 'client',
        duration: 600,
      },
      {
        type: 'comment',
        object: 'client',
        text: s.comment3,
        duration: 400,
      },
    ],
  };
};
