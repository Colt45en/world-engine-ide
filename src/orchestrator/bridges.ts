import { EnvelopeV1 } from './orchestrator';

export type BridgeResult =
  | { ok: true; detail?: string }
  | { ok: false; error: string; retryable: boolean };

export interface Bridge {
  name: string;
  send(env: EnvelopeV1): Promise<BridgeResult>;
}

export class ConsoleBridge implements Bridge {
  name = 'console';
  async send(env: EnvelopeV1): Promise<BridgeResult> {
    console.log(`[ConsoleBridge] ${env.routing.topic} ${env.kind}`, {
      event_id: env.event_id,
      world_id: env.world_id,
      tags: env.tags,
      payload: env.payload,
    });
    return { ok: true };
  }
}

// WS bridge: attempts to use 'ws' but falls back to no-op if not installed
export class WSBridge implements Bridge {
  name = 'ws';
  private readonly url: string;
  private ws: any = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectMs = 500;

  constructor(url = 'ws://localhost:9000') {
    this.url = url;
    this.connect();
  }

  private connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    let WebSocket: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      WebSocket = require('ws');
    } catch {
      // Treat missing ws as a permanent configuration issue.
      this.ws = null;
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        this.reconnectMs = 500;
      });

      this.ws.on('close', () => {
        this.scheduleReconnect();
      });

      this.ws.on('error', () => {
        this.scheduleReconnect();
      });
    } catch {
      this.ws = null;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = this.reconnectMs;
    this.reconnectMs = Math.min(this.reconnectMs * 2, 10_000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  async send(env: EnvelopeV1): Promise<BridgeResult> {
    if (!this.ws) return { ok: false, error: 'ws-not-installed', retryable: false };
    // ws.OPEN === 1
    if (this.ws.readyState !== 1) return { ok: false, error: 'ws-not-ready', retryable: true };
    try {
      this.ws.send(JSON.stringify(env));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'ws-send-failed', retryable: true };
    }
  }
}

// Simple SQLite sink bridge for demo: stores the envelope JSON for inspection.
// NOTE: This is NOT an outbox. The orchestrator already implements an outbox.
export class SQLiteMemoryBridge implements Bridge {
  name = 'sqlite-memory';
  private db: any = null;
  private readonly inMemory: any[] = [];
  private ready: Promise<void> | null = null;
  private initError: unknown = null;

  constructor(public dbPath = './orch_outbox.sqlite') {
    // Defer initialization to first use to avoid async work inside the constructor.
  }

  private ensureInitialized(): Promise<void> {
    if (this.ready) return this.ready;

    this.ready = (async () => {
      const createSql =
        'CREATE TABLE IF NOT EXISTS memory_events (event_id TEXT PRIMARY KEY, world_id TEXT, kind TEXT, topic TEXT, created_at TEXT, envelope_json TEXT)';

      try {
        const Better = require('better-sqlite3');
        this.db = new Better(this.dbPath);
        this.db.prepare(createSql).run();
        return;
      } catch (error_) {
        this.initError = error_;
      }

      try {
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(this.dbPath);

        await new Promise<void>((resolve, reject) => {
          db.run(createSql, (err: any) => (err ? reject(err) : resolve()));
        });

        this.db = db;
      } catch (error_) {
        this.initError = error_;
        console.warn(
          '[SQLiteMemoryBridge] sqlite not installed or failed to initialize; falling back to in-memory store',
          error_,
        );
        this.db = null;
      }
    })();

    return this.ready;
  }

  private runSqlite3(sql: string, params: any[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.run(sql, ...params, (err: any) => (err ? reject(err) : resolve()));
    });
  }

  async send(env: EnvelopeV1): Promise<BridgeResult> {
    try {
      await this.ensureInitialized();

      const item = {
        event_id: env.event_id,
        world_id: env.world_id,
        kind: env.kind,
        topic: env.routing.topic,
        created_at: new Date().toISOString(),
        envelope_json: JSON.stringify(env),
      };

      const insertSql =
        'INSERT OR REPLACE INTO memory_events (event_id,world_id,kind,topic,created_at,envelope_json) VALUES (?,?,?,?,?,?)';

      if (this.db?.prepare) {
        this.db
          .prepare(insertSql)
          .run(
            item.event_id,
            item.world_id,
            item.kind,
            item.topic,
            item.created_at,
            item.envelope_json,
          );
      } else if (this.db?.run) {
        // sqlite3 driver (async)
        await this.runSqlite3(insertSql, [
          item.event_id,
          item.world_id,
          item.kind,
          item.topic,
          item.created_at,
          item.envelope_json,
        ]);
      } else {
        this.inMemory.push(item);
      }

      return { ok: true, detail: 'stored' };
    } catch (error_: any) {
      const msg =
        error_?.message ?? (this.initError && (this.initError as any)?.message) ?? 'sqlite-failed';
      return { ok: false, error: msg, retryable: true };
    }
  }
}
