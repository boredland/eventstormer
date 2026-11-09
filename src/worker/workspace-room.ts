import { DurableObject } from 'cloudflare:workers';
import type {
  WorkspaceState,
  StickyType,
  StickyNote,
  PivotalLine,
  Swimlane,
  ClientMessage,
  ServerMessage,
  PeerCursor,
  WorkshopFormat,
} from '../shared/eventstorming';
import { SAMPLE_TEMPLATES } from '../shared/eventstorming';

interface SocketAttachment {
  clientId: string;
  name: string;
  color: string;
  windowStart: number;
  messageCount: number;
}

export class WorkspaceRoom extends DurableObject<CloudflareEnv> {
  private initialized = false;

  constructor(ctx: DurableObjectState, env: CloudflareEnv) {
    super(ctx, env);
    this.ensureSchema();
  }

  private ensureSchema() {
    if (this.initialized) return;
    const sql = this.ctx.storage.sql;

    sql.exec(`
      CREATE TABLE IF NOT EXISTS workspace_state (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    sql.exec(`
      CREATE TABLE IF NOT EXISTS stickies (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        votes INTEGER DEFAULT 0,
        author_name TEXT,
        author_color TEXT,
        custom_color TEXT,
        updated_at INTEGER NOT NULL
      );
    `);

    sql.exec(`
      CREATE TABLE IF NOT EXISTS pivotal_lines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        x REAL NOT NULL,
        color TEXT
      );
    `);

    sql.exec(`
      CREATE TABLE IF NOT EXISTS swimlanes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        y REAL NOT NULL,
        height REAL NOT NULL,
        color TEXT
      );
    `);

    // Initialize default metadata if missing
    const formatRow = sql.exec<{ value: string }>(
      `SELECT value FROM workspace_state WHERE key = 'format'`
    ).toArray();

    if (formatRow.length === 0) {
      sql.exec(
        `INSERT INTO workspace_state (key, value) VALUES 
          ('format', 'big-picture'),
          ('current_phase', '0'),
          ('timer_seconds', '900'),
          ('timer_running', '0'),
          ('timer_last_tick', '0'),
          ('name', 'New Workshop')`
      );
    }

    this.touchActivity();
    this.initialized = true;
  }

  private async touchActivity() {
    // 30 days inactivity auto-archival alarm
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    await this.ctx.storage.setAlarm(Date.now() + thirtyDaysMs);
  }

  async alarm(): Promise<void> {
    // Auto-archival alarm fired: purge abandoned board to avoid unbounded storage costs
    const sql = this.ctx.storage.sql;
    sql.exec('DROP TABLE IF EXISTS stickies');
    sql.exec('DROP TABLE IF EXISTS pivotal_lines');
    sql.exec('DROP TABLE IF EXISTS swimlanes');
    sql.exec('DROP TABLE IF EXISTS workspace_state');
    await this.ctx.storage.deleteAll();
  }

  private getState(): WorkspaceState {
    this.ensureSchema();
    const sql = this.ctx.storage.sql;

    // Load state key-values
    const stateRows = sql.exec<{ key: string; value: string }>(
      `SELECT key, value FROM workspace_state`
    ).toArray();

    const stateMap = new Map<string, string>();
    for (const row of stateRows) {
      stateMap.set(row.key, row.value);
    }

    const format = (stateMap.get('format') || 'big-picture') as WorkshopFormat;
    const currentPhaseIndex = parseInt(stateMap.get('current_phase') || '0', 10);
    let timerSecondsRemaining = parseInt(stateMap.get('timer_seconds') || '900', 10);
    const timerIsRunning = stateMap.get('timer_running') === '1';
    const timerLastTickAt = parseInt(stateMap.get('timer_last_tick') || '0', 10);

    // Adjust timer if running
    if (timerIsRunning && timerLastTickAt > 0) {
      const elapsedSeconds = Math.floor((Date.now() - timerLastTickAt) / 1000);
      timerSecondsRemaining = Math.max(0, timerSecondsRemaining - elapsedSeconds);
    }

    // Load stickies
    const stickyRows = sql.exec<{
      id: string;
      type: string;
      text: string;
      x: number;
      y: number;
      votes: number;
      author_name: string | null;
      author_color: string | null;
      custom_color: string | null;
      updated_at: number;
    }>(`SELECT * FROM stickies`).toArray();

    const stickies: StickyNote[] = stickyRows.map((r) => ({
      id: r.id,
      type: r.type as StickyType,
      text: r.text,
      x: r.x,
      y: r.y,
      votes: r.votes,
      authorName: r.author_name ?? undefined,
      authorColor: r.author_color ?? undefined,
      customColor: r.custom_color ?? undefined,
      updatedAt: r.updated_at,
    }));

    // Load pivotal lines
    const pivotalRows = sql.exec<{
      id: string;
      name: string;
      x: number;
      color: string | null;
    }>(`SELECT * FROM pivotal_lines ORDER BY x ASC`).toArray();

    const pivotalLines: PivotalLine[] = pivotalRows.map((r) => ({
      id: r.id,
      name: r.name,
      x: r.x,
      color: r.color ?? undefined,
    }));

    // Load swimlanes
    const swimlaneRows = sql.exec<{
      id: string;
      name: string;
      y: number;
      height: number;
      color: string | null;
    }>(`SELECT * FROM swimlanes ORDER BY y ASC`).toArray();

    const swimlanes: Swimlane[] = swimlaneRows.map((r) => ({
      id: r.id,
      name: r.name,
      y: r.y,
      height: r.height,
      color: r.color ?? undefined,
    }));

    return {
      id: this.ctx.id.toString(),
      name: stateMap.get('name') || 'EventStorming Workspace',
      format,
      currentPhaseIndex,
      timerSecondsRemaining,
      timerIsRunning,
      timerLastTickAt,
      stickies,
      pivotalLines,
      swimlanes,
    };
  }

  private broadcast(msg: ServerMessage, exceptWs?: WebSocket) {
    const data = JSON.stringify(msg);
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      if (ws === exceptWs) continue;
      try {
        ws.send(data);
      } catch (err) {
        // Socket error, ignore here, webSocketClose will handle
      }
    }
  }

  private getPeers(): PeerCursor[] {
    const sockets = this.ctx.getWebSockets();
    const peers: PeerCursor[] = [];
    for (const ws of sockets) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (att && att.clientId) {
        peers.push({
          clientId: att.clientId,
          name: att.name || 'Anonymous',
          color: att.color || '#3b82f6',
          x: 0,
          y: 0,
          lastActive: Date.now(),
        });
      }
    }
    return peers;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/export')) {
      const state = this.getState();
      return Response.json(state, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });
    }

    if (url.pathname.endsWith('/load-template') && request.method === 'POST') {
      const { templateKey } = (await request.json()) as { templateKey: string };
      this.loadTemplate(templateKey);
      const state = this.getState();
      this.broadcast({ type: 'workspace:reloaded', state });
      return Response.json({ success: true, state });
    }

    if (url.pathname.endsWith('/ws')) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      this.ctx.acceptWebSocket(server);

      // Default attachment
      server.serializeAttachment({
        clientId: crypto.randomUUID(),
        name: 'Anonymous',
        color: '#FF9F1C',
        windowStart: Date.now(),
        messageCount: 0,
      } satisfies SocketAttachment);

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not Found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    // In-socket abuse limiter: max 30 msgs/second
    let att = ws.deserializeAttachment() as SocketAttachment | null;
    const now = Date.now();
    if (att) {
      if (now - att.windowStart > 1000) {
        att.windowStart = now;
        att.messageCount = 1;
      } else {
        att.messageCount += 1;
        if (att.messageCount > 30) {
          ws.close(1008, 'Rate limit exceeded: max 30 msgs/second');
          return;
        }
      }
      ws.serializeAttachment(att);
    }

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message) as ClientMessage;
    } catch {
      return;
    }

    this.touchActivity();
    const sql = this.ctx.storage.sql;

    switch (parsed.type) {
      case 'join': {
        const clientAttachment: SocketAttachment = {
          clientId: parsed.clientId,
          name: parsed.name,
          color: parsed.color,
          windowStart: now,
          messageCount: att?.messageCount || 0,
        };
        ws.serializeAttachment(clientAttachment);

        // Send full initial state to joined user
        const state = this.getState();
        const peers = this.getPeers().filter((p) => p.clientId !== parsed.clientId);
        const initMsg: ServerMessage = {
          type: 'init',
          state,
          peers,
          yourClientId: parsed.clientId,
        };
        ws.send(JSON.stringify(initMsg));

        // Notify others
        this.broadcast(
          {
            type: 'peer:update',
            peer: {
              clientId: parsed.clientId,
              name: parsed.name,
              color: parsed.color,
              x: 0,
              y: 0,
              lastActive: now,
            },
          },
          ws
        );
        break;
      }

      case 'cursor': {
        if (!att?.clientId) return;
        this.broadcast(
          {
            type: 'peer:update',
            peer: {
              clientId: att.clientId,
              name: att.name,
              color: att.color,
              x: parsed.x,
              y: parsed.y,
              lastActive: now,
            },
          },
          ws
        );
        break;
      }

      case 'sticky:upsert': {
        const s = parsed.sticky;
        sql.exec(
          `INSERT INTO stickies (id, type, text, x, y, votes, author_name, author_color, custom_color, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             type = excluded.type,
             text = excluded.text,
             x = excluded.x,
             y = excluded.y,
             votes = excluded.votes,
             author_name = excluded.author_name,
             author_color = excluded.author_color,
             custom_color = excluded.custom_color,
             updated_at = excluded.updated_at`,
          s.id,
          s.type,
          s.text,
          s.x,
          s.y,
          s.votes || 0,
          s.authorName ?? null,
          s.authorColor ?? null,
          s.customColor ?? null,
          s.updatedAt || now
        );

        this.broadcast({ type: 'sticky:upsert', sticky: s });
        break;
      }

      case 'sticky:batch-move': {
        for (const update of parsed.updates) {
          sql.exec(
            `UPDATE stickies SET x = ?, y = ?, updated_at = ? WHERE id = ?`,
            update.x,
            update.y,
            now,
            update.id
          );
        }
        this.broadcast({ type: 'sticky:batch-move', updates: parsed.updates }, ws);
        break;
      }

      case 'sticky:delete': {
        sql.exec(`DELETE FROM stickies WHERE id = ?`, parsed.id);
        this.broadcast({ type: 'sticky:delete', id: parsed.id });
        break;
      }

      case 'sticky:vote': {
        sql.exec(
          `UPDATE stickies SET votes = MAX(0, votes + ?), updated_at = ? WHERE id = ?`,
          parsed.delta,
          now,
          parsed.id
        );
        const row = sql.exec<{ votes: number }>(
          `SELECT votes FROM stickies WHERE id = ?`,
          parsed.id
        ).toArray()[0];
        const newVotes = row ? row.votes : 0;
        this.broadcast({ type: 'sticky:vote', id: parsed.id, votes: newVotes });
        break;
      }

      case 'pivotal:upsert': {
        const line = parsed.line;
        sql.exec(
          `INSERT INTO pivotal_lines (id, name, x, color)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             x = excluded.x,
             color = excluded.color`,
          line.id,
          line.name,
          line.x,
          line.color ?? null
        );
        this.broadcast({ type: 'pivotal:upsert', line });
        break;
      }

      case 'pivotal:delete': {
        sql.exec(`DELETE FROM pivotal_lines WHERE id = ?`, parsed.id);
        this.broadcast({ type: 'pivotal:delete', id: parsed.id });
        break;
      }

      case 'swimlane:upsert': {
        const lane = parsed.lane;
        sql.exec(
          `INSERT INTO swimlanes (id, name, y, height, color)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             y = excluded.y,
             height = excluded.height,
             color = excluded.color`,
          lane.id,
          lane.name,
          lane.y,
          lane.height,
          lane.color ?? null
        );
        this.broadcast({ type: 'swimlane:upsert', lane });
        break;
      }

      case 'swimlane:delete': {
        sql.exec(`DELETE FROM swimlanes WHERE id = ?`, parsed.id);
        this.broadcast({ type: 'swimlane:delete', id: parsed.id });
        break;
      }

      case 'workspace:set-format': {
        sql.exec(
          `INSERT INTO workspace_state (key, value) VALUES ('format', ?), ('current_phase', '0')
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          parsed.format
        );
        this.broadcast({
          type: 'workspace:updated',
          format: parsed.format,
          phaseIndex: 0,
        });
        break;
      }

      case 'workspace:set-phase': {
        sql.exec(
          `INSERT INTO workspace_state (key, value) VALUES ('current_phase', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          parsed.phaseIndex.toString()
        );
        this.broadcast({
          type: 'workspace:updated',
          phaseIndex: parsed.phaseIndex,
        });
        break;
      }

      case 'workspace:timer': {
        const isRunning = parsed.isRunning ? '1' : '0';
        const nowMs = Date.now().toString();
        sql.exec(
          `INSERT INTO workspace_state (key, value) VALUES ('timer_running', ?), ('timer_last_tick', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          isRunning,
          nowMs
        );
        if (parsed.secondsRemaining !== undefined) {
          sql.exec(
            `INSERT INTO workspace_state (key, value) VALUES ('timer_seconds', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            parsed.secondsRemaining.toString()
          );
        }
        const state = this.getState();
        this.broadcast({
          type: 'workspace:updated',
          timer: {
            isRunning: state.timerIsRunning,
            secondsRemaining: state.timerSecondsRemaining,
          },
        });
        break;
      }

      case 'workspace:load-template': {
        this.loadTemplate(parsed.templateKey);
        const state = this.getState();
        this.broadcast({ type: 'workspace:reloaded', state });
        break;
      }
    }
  }

  private loadTemplate(templateKey: string) {
    const template = SAMPLE_TEMPLATES[templateKey];
    if (!template) return;

    const sql = this.ctx.storage.sql;
    const now = Date.now();

    // Clear board
    sql.exec(`DELETE FROM stickies`);
    sql.exec(`DELETE FROM pivotal_lines`);
    sql.exec(`DELETE FROM swimlanes`);

    // Set format
    sql.exec(
      `INSERT INTO workspace_state (key, value) VALUES 
        ('format', ?),
        ('current_phase', '0'),
        ('name', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      template.format,
      template.title
    );

    // Insert stickies
    for (const s of template.stickies) {
      sql.exec(
        `INSERT INTO stickies (id, type, text, x, y, votes, author_name, author_color, custom_color, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s.id,
        s.type,
        s.text,
        s.x,
        s.y,
        s.votes || 0,
        s.authorName ?? null,
        s.authorColor ?? null,
        s.customColor ?? null,
        now
      );
    }

    // Insert pivotal lines
    for (const line of template.pivotalLines) {
      sql.exec(
        `INSERT INTO pivotal_lines (id, name, x, color)
         VALUES (?, ?, ?, ?)`,
        line.id,
        line.name,
        line.x,
        line.color ?? null
      );
    }

    // Insert swimlanes
    for (const lane of template.swimlanes) {
      sql.exec(
        `INSERT INTO swimlanes (id, name, y, height, color)
         VALUES (?, ?, ?, ?, ?)`,
        lane.id,
        lane.name,
        lane.y,
        lane.height,
        lane.color ?? null
      );
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (att?.clientId) {
      this.broadcast({ type: 'peer:leave', clientId: att.clientId });
    }
  }
}
