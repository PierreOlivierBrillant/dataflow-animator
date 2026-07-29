import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    cp: 'Control Plane',
    node: 'Compute Node',
    applyBody: 'replicas: 1',
    persistBody: 'desired spec',
    watchHeader: 'unassigned pod',
    bindHeader: 'bind → node A',
    createHeader: 'create container',
    createBody: 'image app:1.4.0',
    comment1: '1. We declare the desired state: kubectl apply -f deploy.yaml',
    comment2:
      '2. The API Server validates and persists the desired state in etcd',
    comment3:
      '3. The scheduler spots an unassigned pod and picks a node for it',
    comment4:
      '4. The kubelet of the chosen node receives the order and starts the container',
    running: '🟢 Running',
    comment5: 'Pod is running — desired state achieved ✅',
  },
  fr: {
    cp: 'Plan de contrôle',
    node: 'Nœud de calcul',
    applyBody: 'replicas: 1',
    persistBody: 'spec désirée',
    watchHeader: 'pod non assigné',
    bindHeader: 'bind → nœud A',
    createHeader: 'créer le conteneur',
    createBody: 'image app:1.4.0',
    comment1: '1. On déclare l’état désiré : kubectl apply -f deploy.yaml',
    comment2: '2. L’API Server valide et persiste l’état désiré dans etcd',
    comment3: '3. Le scheduler repère un pod sans nœud et lui en choisit un',
    comment4:
      '4. Le kubelet du nœud choisi reçoit l’ordre et lance le conteneur',
    running: '🟢 Running',
    comment5: 'Pod en cours d’exécution — état désiré atteint ✅',
  },
};

/**
 * Déploiement Kubernetes : de `kubectl apply` jusqu'au pod en cours d'exécution.
 * Une zone englobe les composants du plan de contrôle et du nœud. Met en avant
 * le rôle pivot de l'API Server et le découplage scheduler / kubelet.
 */
export const kubernetes = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'cli', type: 'laptop', text: 'kubectl', lane: 1 },
      { id: 'api', type: 'server', text: 'API Server', icon: 'k8s', lane: 2 },
      { id: 'etcd', type: 'database', text: 'etcd', icon: 'db', lane: 3 },
      { id: 'sched', type: 'server', text: 'Scheduler', lane: 3 },
      { id: 'kubelet', type: 'server', text: 'Kubelet', lane: 4 },
      { id: 'pod', type: 'server', text: 'Pod', icon: 'docker', lane: 5 },
    ],
    zones: [
      {
        id: 'cp',
        contains: ['api', 'etcd', 'sched'],
        color: '#2563eb',
        label: s.cp,
      },
      { contains: ['kubelet', 'pod'], color: '#16a34a', label: s.node },
    ],
    connections: [
      { from: 'cli', to: 'api', style: 'dotted' },
      { from: 'api', to: 'etcd', style: 'dotted' },
      { from: 'api', to: 'sched', style: 'dotted' },
      { from: 'api', to: 'kubelet', style: 'dotted' },
      { from: 'kubelet', to: 'pod', style: 'dotted' },
    ],
    packets: [
      {
        id: 'apply',
        kind: 'http_packet',
        packet_content: {
          header: 'apply Deployment',
          body: { type: 'text', value: s.applyBody },
        },
      },
      {
        id: 'persist',
        kind: 'http_packet',
        packet_content: {
          header: 'write',
          body: { type: 'text', value: s.persistBody },
        },
      },
      {
        id: 'watch',
        kind: 'http_packet',
        packet_content: { header: s.watchHeader },
      },
      {
        id: 'bind',
        kind: 'http_packet',
        packet_content: { header: s.bindHeader },
      },
      {
        id: 'create',
        kind: 'http_packet',
        packet_content: {
          header: s.createHeader,
          body: { type: 'text', value: s.createBody },
        },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'cli',
        text: s.comment1,
        duration: 2400,
      },
      {
        type: 'set_content',
        object: 'cli',
        content: {
          type: 'code',
          language: 'bash',
          value: '$ kubectl apply -f deploy.yaml',
        },
        keep_until: 'sch',
      },
      { type: 'move', object: 'apply', from: 'cli', to: 'api', duration: 1300 },
      {
        type: 'comment',
        object: 'api',
        text: s.comment2,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'persist',
        from: 'api',
        to: 'etcd',
        duration: 1200,
      },
      {
        type: 'comment',
        object: 'sched',
        text: s.comment3,
        duration: 2600,
      },
      {
        type: 'move',
        id: 'sch',
        object: 'watch',
        from: 'api',
        to: 'sched',
        duration: 1200,
      },
      { type: 'loading', id: 'decide', object: 'sched', duration: 1000 },
      {
        type: 'move',
        object: 'bind',
        from: 'sched',
        to: 'api',
        duration: 1200,
        wait_for: 'decide',
      },
      {
        type: 'comment',
        object: 'kubelet',
        text: s.comment4,
        duration: 2600,
      },
      {
        type: 'move',
        object: 'create',
        from: 'api',
        to: 'kubelet',
        duration: 1300,
      },
      {
        type: 'move',
        object: 'create',
        from: 'kubelet',
        to: 'pod',
        duration: 1100,
      },
      { type: 'loading', id: 'boot', object: 'pod', duration: 1200 },
      {
        type: 'set_content',
        object: 'pod',
        content: { type: 'text', value: s.running },
        keep_until_end: true,
        wait_for: 'boot',
      },
      {
        type: 'comment',
        object: 'pod',
        text: s.comment5,
        duration: 2200,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
