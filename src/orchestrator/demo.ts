import { bridgeAsLinkSender } from './bridge-adapter';
import { ConsoleBridge, SQLiteMemoryBridge, WSBridge } from './bridges';
import { LinkRegistry, Orchestrator, Router } from './orchestrator';

export async function runDemo() {
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
    console.log('[demo] memory.write ->', env.payload);
  });

  await orch.ingest({
    world_id: 'demo-world',
    kind: 'memory.write',
    tags: ['demo'],
    payload: { text: 'Hello from orchestrator demo' },
  });
}

if (require.main === module) {
  runDemo().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
