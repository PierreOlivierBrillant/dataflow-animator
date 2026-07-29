import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    dev: 'Developer',
    repo: 'Remote repo',
    ci: 'CI Runner',
    registry: 'Image registry',
    prod: 'Production',
    pipelineZone: 'Automated pipeline',
    pushBody: 'feat: new page',
    hookBody: 'push on main',
    deployHeader: 'deployment',
    deployBody: 'pull app:1.4.0',
    comment1: '1. The developer pushes their branch',
    comment2: '2. The push on main triggers the pipeline (webhook)',
    comment3: '3. The runner installs dependencies and runs tests',
    ciSuccess: '✓ 128 tests passed\n✓ build successful',
    comment4: '4. Build the Docker image, then publish to the registry',
    comment5: '5. Deploy the new image to production',
    comment6: 'Version 1.4.0 online 🚀',
  },
  fr: {
    dev: 'Développeur',
    repo: 'Dépôt distant',
    ci: 'Runner CI',
    registry: 'Registry d’images',
    prod: 'Production',
    pipelineZone: 'Pipeline automatisé',
    pushBody: 'feat: nouvelle page',
    hookBody: 'push sur main',
    deployHeader: 'déploiement',
    deployBody: 'pull app:1.4.0',
    comment1: '1. Le développeur pousse sa branche',
    comment2: '2. Le push sur main déclenche le pipeline (webhook)',
    comment3: '3. Le runner installe les dépendances et lance les tests',
    ciSuccess: '✓ 128 tests passés\n✓ build réussi',
    comment4: '4. Build de l’image Docker, puis publication dans le registry',
    comment5: '5. Déploiement de la nouvelle image en production',
    comment6: 'Version 1.4.0 en ligne 🚀',
  },
};

/**
 * Pipeline CI/CD : du `git push` jusqu'au déploiement en production. Met en
 * scène une zone « Pipeline » regroupant les étapes automatisées, et plusieurs
 * `loading` (tests, build) pour matérialiser le temps de traitement.
 */
export const cicd = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'dev', type: 'laptop', text: s.dev, icon: 'git', lane: 1 },
      { id: 'repo', type: 'server', text: s.repo, icon: 'git', lane: 2 },
      { id: 'ci', type: 'server', text: s.ci, icon: 'docker', lane: 3 },
      {
        id: 'registry',
        type: 'database',
        text: s.registry,
        icon: 'docker',
        lane: 4,
      },
      { id: 'prod', type: 'cloud', text: s.prod, icon: 'aws', lane: 5 },
    ],
    zones: [
      {
        contains: ['ci', 'registry'],
        color: '#7c3aed',
        label: s.pipelineZone,
      },
    ],
    connections: [
      { from: 'dev', to: 'repo', style: 'dotted' },
      { from: 'repo', to: 'ci', style: 'dotted' },
      { from: 'ci', to: 'registry', style: 'dotted' },
      { from: 'registry', to: 'prod', style: 'dotted' },
    ],
    packets: [
      {
        id: 'push',
        kind: 'http_packet',
        packet_content: {
          header: 'git push',
          body: { type: 'text', value: s.pushBody },
        },
      },
      {
        id: 'hook',
        kind: 'http_packet',
        packet_content: {
          header: 'webhook',
          body: { type: 'text', value: s.hookBody },
        },
      },
      {
        id: 'image',
        kind: 'http_packet',
        packet_content: {
          header: 'docker push',
          body: { type: 'text', value: 'app:1.4.0' },
        },
      },
      {
        id: 'deploy',
        kind: 'http_packet',
        packet_content: {
          header: s.deployHeader,
          body: { type: 'text', value: s.deployBody },
        },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'dev',
        text: s.comment1,
        duration: 2000,
      },
      {
        type: 'set_content',
        object: 'dev',
        content: {
          type: 'code',
          language: 'bash',
          value: '$ git push origin main',
        },
        keep_until: 'hookstep',
      },
      { type: 'move', object: 'push', from: 'dev', to: 'repo', duration: 1300 },
      {
        type: 'comment',
        object: 'repo',
        text: s.comment2,
        duration: 2200,
      },
      {
        type: 'move',
        id: 'hookstep',
        object: 'hook',
        from: 'repo',
        to: 'ci',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'ci',
        text: s.comment3,
        duration: 2400,
      },
      { type: 'loading', object: 'ci', duration: 1400 },
      {
        type: 'set_content',
        object: 'ci',
        content: {
          type: 'code',
          language: 'bash',
          value: s.ciSuccess,
        },
        keep_until: 'deploystep',
      },
      {
        type: 'comment',
        object: 'ci',
        text: s.comment4,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'image',
        from: 'ci',
        to: 'registry',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'registry',
        text: s.comment5,
        duration: 2200,
      },
      {
        type: 'move',
        id: 'deploystep',
        object: 'deploy',
        from: 'registry',
        to: 'prod',
        duration: 1400,
      },
      { type: 'loading', id: 'rollout', object: 'prod', duration: 1200 },
      {
        type: 'comment',
        object: 'prod',
        text: s.comment6,
        duration: 2200,
        wait_for: 'rollout',
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
