import { Capacitor, registerPlugin } from '@capacitor/core'
import type { HttpHeaders, HttpOptions } from '@capacitor/core'
import { ApiError } from './errors'

export type PortalResponse = {
  status: number
  data: string
  headers: HttpHeaders
  url: string
  cookieNames?: string
}

const isNative = () => Capacitor.isNativePlatform()

// ---------------------------------------------------------------------------
// Cloudflare Worker Proxy（PWA / 瀏覽器環境專用）
// ---------------------------------------------------------------------------

const getProxyUrls = (): string[] => {
  const envUrls = import.meta.env.VITE_NTOU_PROXY_URLS
  if (envUrls) {
    return envUrls.split(',').map((url: string) => url.trim()).filter(Boolean)
  }
  return ['https://ntou-proxy.tky-kevintang.workers.dev/']
}

/**
 * PWA 環境下的 Cookie 暫存（sessionStorage）
 * 以目標 hostname 為 key 儲存 cookie 字串。
 * 視窗關閉後自動清除，行為與 Native 的 WKWebView cookie store 一致。
 */
const WEB_COOKIE_KEY_PREFIX = 'ntou_proxy_cookie_'

const webCookieKey = (url: string) => {
  try {
    return `${WEB_COOKIE_KEY_PREFIX}${new URL(url).hostname}`
  } catch {
    return `${WEB_COOKIE_KEY_PREFIX}default`
  }
}

const readWebCookies = (url: string): string =>
  sessionStorage.getItem(webCookieKey(url)) ?? ''

const writeWebCookies = (url: string, setCookieHeader: string) => {
  if (!setCookieHeader) return
  // 合併新 cookie：解析 Set-Cookie 字串並覆蓋同名 cookie
  const existing = parseWebCookieMap(readWebCookies(url))
  const incoming = parseSetCookieEntries(setCookieHeader)
  const merged = { ...existing, ...incoming }
  sessionStorage.setItem(webCookieKey(url), stringifyCookieMap(merged))
}

const clearWebCookies = (url: string) => {
  sessionStorage.removeItem(webCookieKey(url))
}

// ---------------------------------------------------------------------------
// Cookie parsing utilities
// ---------------------------------------------------------------------------

const splitSetCookieHeader = (value: string) =>
  value
    .split(/,(?=\s*[\w!#$%&'*+.^`|~-]+=)/)
    .map((cookie) => cookie.trim())
    .filter(Boolean)

const parseSetCookieEntries = (setCookie: string): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const entry of splitSetCookieHeader(setCookie)) {
    const part = entry.split(';')[0]?.trim()
    if (!part) continue
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const name = part.slice(0, eqIdx).trim()
    const value = part.slice(eqIdx + 1).trim()
    if (name) result[name] = value
  }
  return result
}

const parseWebCookieMap = (cookieString: string): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const pair of cookieString.split(';')) {
    const trimmed = pair.trim()
    if (!trimmed) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
  }
  return result
}

const stringifyCookieMap = (map: Record<string, string>): string =>
  Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')

// ---------------------------------------------------------------------------
// Native plugin
// ---------------------------------------------------------------------------

type NativePortalPlugin = {
  request(options: {
    url: string
    method?: string
    headers?: HttpHeaders
    data?: string
    timeoutMs?: number
  }): Promise<PortalResponse>
  image(options: {
    url: string
    headers?: HttpHeaders
  }): Promise<{
    status: number
    headers: HttpHeaders
    url: string
    dataUrl?: string
  }>
  clear(): Promise<void>
  cacheGet(options: { key: string }): Promise<{ value: string | null }>
  cacheSet(options: { key: string; value: string }): Promise<void>
  cacheClear(): Promise<void>
  openSystemPage(options: { url: string }): Promise<void>
}

const NativePortal = registerPlugin<NativePortalPlugin>('NtouPortal')
const NATIVE_REQUEST_TIMEOUT_MS = 25000

type PortalRequestOptions = HttpOptions & {
  timeoutMs?: number
}

const withNativeTimeout = <T>(promise: Promise<T>, message: string, timeoutMs = NATIVE_REQUEST_TIMEOUT_MS) =>
  new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new ApiError(message, 408, 'PORTAL_TIMEOUT'))
    }, timeoutMs)

    promise.then(
      (value) => {
        window.clearTimeout(timeout)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timeout)
        reject(error)
      },
    )
  })

const normalizeHeaders = (headers?: HttpHeaders) => headers ?? {}

const readHeader = (headers: HttpHeaders, name: string) => {
  const target = name.toLowerCase()
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target)
  return entry?.[1]
}

const base64FromArrayBuffer = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

// ---------------------------------------------------------------------------
// Proxy request (Web / PWA 環境)
// ---------------------------------------------------------------------------

const buildProxyRequest = (options: PortalRequestOptions) => {
  const targetUrl = options.url
  const existingCookies = readWebCookies(targetUrl)

  const callerCookie = (normalizeHeaders(options.headers)['Cookie'] as string | undefined) ?? ''
  const existingMap = parseWebCookieMap(existingCookies)
  const callerMap = parseWebCookieMap(callerCookie)
  const mergedMap = { ...existingMap, ...callerMap }
  const mergedCookie = stringifyCookieMap(mergedMap)

  const requestHeaders: Record<string, string> = {
    ...normalizeHeaders(options.headers),
    'User-Agent': navigator.userAgent,
  }
  if (mergedCookie) {
    requestHeaders['Cookie'] = mergedCookie
  }

  return {
    targetUrl,
    proxyBody: JSON.stringify({
    url: targetUrl,
    method: options.method ?? 'GET',
    headers: requestHeaders,
    body: typeof options.data === 'string' ? options.data : null,
    }),
  }
}

const persistProxyCookies = (targetUrl: string, response: Response) => {
  const proxyCookieHeader = response.headers.get('X-Proxy-Set-Cookie')
  if (proxyCookieHeader) {
    writeWebCookies(targetUrl, proxyCookieHeader)
  }
}

const proxyFetch = async (proxyBody: string) => {
  const urls = getProxyUrls()
  let lastError: Error | null = null

  for (const proxyUrl of urls) {
    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: proxyBody,
      })
      
      // If response is not OK (and not 502 which our worker explicitly returns on upstream fail),
      // we fallback to the next proxy.
      if (!response.ok && response.status !== 502) {
        throw new Error(`Proxy ${proxyUrl} returned status ${response.status}`)
      }
      return response
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[Proxy] Request failed for ${proxyUrl}, trying next fallback...`, err)
    }
  }

  throw lastError || new Error('All proxy fallback URLs failed')
}

const proxyRequest = async (options: PortalRequestOptions): Promise<PortalResponse> => {
  const { targetUrl, proxyBody } = buildProxyRequest(options)

  const response = await proxyFetch(proxyBody)

  const responseText = await response.text()
  const responseHeaders = Object.fromEntries(response.headers.entries())
  persistProxyCookies(targetUrl, response)

  const finalUrl = response.headers.get('X-Proxy-Final-Url') ?? targetUrl

  return {
    status: response.status,
    data: responseText,
    headers: responseHeaders,
    url: finalUrl,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const portalRequest = async (options: PortalRequestOptions): Promise<PortalResponse> => {
  if (isNative()) {
    const nativeTimeoutMs = options.timeoutMs ?? NATIVE_REQUEST_TIMEOUT_MS
    return withNativeTimeout(
      NativePortal.request({
        url: options.url,
        method: options.method,
        headers: options.headers,
        data: typeof options.data === 'string' ? options.data : undefined,
        timeoutMs: nativeTimeoutMs,
      }),
      '海大 AIS 連線逾時，請重新整理後再試',
      nativeTimeoutMs + 5000,
    )
  }

  // PWA 環境：透過 Cloudflare Proxy
  return proxyRequest(options)
}

export const assertOk = (response: PortalResponse, message: string) => {
  if (response.status < 200 || response.status >= 400) {
    throw new ApiError(message, response.status, 'PORTAL_HTTP_ERROR')
  }
}

const cookieHeaderFromSetCookie = (headers: HttpHeaders) => {
  const setCookie = readHeader(headers, 'set-cookie')
  if (!setCookie) {
    return ''
  }

  return splitSetCookieHeader(setCookie)
    .map((cookie) => cookie.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ')
}

export const getPortalCookieHeader = async (responseHeaders?: HttpHeaders) => {
  // Native：讓 Capacitor 的 WKWebView/OkHttp 管理 Cookie，不需手動帶入
  if (isNative()) return ''
  // Web：從 response headers 讀取（proxy 已轉換 Set-Cookie → X-Proxy-Set-Cookie）
  const proxyCookie = responseHeaders?.['x-proxy-set-cookie']
  if (proxyCookie) {
    return splitSetCookieHeader(proxyCookie)
      .map((cookie) => cookie.split(';')[0]?.trim())
      .filter(Boolean)
      .join('; ')
  }
  return responseHeaders ? cookieHeaderFromSetCookie(responseHeaders) : ''
}

export const portalImageDataUrl = async (url: string, referer: string, cookieHeader?: string) => {
  const headers = {
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    Referer: referer,
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  }

  if (isNative()) {
    const response = await withNativeTimeout(
      NativePortal.image({
        url,
        headers,
      }),
      '海大 AIS 驗證碼讀取逾時，請重新整理',
    )
    if (!response.dataUrl) {
      throw new ApiError('海大 AIS 沒有回傳有效的驗證碼圖片', response.status, 'CAPTCHA_IMAGE_INVALID')
    }
    return response.dataUrl
  }

  // PWA 環境：透過 Proxy 以單一請求取得圖片，避免驗證碼與登入表單不同步。
  try {
    const { targetUrl, proxyBody } = buildProxyRequest({
      url,
      method: 'GET',
      headers,
    })
    const response = await proxyFetch(proxyBody)
    persistProxyCookies(targetUrl, response)
    if (!response.ok) {
      return undefined
    }
    const contentType = response.headers.get('Content-Type') || 'image/png'
    if (!contentType.toLowerCase().startsWith('image/')) return undefined
    const base64 = base64FromArrayBuffer(await response.arrayBuffer())
    return `data:${contentType};base64,${base64}`
  } catch {
    return undefined
  }
}

export const clearPortalCookies = async () => {
  if (!isNative()) {
    // PWA：清除所有 sessionStorage 中的 proxy cookie
    const keysToRemove = Object.keys(sessionStorage).filter((k) =>
      k.startsWith(WEB_COOKIE_KEY_PREFIX),
    )
    keysToRemove.forEach((k) => sessionStorage.removeItem(k))
    return
  }

  await withNativeTimeout(
    NativePortal.clear(),
    '重設海大 AIS 登入狀態逾時，請再試一次',
    8000,
  )
}

export const readEncryptedPortalCache = async (key: string) => {
  if (isNative()) {
    const result = await NativePortal.cacheGet({ key })
    return result.value ?? null
  }
  return localStorage.getItem(key)
}

export const writeEncryptedPortalCache = async (key: string, value: string) => {
  if (isNative()) {
    await NativePortal.cacheSet({ key, value })
    return
  }
  localStorage.setItem(key, value)
}

export const clearEncryptedPortalCache = async () => {
  if (isNative()) {
    await NativePortal.cacheClear()
    return
  }
  Object.keys(localStorage)
    .filter((key) => key.startsWith('ntou_tat_semester_'))
    .forEach((key) => localStorage.removeItem(key))
}

export const launchPortalSystemPage = async (url: string) => {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'ais.ntou.edu.tw') {
    throw new ApiError('校務系統網址不在允許的網域內', 400, 'AIS_SYSTEM_URL_INVALID')
  }

  if (isNative()) {
    await withNativeTimeout(
      NativePortal.openSystemPage({ url: parsed.toString() }),
      '開啟海大校務系統逾時，請再試一次',
      8000,
    )
    return
  }

  window.open(parsed.toString(), '_blank', 'noopener,noreferrer')
}

/** 清除 PWA web cookie store（供測試或手動呼叫） */
export const clearWebProxyCookies = (targetUrl: string) => clearWebCookies(targetUrl)
