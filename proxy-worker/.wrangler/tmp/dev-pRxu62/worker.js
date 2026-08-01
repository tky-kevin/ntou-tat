var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var ALLOWED_TARGET_HOSTS = ["ais.ntou.edu.tw", "www.ntou.edu.tw"];
var ALLOWED_PRODUCTION_ORIGINS = [
  "https://ntou-tat.pages.dev"
];
function isAllowedOrigin(origin) {
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return ALLOWED_PRODUCTION_ORIGINS.includes(origin);
}
__name(isAllowedOrigin, "isAllowedOrigin");
function corsHeaders(origin) {
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_PRODUCTION_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Expose-Headers": "X-Proxy-Set-Cookie, X-Proxy-Final-Url",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function parseCookieJar(cookieString) {
  const jar = /* @__PURE__ */ new Map();
  if (!cookieString) return jar;
  for (const pair of cookieString.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (name) jar.set(name, value);
  }
  return jar;
}
__name(parseCookieJar, "parseCookieJar");
function splitSetCookieHeader(value) {
  return value.split(/,(?=\s*[\w!#$%&'*+.^`|~-]+=)/).map((s) => s.trim()).filter(Boolean);
}
__name(splitSetCookieHeader, "splitSetCookieHeader");
function mergeSetCookie(jar, setCookieHeader) {
  for (const entry of splitSetCookieHeader(setCookieHeader)) {
    const part = entry.split(";")[0]?.trim();
    if (!part) continue;
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) jar.set(name, value);
  }
}
__name(mergeSetCookie, "mergeSetCookie");
function jarToCookieString(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
__name(jarToCookieString, "jarToCookieString");
function jarToSetCookieString(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join(", ");
}
__name(jarToSetCookieString, "jarToSetCookieString");
async function fetchWithCookies(initialUrl, method, reqHeaders, body) {
  const MAX_REDIRECTS = 10;
  let currentUrl = initialUrl;
  const jar = parseCookieJar(reqHeaders["Cookie"] || reqHeaders["cookie"] || "");
  let lastResponse = null;
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const headers = { ...reqHeaders };
    const cookieString = jarToCookieString(jar);
    if (cookieString) {
      headers["Cookie"] = cookieString;
    }
    const response = await fetch(currentUrl, {
      method,
      headers,
      body: body ?? void 0,
      redirect: "manual"
      // 手動處理跳轉，才能攔截每次的 Set-Cookie
    });
    const setCookie = response.headers.get("Set-Cookie");
    if (setCookie) {
      mergeSetCookie(jar, setCookie);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location) {
        lastResponse = response;
        break;
      }
      const nextUrl = new URL(location, currentUrl).toString();
      const nextHost = new URL(nextUrl).hostname;
      if (!ALLOWED_TARGET_HOSTS.includes(nextHost)) {
        lastResponse = response;
        break;
      }
      currentUrl = nextUrl;
      if (response.status === 302 || response.status === 303) {
        method = "GET";
        body = null;
      }
      lastResponse = response;
      continue;
    }
    lastResponse = response;
    break;
  }
  return { response: lastResponse, finalUrl: currentUrl, jar };
}
__name(fetchWithCookies, "fetchWithCookies");
var worker_default = {
  async fetch(request, _env, _ctx) {
    const origin = request.headers.get("Origin") ?? "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders(origin) });
    }
    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400, headers: corsHeaders(origin) });
    }
    const { url, method = "GET", headers: reqHeaders = {}, body = null } = payload;
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch {
      return new Response("Invalid target URL", { status: 400, headers: corsHeaders(origin) });
    }
    if (targetUrl.protocol !== "https:" || !ALLOWED_TARGET_HOSTS.includes(targetUrl.hostname)) {
      return new Response("Target host not allowed", { status: 403, headers: corsHeaders(origin) });
    }
    let result;
    try {
      result = await fetchWithCookies(targetUrl.toString(), method, reqHeaders, body);
    } catch (err) {
      return new Response(`Upstream fetch failed: ${err.message}`, { status: 502, headers: corsHeaders(origin) });
    }
    const { response: upstream, finalUrl, jar } = result;
    const responseHeaders = new Headers(corsHeaders(origin));
    responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") ?? "text/html");
    responseHeaders.set("X-Proxy-Final-Url", finalUrl);
    const allCookies = jarToSetCookieString(jar);
    if (allCookies) {
      responseHeaders.set("X-Proxy-Set-Cookie", allCookies);
    }
    const responseBody = await upstream.arrayBuffer();
    return new Response(responseBody, {
      status: upstream.status,
      headers: responseHeaders
    });
  }
};

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-m17VIp/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-m17VIp/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
