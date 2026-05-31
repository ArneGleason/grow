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
  if (path === `${OLLAMA_PROXY_PREFIX}/tags` && request.method === "GET") {
    const baseUrl = sanitizeOllamaBaseUrl(requestUrl.searchParams.get("baseUrl"));
    const upstream = await fetch(`${baseUrl}/api/tags`, { method: "GET" });
    await pipeJsonResponse(response, upstream);
    return;
  }

  if (path === `${OLLAMA_PROXY_PREFIX}/chat` && request.method === "POST") {
    const payload = await readJsonBody(request);
    const baseUrl = sanitizeOllamaBaseUrl(payload.baseUrl);
    const upstream = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.request ?? {}),
    });
    await pipeJsonResponse(response, upstream);
    return;
  }

  sendJson(response, 404, { error: "Unknown Ollama proxy route" });
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

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        resolve(rawBody.length > 0 ? JSON.parse(rawBody) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("X-Grow-Ollama-Proxy", "vite-dev");
  response.end(JSON.stringify(payload));
}

class ProxyRequestError extends Error {}
