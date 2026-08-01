/**
 * NTOU TAT — Web Crypto API 加密模組
 *
 * 雙層加密策略：
 *   - 裝置金鑰模式（預設）：AES-GCM 256-bit 金鑰存放於 IndexedDB
 *   - PIN 碼模式：PBKDF2 (SHA-256, 310,000 iterations) 推導 AES-GCM 金鑰
 *
 * 所有加密操作基於 Web Crypto API（瀏覽器原生），無需 npm 加密套件。
 */

const DB_NAME = 'ntou-tat-keystore'
const DB_VERSION = 1
const STORE_NAME = 'keys'
const DEVICE_KEY_ID = 'device-key-v1'
const PBKDF2_ITERATIONS = 310_000 // OWASP 2024 建議值

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

const openKeyDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const idbGet = (db: IDBDatabase, id: string): Promise<CryptoKey | undefined> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined)
    req.onerror = () => reject(req.error)
  })

const idbPut = (db: IDBDatabase, id: string, key: CryptoKey): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(key, id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })

const idbDelete = (db: IDBDatabase, id: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })

// ---------------------------------------------------------------------------
// Base64 utilities
// ---------------------------------------------------------------------------

export const bufferToBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export const base64ToBuffer = (b64: string): ArrayBuffer => {
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}

// ---------------------------------------------------------------------------
// AES-GCM key generation
// ---------------------------------------------------------------------------

/**
 * 產生新的 256-bit AES-GCM 金鑰（不可導出，僅限 encrypt/decrypt）
 */
export const generateAesKey = (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])

/**
 * 產生可導出的 256-bit AES-GCM 金鑰（用於 IndexedDB 持久化前）
 * IndexedDB 本身支援直接儲存 CryptoKey 物件（structured clone），
 * 不需要序列化，因此可用 extractable: false 提高安全性。
 */
export const generateDeviceKey = (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])

// ---------------------------------------------------------------------------
// Device Key (IndexedDB)
// ---------------------------------------------------------------------------

/**
 * 讀取裝置金鑰；若不存在則產生並存入 IndexedDB。
 * 裝置金鑰在瀏覽器清除 IndexedDB 前持續有效。
 */
export const getOrCreateDeviceKey = async (): Promise<CryptoKey> => {
  const db = await openKeyDb()
  const existing = await idbGet(db, DEVICE_KEY_ID)
  if (existing) return existing

  const newKey = await generateDeviceKey()
  await idbPut(db, DEVICE_KEY_ID, newKey)
  return newKey
}

/**
 * 刪除裝置金鑰（登出時呼叫，讓舊密文永久無法解密）
 */
export const deleteDeviceKey = async (): Promise<void> => {
  const db = await openKeyDb()
  await idbDelete(db, DEVICE_KEY_ID)
}

// ---------------------------------------------------------------------------
// PIN Key (PBKDF2)
// ---------------------------------------------------------------------------

export type PinKeyEnvelope = {
  /** PBKDF2 salt (base64) */
  salt: string
}

/**
 * 從 6 位數 PIN 碼推導 AES-GCM 金鑰。
 * 使用 PBKDF2 with SHA-256，iterations: 310,000（OWASP 2024 建議）。
 */
export const derivePinKey = async (pin: string, saltBuffer?: ArrayBuffer): Promise<{ key: CryptoKey; salt: string }> => {
  const salt = saltBuffer ?? crypto.getRandomValues(new Uint8Array(16)).buffer

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )

  return { key, salt: bufferToBase64(salt) }
}

// ---------------------------------------------------------------------------
// AES-GCM Encrypt / Decrypt
// ---------------------------------------------------------------------------

export type EncryptedEnvelope = {
  /** AES-GCM IV (base64, 12 bytes) */
  iv: string
  /** Ciphertext (base64) */
  ct: string
}

/**
 * 使用 AES-GCM 加密任意字串 payload。
 */
export const encryptPayload = async (key: CryptoKey, plaintext: string): Promise<EncryptedEnvelope> => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return {
    iv: bufferToBase64(iv.buffer),
    ct: bufferToBase64(ciphertext),
  }
}

/**
 * 使用 AES-GCM 解密 EncryptedEnvelope。
 * PIN 碼錯誤時，AES-GCM 認證標籤驗證失敗會拋出 DOMException。
 */
export const decryptPayload = async (key: CryptoKey, envelope: EncryptedEnvelope): Promise<string> => {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuffer(envelope.iv) },
    key,
    base64ToBuffer(envelope.ct),
  )
  return new TextDecoder().decode(plaintext)
}

// ---------------------------------------------------------------------------
// PIN validation error
// ---------------------------------------------------------------------------

export class PinError extends Error {
  constructor() {
    super('PIN 碼錯誤，無法解鎖')
    this.name = 'PinError'
  }
}
