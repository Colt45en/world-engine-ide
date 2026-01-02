import { randomUUID } from 'node:crypto';

export type Priority = 'low' | 'normal' | 'high';

export type EnvelopeV1<T = unknown> = {
  schema: 'world.envelope@v1';
  version: number;
  event_id: string;
  ts: string;
  world_id: string;
  shard?: string;
  kind: string;
  source: {
    system: string;
    actor: 'user' | 'agent' | 'system';
    session_id?: string;
  };
  trace: {
    trace_id: string;
    span_id: string;
    parent_span_id?: string;
  };
  tags: string[];
  routing: { topic: string; priority: Priority };
  payload: T;
};

export type RouteDecision = { topic: string; links: string[] };

export type Handler = (env: EnvelopeV1) => Promise<void>;

export class Bus {
  private readonly handlers: Map<string, Handler[]> = new Map();

  on(topic: string, handler: Handler) {
    const arr = this.handlers.get(topic) ?? [];
    arr.push(handler);
    this.handlers.set(topic, arr);
  }

  /**
   * Publish with subscriber isolation:
   * - handlers are invoked sequentially (preserves ordering in demo)
   * - handler errors are captured and returned (not thrown)
   */
  async publish(
    topic: string,
    env: EnvelopeV1,
  ): Promise<{ errors: { topic: string; error: unknown }[] }> {
    const exact = this.handlers.get(topic) ?? [];
    const wildcard = this.matchWildcards(topic);
    const targets = [...exact, ...wildcard];

    const errors: { topic: string; error: unknown }[] = [];
    for (const h of targets) {
      try {
        // fire sequentially to keep ordering simple in demo
        await h(env);
      } catch (err) {
        errors.push({ topic, error: err });
      }
    }

    return { errors };
  }

  private matchWildcards(topic: string): Handler[] {
    const out: Handler[] = [];
    for (const [k, hs] of this.handlers.entries()) {
      if (k.endsWith('.*')) {
        const prefix = k.slice(0, -2);
        if (topic.startsWith(prefix + '.')) out.push(...hs);
      }
    }
    return out;
  }
}

export class IdempotencyStore {
  private readonly state = new Map<string, 'processing' | 'processed'>();

  get(id: string) {
    return this.state.get(id);
  }

  markProcessing(id: string) {
    this.state.set(id, 'processing');
  }

  markProcessed(id: string) {
    this.state.set(id, 'processed');
  }

  clear(id: string) {
    this.state.delete(id);
  }
}

export type OutboxItem = {
  outbox_id: string;
  event_id: string;
  link: string;
  env: EnvelopeV1;
  attempts: number;
  last_error?: string;
  created_at: string;
  terminal?: boolean;
};

export class Outbox {
  private items: OutboxItem[] = [];

  add(event_id: string, link: string, env: EnvelopeV1) {
    this.items.push({
      outbox_id: randomUUID(),
      event_id,
      link,
      env,
      attempts: 0,
      created_at: new Date().toISOString(),
      terminal: false,
    });
  }

  list() {
    return [...this.items];
  }

  getPending(limit?: number) {
    const pending = this.items.filter((x) => !x.terminal);
    return typeof limit === 'number' ? pending.slice(0, limit) : pending;
  }

  update(outbox_id: string, patch: Partial<OutboxItem>) {
    const idx = this.items.findIndex((x) => x.outbox_id === outbox_id);
    if (idx >= 0) this.items[idx] = { ...this.items[idx], ...patch };
  }

  remove(outbox_id: string) {
    this.items = this.items.filter((x) => x.outbox_id !== outbox_id);
  }
}

export type RouterRule = (env: EnvelopeV1) => RouteDecision | null;

export class Router {
  constructor(private readonly rules: RouterRule[]) {}

  decide(env: EnvelopeV1): RouteDecision {
    for (const r of this.rules) {
      const d = r(env);
      if (d) return d;
    }
    return { topic: env.routing.topic, links: [] };
  }
}

export class LinkRegistry {
  private readonly links = new Map<
    string,
    {
      send: (
        env: EnvelopeV1,
      ) => Promise<{ ok: boolean; detail?: string; error?: string; retryable?: boolean }>;
    }
  >();

  register(
    linkName: string,
    sender: {
      send: (
        env: EnvelopeV1,
      ) => Promise<{ ok: boolean; detail?: string; error?: string; retryable?: boolean }>;
    },
  ) {
    this.links.set(linkName, sender);
  }

  get(linkName: string) {
    const v = this.links.get(linkName);
    if (!v) throw new Error(`Unknown link: ${linkName}`);
    return v;
  }
}

export class Orchestrator {
  private bus = new Bus();
  private idem = new IdempotencyStore();
  private outbox = new Outbox();

  constructor(
    private router: Router,
    private links: LinkRegistry,
    private opts: {
      enableOutbox: boolean;
      maxAttempts?: number;
      flushPendingPerIngest?: number;
    } = {
      enableOutbox: true,
      maxAttempts: 5,
      flushPendingPerIngest: 50,
    },
  ) {}

  on(topic: string, handler: Handler) {
    this.bus.on(topic, handler);
  }

  async ingest(input: {
    world_id: string;
    kind: string;
    topic?: string;
    tags?: string[];
    source?: EnvelopeV1['source'];
    payload: unknown;
    priority?: Priority;
    trace_id?: string;
    parent_span_id?: string;
    session_id?: string;
    event_id?: string;
  }) {
    const env = this.normalize(input);

    const state = this.idem.get(env.event_id);
    if (state === 'processed') return;
    if (state === 'processing') return;
    this.idem.markProcessing(env.event_id);

    try {
      const decision = this.router.decide(env);
      // Reflect routing choice back into envelope for downstream consistency.
      env.routing.topic = decision.topic;

      const pub = await this.bus.publish(decision.topic, env);

      if (pub.errors.length) {
        await this.bus.publish('ops.dlq', {
          ...env,
          kind: 'ops.dlq',
          routing: { topic: 'ops.dlq', priority: 'high' },
          tags: [...env.tags, 'dlq', 'handler_error'],
          payload: {
            reason: 'handler_error',
            handler_errors: pub.errors.map((e) => ({
              topic: e.topic,
              error: this.errToString(e.error),
            })),
          },
        });
      }

      for (const link of decision.links) {
        if (this.opts.enableOutbox) {
          this.outbox.add(env.event_id, link, env);
        } else {
          await this.dispatchLink(link, env);
        }
      }

      if (this.opts.enableOutbox) {
        await this.flushAllOutbox(this.opts.flushPendingPerIngest);
      }

      this.idem.markProcessed(env.event_id);
    } catch (err) {
      // Allow re-ingest attempts if we crashed mid-flight.
      this.idem.clear(env.event_id);
      throw err;
    }
  }

  async flushAllOutbox(limit?: number) {
    const maxAttempts = this.opts.maxAttempts ?? 5;
    const items = this.outbox.getPending(limit);

    for (const item of items) {
      const env = item.env;
      const res = await this.dispatchLink(item.link, env);

      if (res.ok) {
        this.outbox.remove(item.outbox_id);
        continue;
      }

      const attempts = item.attempts + 1;
      this.outbox.update(item.outbox_id, { attempts, last_error: res.error });

      const retryable = res.retryable !== false;
      if (!retryable || attempts >= maxAttempts) {
        await this.bus.publish('ops.dlq', {
          ...env,
          kind: 'ops.dlq',
          routing: { topic: 'ops.dlq', priority: 'high' },
          tags: [...env.tags, 'dlq', 'link_error'],
          payload: { failed_link: item.link, error: res.error, attempts },
        });
        // Terminalize to prevent repeated DLQ spam.
        this.outbox.update(item.outbox_id, { terminal: true });
        this.outbox.remove(item.outbox_id);
      }
    }
  }

  private async dispatchLink(linkName: string, env: EnvelopeV1) {
    const sender = this.links.get(linkName);
    return sender.send(env);
  }

  private normalize(input: {
    world_id: string;
    kind: string;
    topic?: string;
    tags?: string[];
    source?: EnvelopeV1['source'];
    payload: unknown;
    priority?: Priority;
    trace_id?: string;
    parent_span_id?: string;
    session_id?: string;
    event_id?: string;
  }): EnvelopeV1 {
    const trace_id = input.trace_id ?? randomUUID();
    const span_id = randomUUID();
    return {
      schema: 'world.envelope@v1',
      version: 1,
      event_id: input.event_id ?? randomUUID(),
      ts: new Date().toISOString(),
      world_id: input.world_id,
      shard: this.shardOf(input.world_id),
      kind: input.kind,
      source: input.source ?? { system: 'chatgpt', actor: 'agent', session_id: input.session_id },
      trace: { trace_id, span_id, parent_span_id: input.parent_span_id },
      tags: input.tags ?? [],
      routing: { topic: input.topic ?? input.kind, priority: input.priority ?? 'normal' },
      payload: input.payload,
    };
  }

  private shardOf(world_id: string) {
    const n = [...world_id].reduce((a, c) => a + c.charCodeAt(0), 0) % 8;
    return `local/${n}`;
  }

  private errToString(e: unknown) {
    if (e instanceof Error) return e.message;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
}
