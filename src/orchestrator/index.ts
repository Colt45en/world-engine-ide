#!/usr/bin/env ts-node
import { bridgeAsLinkSender } from './bridge-adapter';
import { ConsoleBridge, SQLiteMemoryBridge, WSBridge } from './bridges';
import { LinkRegistry, Orchestrator, Router } from './orchestrator';

const rules = [
  (env: any) => {
    if (env.kind === 'memory.write') {
      return { topic: 'memory.write', links: ['db.memory', 'log.console', 'ws.brain'] };
    }
    if (env.kind.startsWith('assets.import')) {
      return { topic: 'assets.import', links: ['log.console'] };
    }
    if (env.kind.startsWith('ops.')) {
      return { topic: env.kind, links: ['log.console'] };
    }
    return null;
  },
];

async function main() {
  const router = new Router(rules);
  const links = new LinkRegistry();
  links.register('log.console', bridgeAsLinkSender(new ConsoleBridge()));
  links.register(
    'ws.brain',
    bridgeAsLinkSender(new WSBridge(process.env.BRAIN_RELAY_URL ?? 'ws://localhost:9000')),
  );
  links.register('db.memory', bridgeAsLinkSender(new SQLiteMemoryBridge('./orch_outbox.sqlite')));

  const orch = new Orchestrator(router, links, { enableOutbox: true });

  orch.on('memory.write', async (env) => {
    if (typeof (env.payload as any)?.text !== 'string') {
      await orch.ingest({
        world_id: env.world_id,
        kind: 'ops.validation_failed',
        tags: ['memory'],
        payload: { reason: 'memory.write requires payload.text:string' },
        trace_id: env.trace.trace_id,
        priority: 'high',
        event_id: env.event_id + ':validation',
      });
      return;
    }
    console.log('[Orch] memory.write handled; would enqueue embedding job here');
  });

  orch.on('ops.dlq', async (env) => {
    console.error('[DLQ]', env.payload);
  });

  // Demo ingestion
  await orch.ingest({
    world_id: 'world-001',
    kind: 'memory.write',
    tags: ['narrative', 'player'],
    payload: { text: 'Colten entered the copper citadel at dusk.' },
    priority: 'normal',
    session_id: 'sess-123',
  });

  // invalid payload -> ops event
  await orch.ingest({
    world_id: 'world-001',
    kind: 'memory.write',
    tags: ['narrative'],
    payload: { notText: true },
    priority: 'normal',
  });

  // assets import
  await orch.ingest({
    world_id: 'world-001',
    kind: 'assets.import.requested',
    tags: ['asset', 'import'],
    payload: { uri: 'file://textures/stone.png', checksum: 'abc123' },
  });
}

if (require.main === module) {
  (async () => {
    try {
      await main();

      // Keep process alive in daemon mode when ORCH_DAEMON=1 is set (useful for containers)
      if (process.env.ORCH_DAEMON === '1') {
        console.log('[Orchestrator] Daemon mode enabled — keeping process alive');
        setInterval(() => {
          // noop; keep alive
        }, 1e9);
      } else {
        // exit after demo run
        console.log('[Orchestrator] Demo finished; exiting');
        process.exit(0);
      }
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  })();
}
