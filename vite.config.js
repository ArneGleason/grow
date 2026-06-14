import { defineConfig } from "vite";
import {
  appendEvents,
  capCandidates,
  databaseExists,
  developCandidate,
  dumpGrowDatabase,
  ensureSession,
  getSchemaVersion,
  listCandidates,
  openGrowDatabase,
  purgeCandidates,
  retainCandidates,
  resolveDatabasePath,
  scoreCandidate,
  selectCandidates,
  writeCandidate,
} from "./server/persistence.mjs";

const OLLAMA_PROXY_PREFIX = "/api/ollama";
const PERSISTENCE_PREFIX = "/api/persistence";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const ALLOWED_OLLAMA_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export default defineConfig({
  plugins: [ollamaProxyPlugin(), persistencePlugin()],
});

function ollamaProxyPlugin() {
  return {
    name: "grow-ollama-proxy",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith(OLLAMA_PROXY_PREFIX)) {
          next();
          return;
        }

        try {
          await handleOllamaProxy(request, response);
        } catch (error) {
          if (isAbortError(error) || request.destroyed || response.destroyed) {
            if (!response.destroyed && !response.writableEnded) {
              sendJson(response, 499, { error: "Ollama proxy request aborted" }, {
                "X-Grow-Ollama-Proxy": "vite-dev",
              });
            }
            return;
          }
          sendJson(response, error instanceof ProxyRequestError ? 400 : 500, {
            error: error instanceof Error ? error.message : String(error),
          }, {
            "X-Grow-Ollama-Proxy": "vite-dev",
          });
        }
      });
    },
  };
}

function persistencePlugin() {
  let database;
  const getDatabase = () => {
    database ??= openGrowDatabase();
    return database;
  };
  const hasDatabase = () => Boolean(database) || databaseExists();

  return {
    name: "grow-persistence-api",
    configureServer(server) {
      server.httpServer?.once("close", () => {
        database?.close();
        database = undefined;
      });

      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith(PERSISTENCE_PREFIX)) {
          next();
          return;
        }

        const abort = createProxyAbortController(request, response);
        try {
          await handlePersistenceRequest(request, response, {
            getDatabase,
            hasDatabase,
          }, abort.signal);
        } catch (error) {
          if (error instanceof PersistenceRequestError) {
            if (!response.destroyed && !response.writableEnded) {
              sendJson(response, 400, {
                error: error.message,
              }, {
                "X-Grow-Persistence": "vite-dev",
              });
            }
            return;
          }
          if (isAbortError(error) || request.destroyed || response.destroyed) {
            if (!response.destroyed && !response.writableEnded) {
              sendJson(response, 499, { error: "Persistence request aborted" }, {
                "X-Grow-Persistence": "vite-dev",
              });
            }
            return;
          }
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : String(error),
          }, {
            "X-Grow-Persistence": "vite-dev",
          });
        } finally {
          abort.cleanup();
        }
      });
    },
  };
}

async function handlePersistenceRequest(request, response, persistence, signal) {
  const requestUrl = new URL(request.url ?? "", "http://127.0.0.1");
  const path = requestUrl.pathname;

  if (path === `${PERSISTENCE_PREFIX}/status` && request.method === "GET") {
    if (!persistence.hasDatabase()) {
      sendPersistenceJson(response, 200, {
        ok: true,
        initialized: false,
        databasePath: resolveDatabasePath(),
        schemaVersion: null,
      });
      return;
    }
    const database = persistence.getDatabase();
    sendPersistenceJson(response, 200, {
      ok: true,
      initialized: true,
      databasePath: resolveDatabasePath(),
      schemaVersion: getSchemaVersion(database),
    });
    return;
  }

  if (path === `${PERSISTENCE_PREFIX}/dump` && request.method === "GET") {
    const limit = requestUrl.searchParams.get("limit") ?? undefined;
    if (!persistence.hasDatabase()) {
      sendPersistenceJson(response, 200, {
        databasePath: resolveDatabasePath(),
        initialized: false,
        schemaVersion: null,
        sessions: [],
        events: [],
        message: "No database found; run npm run db:init first.",
      });
      return;
    }
    const database = persistence.getDatabase();
    sendPersistenceJson(response, 200, {
      databasePath: resolveDatabasePath(),
      initialized: true,
      ...dumpGrowDatabase(database, { limit }),
    });
    return;
  }

  if (path === `${PERSISTENCE_PREFIX}/candidates` && request.method === "GET") {
    if (!persistence.hasDatabase()) {
      sendPersistenceJson(response, 200, {
        ok: true,
        candidates: [],
      });
      return;
    }
    const database = persistence.getDatabase();
    sendPersistenceJson(response, 200, {
      ok: true,
      candidates: listCandidates(database, {
        branchId: requestUrl.searchParams.get("branchId") ?? undefined,
        kind: requestUrl.searchParams.get("kind") ?? undefined,
        status: requestUrl.searchParams.get("status") ?? undefined,
        limit: requestUrl.searchParams.get("limit") ?? undefined,
      }),
    });
    return;
  }

  if (path === `${PERSISTENCE_PREFIX}/candidates/write` && request.method === "POST") {
    const database = persistence.getDatabase();
    const payload = await readJsonBody(request, signal);
    const session = ensureCandidateSession(database, payload);
    const candidate = writeCandidate(database, {
      sessionId: session.id,
      branchId: payload.branchId ?? session.branchId,
      candidate: payload.candidate,
    });
    sendPersistenceJson(response, 200, {
      ok: true,
      session,
      candidate,
    });
    return;
  }

  if (path === `${PERSISTENCE_PREFIX}/candidates/score` && request.method === "POST") {
    const database = persistence.getDatabase();
    const payload = await readJsonBody(request, signal);
    const session = ensureCandidateSession(database, payload);
    const candidate = scoreCandidate(database, {
      sessionId: session.id,
      branchId: payload.branchId ?? session.branchId,
      candidateId: payload.candidateId,
      scores: payload.scores,
      fitness: payload.fitness,
    });
    sendPersistenceJson(response, 200, {
      ok: true,
      session,
      candidate,
    });
    return;
  }

  if (path === `${PERSISTENCE_PREFIX}/candidates/retain` && request.method === "POST") {
    const database = persistence.getDatabase();
    const payload = await readJsonBody(request, signal);
    const session = ensureCandidateSession(database, payload);
    const candidates = retainCandidates(database, {
      sessionId: session.id,
      branchId: payload.branchId ?? session.branchId,
      candidateIds: payload.candidateIds,
    });
    sendPersistenceJson(response, 200, {
      ok: true,
      session,
      candidates,
    });
    return;
  }

  if (path === `${PERSISTENCE_PREFIX}/candidates/purge` && request.method === "POST") {
    const database = persistence.getDatabase();
    const payload = await readJsonBody(request, signal);
    const session = ensureCandidateSession(database, payload);
    const candidates = purgeCandidates(database, {
      sessionId: session.id,
      branchId: payload.branchId ?? session.branchId,
      candidateIds: payload.candidateIds,
    });
    sendPersistenceJson(response, 200, {
      ok: true,
      session,
      candidates,
    });
    return;
  }

  if (path === `${PERSISTENCE_PREFIX}/candidates/cap` && request.method === "POST") {
    const database = persistence.getDatabase();
    const payload = await readJsonBody(request, signal);
    const session = ensureCandidateSession(database, payload);
    const result = capCandidates(database, {
      sessionId: session.id,
      branchId: payload.branchId ?? session.branchId,
      kind: payload.kind,
      limit: payload.limit,
    });
    sendPersistenceJson(response, 200, {
      ok: true,
      session,
      ...result,
    });
    return;
  }

  if (path === `${PERSISTENCE_PREFIX}/candidates/select` && request.method === "POST") {
    const database = persistence.getDatabase();
    const payload = await readJsonBody(request, signal);
    const session = ensureCandidateSession(database, payload);
    const result = selectCandidates(database, {
      sessionId: session.id,
      branchId: payload.branchId ?? session.branchId,
      kind: payload.kind,
      eliteLimit: payload.eliteLimit,
    });
    sendPersistenceJson(response, 200, {
      ok: true,
      session,
      ...result,
    });
    return;
  }

  if (path === `${PERSISTENCE_PREFIX}/candidates/develop` && request.method === "POST") {
    const database = persistence.getDatabase();
    const payload = await readJsonBody(request, signal);
    const session = ensureCandidateSession(database, payload);
    let result;
    try {
      result = developCandidate(database, {
        sessionId: session.id,
        branchId: payload.branchId ?? session.branchId,
        parentId: payload.parentId,
        mutation: payload.mutation,
        seed: payload.seed,
        createdAtBeat: payload.createdAtBeat,
      });
    } catch (error) {
      throw new PersistenceRequestError(error instanceof Error ? error.message : String(error));
    }
    sendPersistenceJson(response, 200, {
      ok: true,
      session,
      ...result,
    });
    return;
  }

  if (path === `${PERSISTENCE_PREFIX}/append` && request.method === "POST") {
    const database = persistence.getDatabase();
    const payload = await readJsonBody(request, signal);
    if (!payload.session) {
      throw new PersistenceRequestError("Persistence append requires a session");
    }
    if (!Array.isArray(payload.events)) {
      throw new PersistenceRequestError("Persistence append requires events");
    }
    const session = ensureSession(database, payload.session);
    const events = appendEvents(database, payload.events.map((event) => ({
      ...event,
      sessionId: event.sessionId ?? session.id,
      branchId: event.branchId ?? session.branchId,
    })));
    sendPersistenceJson(response, 200, {
      ok: true,
      session,
      events,
    });
    return;
  }

  sendPersistenceJson(response, 404, { error: "Unknown persistence route" });
}

async function handleOllamaProxy(request, response) {
  const requestUrl = new URL(request.url ?? "", "http://127.0.0.1");
  const path = requestUrl.pathname;
  const abort = createProxyAbortController(request, response);
  if (path === `${OLLAMA_PROXY_PREFIX}/tags` && request.method === "GET") {
    try {
      const baseUrl = sanitizeOllamaBaseUrl(requestUrl.searchParams.get("baseUrl"));
      const upstream = await fetch(`${baseUrl}/api/tags`, {
        method: "GET",
        signal: abort.signal,
      });
      await pipeJsonResponse(response, upstream);
    } finally {
      abort.cleanup();
    }
    return;
  }

  if (path === `${OLLAMA_PROXY_PREFIX}/chat` && request.method === "POST") {
    try {
      const payload = await readJsonBody(request, abort.signal);
      const baseUrl = sanitizeOllamaBaseUrl(payload.baseUrl);
      const upstream = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.request ?? {}),
        signal: abort.signal,
      });
      await pipeJsonResponse(response, upstream);
    } finally {
      abort.cleanup();
    }
    return;
  }

  abort.cleanup();
  sendJson(response, 404, { error: "Unknown Ollama proxy route" });
}

function ensureCandidateSession(database, payload) {
  if (!payload.session) {
    throw new PersistenceRequestError("Candidate store requests require a session");
  }
  return ensureSession(database, payload.session);
}

function createProxyAbortController(request, response) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const abortIfResponseDidNotFinish = () => {
    if (!response.writableEnded) abort();
  };

  request.once("aborted", abort);
  response.once("close", abortIfResponseDidNotFinish);

  return {
    signal: controller.signal,
    cleanup() {
      request.off("aborted", abort);
      response.off("close", abortIfResponseDidNotFinish);
    },
  };
}

async function pipeJsonResponse(response, upstream) {
  const text = await upstream.text();
  response.statusCode = upstream.status;
  response.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
  response.setHeader("X-Grow-Ollama-Proxy", "vite-dev");
  response.end(text);
}

function sanitizeOllamaBaseUrl(value) {
  const rawValue = typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_OLLAMA_BASE_URL;
  const url = new URL(rawValue);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ProxyRequestError("Ollama proxy only supports http(s) targets");
  }
  if (!ALLOWED_OLLAMA_HOSTS.has(url.hostname)) {
    throw new ProxyRequestError("Ollama proxy only supports localhost targets");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function readJsonBody(request, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }
    const chunks = [];
    const abort = () => {
      cleanup();
      reject(createAbortError());
    };
    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      request.off("error", fail);
    };
    const fail = (error) => {
      cleanup();
      reject(error);
    };
    signal.addEventListener("abort", abort, { once: true });
    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        cleanup();
        const rawBody = Buffer.concat(chunks).toString("utf8");
        resolve(rawBody.length > 0 ? JSON.parse(rawBody) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", fail);
  });
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }
  response.end(JSON.stringify(payload));
}

function sendPersistenceJson(response, statusCode, payload) {
  sendJson(response, statusCode, payload, {
    "X-Grow-Persistence": "vite-dev",
  });
}

class ProxyRequestError extends Error {}
class PersistenceRequestError extends Error {}

function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}

function createAbortError() {
  const error = new Error("Ollama proxy request aborted");
  error.name = "AbortError";
  return error;
}
