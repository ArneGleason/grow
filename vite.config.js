import { defineConfig } from "vite";

const OLLAMA_PROXY_PREFIX = "/api/ollama";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const ALLOWED_OLLAMA_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export default defineConfig({
  plugins: [ollamaProxyPlugin()],
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
              sendJson(response, 499, { error: "Ollama proxy request aborted" });
            }
            return;
          }
          sendJson(response, error instanceof ProxyRequestError ? 400 : 500, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
  };
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

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("X-Grow-Ollama-Proxy", "vite-dev");
  response.end(JSON.stringify(payload));
}

class ProxyRequestError extends Error {}

function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}

function createAbortError() {
  const error = new Error("Ollama proxy request aborted");
  error.name = "AbortError";
  return error;
}
