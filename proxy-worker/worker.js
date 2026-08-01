/**
 * NTOU TAT — Cloudflare Worker Proxy
 *
 * 盲轉發 (Blind Pipe) 設計原則：
 *   - 代理伺服器只轉發請求，不解析、不記錄任何學生資料
 *   - 目標 URL 限制在 ais.ntou.edu.tw / www.ntou.edu.tw 域名內
 *   - 手動追蹤 HTTP 跳轉，保留每次 Set-Cookie，避免 redirect: 'follow' 丟失 Cookie
 *   - 最終 Set-Cookie 轉換為 X-Proxy-Set-Cookie Header，讓瀏覽器端 JS 可讀取
 *
 * 部署至：https://ntou-proxy.tky-kevintang.workers.dev/
 */

const ALLOWED_TARGET_HOSTS = ['ais.ntou.edu.tw', 'www.ntou.edu.tw']

const ALLOWED_PRODUCTION_ORIGINS = [
  'https://ntou-tat.pages.dev',
]

function isAllowedOrigin(origin) {
  // 開發環境：允許所有 localhost 或 127.0.0.1（任意 port）
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true
  // 生產環境：限制白名單
  return ALLOWED_PRODUCTION_ORIGINS.includes(origin)
}

function corsHeaders(origin) {
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_PRODUCTION_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers': 'X-Proxy-Set-Cookie, X-Proxy-Final-Url',
    'Access-Control-Max-Age': '86400',
  }
}

// ---------------------------------------------------------------------------
// Cookie jar helpers
// ---------------------------------------------------------------------------

function parseCookieJar(cookieString) {
  const jar = new Map()
  if (!cookieString) return jar
  for (const pair of cookieString.split(';')) {
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    const name = pair.slice(0, idx).trim()
    const value = pair.slice(idx + 1).trim()
    if (name) jar.set(name, value)
  }
  return jar
}

function splitSetCookieHeader(value) {
  // Set-Cookie 有時多個 cookie 用逗號分隔，但要避免把 cookie value 裡的逗號誤判
  return value.split(/,(?=\s*[\w!#$%&'*+.^`|~-]+=)/).map(s => s.trim()).filter(Boolean)
}

function mergeSetCookie(jar, setCookieHeader) {
  for (const entry of splitSetCookieHeader(setCookieHeader)) {
    const part = entry.split(';')[0]?.trim()
    if (!part) continue
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const name = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (name) jar.set(name, value)
  }
}

function jarToCookieString(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function jarToSetCookieString(jar) {
  // 回傳給客戶端的格式：name=value（不帶 path/domain，讓客戶端自己管理）
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join(', ')
}

// ---------------------------------------------------------------------------
// Fetch with manual redirect tracking (preserves cookies across hops)
// ---------------------------------------------------------------------------

async function fetchWithCookies(initialUrl, method, reqHeaders, body) {
  const MAX_REDIRECTS = 10
  let currentUrl = initialUrl

  // 初始化 cookie jar（從呼叫者帶入的 Cookie header）
  const jar = parseCookieJar(reqHeaders['Cookie'] || reqHeaders['cookie'] || '')

  let lastResponse = null

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    // 組合本次請求的 headers（注入 jar 的 cookie）
    const headers = { ...reqHeaders }
    const cookieString = jarToCookieString(jar)
    if (cookieString) {
      headers['Cookie'] = cookieString
    }

    const response = await fetch(currentUrl, {
      method,
      headers,
      body: body ?? undefined,
      redirect: 'manual', // 手動處理跳轉，才能攔截每次的 Set-Cookie
    })

    // 蒐集本次回應的 Set-Cookie 並合併進 jar
    const setCookie = response.headers.get('Set-Cookie')
    if (setCookie) {
      mergeSetCookie(jar, setCookie)
    }

    // 3xx 跳轉：讀取 Location 並繼續
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location')
      if (!location) {
        lastResponse = response
        break
      }
      const nextUrl = new URL(location, currentUrl).toString()
      const nextHost = new URL(nextUrl).hostname
      // 只跟隨允許的域名
      if (!ALLOWED_TARGET_HOSTS.includes(nextHost)) {
        lastResponse = response
        break
      }
      currentUrl = nextUrl
      // 302/303 之後改用 GET
      if (response.status === 302 || response.status === 303) {
        method = 'GET'
        body = null
      }
      lastResponse = response
      continue
    }

    lastResponse = response
    break
  }

  return { response: lastResponse, finalUrl: currentUrl, jar }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request, _env, _ctx) {
    const origin = request.headers.get('Origin') ?? ''

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    let payload
    try {
      payload = await request.json()
    } catch {
      return new Response('Invalid JSON body', { status: 400 })
    }

    const { url, method = 'GET', headers: reqHeaders = {}, body = null } = payload

    // Validate target URL
    let targetUrl
    try {
      targetUrl = new URL(url)
    } catch {
      return new Response('Invalid target URL', { status: 400 })
    }

    if (
      targetUrl.protocol !== 'https:' ||
      !ALLOWED_TARGET_HOSTS.includes(targetUrl.hostname)
    ) {
      return new Response('Target host not allowed', { status: 403 })
    }

    // Forward the request (with manual redirect + cookie tracking)
    let result
    try {
      result = await fetchWithCookies(targetUrl.toString(), method, reqHeaders, body)
    } catch (err) {
      return new Response(`Upstream fetch failed: ${err.message}`, { status: 502 })
    }

    const { response: upstream, finalUrl, jar } = result

    // Build response headers
    const responseHeaders = new Headers(corsHeaders(origin))
    responseHeaders.set('Content-Type', upstream.headers.get('Content-Type') ?? 'text/html')
    responseHeaders.set('X-Proxy-Final-Url', finalUrl)

    // 把整個 redirect 鏈蒐集到的 cookie 回傳給客戶端
    const allCookies = jarToSetCookieString(jar)
    if (allCookies) {
      responseHeaders.set('X-Proxy-Set-Cookie', allCookies)
    }

    const responseBody = await upstream.arrayBuffer()

    return new Response(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    })
  },
}
