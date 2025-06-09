// relay.service.js
const http = require("http");
const WebSocket = require("ws");
const Database = require("better-sqlite3");
const { getEventHash, verifySignature } = require("nostr-tools");
require("dotenv").config();

function logDebug(...args) {
  if (process.env.DEBUG === "true") {
    console.log(...args);
  }
}

// Initialize SQLite database
const db = new Database("nostr.db");
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    pubkey TEXT,
    kind INTEGER,
    created_at INTEGER,
    tags TEXT,
    content TEXT,
    sig TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pubkey_kind ON events(pubkey, kind);
  CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at);
`);

// Create HTTP and WebSocket server on localhost:8021
const server = http.createServer((req, res) => {
  if (
    req.headers.accept &&
    req.headers.accept.includes("application/nostr+json")
  ) {
    const relayInfo = {
      name: "Local Nostr Relay",
      description: "Lightweight Nostr relay for local use",
      supported_nips: [1, 4, 9, 11, 12, 15, 16, 20, 33, 78],
      software: "local-relay-nodejs",
      version: "0.1.0",
    };
    res.writeHead(200, { "Content-Type": "application/nostr+json" });
    res.end(JSON.stringify(relayInfo));
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Nostr Relay running on ws://127.0.0.1:8021\n");
  }
});
server.listen(8021, "127.0.0.1", () => {
  console.log("Relay listening on ws://127.0.0.1:8021");
});

const wss = new WebSocket.Server({ server });

// In-memory subscriptions: Map<WebSocket, Map<subId, filters>>
const subscriptions = new Map();

function eventMatchesFilters(event, filters) {
  return filters.some((filter) => {
    if (filter.ids && !filter.ids.some((idPref) => event.id.startsWith(idPref)))
      return false;
    if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
    if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
    if (filter.since && event.created_at < filter.since) return false;
    if (filter.until && event.created_at > filter.until) return false;
    if (filter["#p"]) {
      const pSet = new Set(filter["#p"]);
      if (!event.tags.some((t) => t[0] === "p" && pSet.has(t[1]))) return false;
    }
    if (filter["#e"]) {
      const eSet = new Set(filter["#e"]);
      if (!event.tags.some((t) => t[0] === "e" && eSet.has(t[1]))) return false;
    }
    return true;
  });
}

function queryEvents(filters) {
  logDebug("Querying events with filters", filters);
  const rows = db.prepare("SELECT * FROM events ORDER BY created_at ASC").all();
  const events = rows.map((r) => ({
    id: r.id,
    pubkey: r.pubkey,
    kind: r.kind,
    created_at: r.created_at,
    tags: JSON.parse(r.tags),
    content: r.content,
    sig: r.sig,
  }));
  const matched = events.filter((ev) => eventMatchesFilters(ev, filters));
  if (filters.limit) {
    return matched.slice(0, filters.limit);
  }
  logDebug("Query result count", matched.length);
  return matched;
}

function broadcastEvent(event) {
  for (const [client, subs] of subscriptions.entries()) {
    for (const [subId, filters] of subs.entries()) {
      if (eventMatchesFilters(event, filters)) {
        logDebug("Broadcasting event", event.id, "to subscription", subId);
        client.send(JSON.stringify(["EVENT", subId, event]));
      }
    }
  }
}

function handleEventPublication(event, socket) {
  logDebug("Handling event publication", event);
  // Validate hash and signature
  try {
    if (getEventHash(event) !== event.id || !verifySignature(event)) {
      socket.send(
        JSON.stringify(["OK", event.id || "", false, "invalid event"])
      );
      return;
    }
  } catch (e) {
    socket.send(
      JSON.stringify(["OK", event.id || "", false, "verification error"])
    );
    return;
  }

  // Do not persist ephemeral events (20000-29999)
  if (!(event.kind >= 20000 && event.kind < 30000)) {
    // Handle replaceable events
    if (
      event.kind === 0 ||
      event.kind === 3 ||
      (event.kind >= 10000 && event.kind < 20000)
    ) {
      db.prepare("DELETE FROM events WHERE pubkey = ? AND kind = ?").run(
        event.pubkey,
        event.kind
      );
    } else if (event.kind >= 30000 && event.kind < 40000) {
      const dTag = event.tags.find((t) => t[0] === "d");
      if (dTag) {
        const pattern = `%["d","${dTag[1]}"%`;
        db.prepare(
          "DELETE FROM events WHERE pubkey = ? AND kind = ? AND tags LIKE ?"
        ).run(event.pubkey, event.kind, pattern);
      }
    }
    // Store event
    db.prepare(
      "INSERT OR IGNORE INTO events (id, pubkey, kind, created_at, tags, content, sig) VALUES (?,?,?,?,?,?,?)"
    ).run(
      event.id,
      event.pubkey,
      event.kind,
      event.created_at,
      JSON.stringify(event.tags),
      event.content,
      event.sig
    );
  }

  // Acknowledge publication
  socket.send(JSON.stringify(["OK", event.id, true, ""]));
  // Broadcast to subscribers
  broadcastEvent(event);
}

wss.on("connection", (socket, req) => {
  logDebug("New WebSocket connection from", req.socket.remoteAddress);
  subscriptions.set(socket, new Map());
  socket.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
      logDebug("Received message", msg);
    } catch {
      return;
    }
    if (!Array.isArray(msg) || msg.length < 2) return;

    const [type, param, ...rest] = msg;
    if (type === "REQ") {
      const subId = param;
      const filters = rest;
      subscriptions.get(socket).set(subId, filters);
      const evs = queryEvents(filters);
      for (const ev of evs) {
        socket.send(JSON.stringify(["EVENT", subId, ev]));
      }
      socket.send(JSON.stringify(["EOSE", subId]));
    } else if (type === "CLOSE") {
      const subId = param;
      subscriptions.get(socket).delete(subId);
    } else if (type === "EVENT") {
      handleEventPublication(param, socket);
    }
  });

  socket.on("close", () => {
    subscriptions.delete(socket);
  });
});
