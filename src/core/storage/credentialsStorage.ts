/**
 * NTOU TAT — 憑證儲存模組（雙層加密策略）
 *
 * 平台策略：
 *   - Capacitor 原生平台（Android/iOS）：沿用 capacitor-secure-storage-plugin
 *   - PWA / 瀏覽器：使用 Web Crypto AES-GCM 加密後存入 localStorage
 *     ├── 無 PIN（預設）：裝置金鑰（IndexedDB）加密 → 無感模式
 *     └── 有 PIN：PBKDF2 推導金鑰加密 → 重開 App 需輸入 PIN 解鎖
 */

import { Capacitor } from '@capacitor/core'
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'
import type { LoginPayload } from '../api/contract'
import {
  PinError,
  type EncryptedEnvelope,
  base64ToBuffer,
  decryptPayload,
  derivePinKey,
  encryptPayload,
  getOrCreateDeviceKey,
  deleteDeviceKey,
} from '../crypto'

const CREDENTIALS_KEY = 'ntou_tat_user_credentials'
const PIN_META_KEY = 'ntou_tat_pin_meta_v1'

const isNative = () => Capacitor.isNativePlatform()

// ---------------------------------------------------------------------------
// PIN metadata stored in localStorage (unencrypted — salt is not secret)
// ---------------------------------------------------------------------------

type PinMeta = {
  /** PBKDF2 salt (base64) */
  salt: string
}

const writePinMeta = (meta: PinMeta) => {
  localStorage.setItem(PIN_META_KEY, JSON.stringify(meta))
}

const clearPinMeta = () => {
  localStorage.removeItem(PIN_META_KEY)
}

// ---------------------------------------------------------------------------
// Web storage envelope: { mode, envelope, [pinSalt] }
// ---------------------------------------------------------------------------

type WebCredentialsRecord =
  | {
      mode: 'device'
      envelope: EncryptedEnvelope
    }
  | {
      mode: 'pin'
      envelope: EncryptedEnvelope
      salt: string
    }

const readWebRecord = (): WebCredentialsRecord | null => {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY)
    return raw ? (JSON.parse(raw) as WebCredentialsRecord) : null
  } catch {
    return null
  }
}

const writeWebRecord = (record: WebCredentialsRecord) => {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(record))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const credentialsStore = {
  /**
   * 儲存憑證。
   * @param credentials 帳密物件
   * @param options.pin  若提供，使用 PIN 碼模式加密；否則使用裝置金鑰模式
   */
  async saveCredentials(credentials: LoginPayload, options?: { pin?: string }): Promise<void> {
    if (isNative()) {
      try {
        await SecureStoragePlugin.set({
          key: CREDENTIALS_KEY,
          value: JSON.stringify(credentials),
        })
      } catch (error) {
        console.error('[CredStore] Native save failed:', error)
      }
      return
    }

    const plaintext = JSON.stringify(credentials)

    if (options?.pin) {
      // PIN 碼模式
      const { key, salt } = await derivePinKey(options.pin)
      const envelope = await encryptPayload(key, plaintext)
      writeWebRecord({ mode: 'pin', envelope, salt })
      writePinMeta({ salt })
    } else {
      // 裝置金鑰模式（預設）
      const key = await getOrCreateDeviceKey()
      const envelope = await encryptPayload(key, plaintext)
      writeWebRecord({ mode: 'device', envelope })
      clearPinMeta() // 清除舊的 PIN meta（如果有的話）
    }
  },

  /**
   * 讀取憑證。
   * @param options.pin  PIN 碼模式時需提供；PIN 錯誤時拋出 PinError
   */
  async getCredentials(options?: { pin?: string }): Promise<LoginPayload | null> {
    if (isNative()) {
      try {
        const { value } = await SecureStoragePlugin.get({ key: CREDENTIALS_KEY })
        if (!value) return null
        return JSON.parse(value) as LoginPayload
      } catch {
        return null
      }
    }

    const record = readWebRecord()
    if (!record) return null

    try {
      if (record.mode === 'pin') {
        if (!options?.pin) {
          // 需要 PIN 碼才能解鎖，但呼叫者未提供 → 回傳 null 讓 UI 顯示解鎖畫面
          return null
        }
        const saltBuffer = base64ToBuffer(record.salt)
        const { key } = await derivePinKey(options.pin, saltBuffer)
        const plaintext = await decryptPayload(key, record.envelope).catch(() => {
          throw new PinError()
        })
        return JSON.parse(plaintext) as LoginPayload
      } else {
        // 裝置金鑰模式
        const key = await getOrCreateDeviceKey()
        const plaintext = await decryptPayload(key, record.envelope)
        return JSON.parse(plaintext) as LoginPayload
      }
    } catch (error) {
      if (error instanceof PinError) throw error
      console.warn('[CredStore] Decryption failed (key may have changed):', error)
      return null
    }
  },

  /**
   * 檢查是否已設定 PIN 碼保護
   */
  hasPin(): boolean {
    if (isNative()) return false
    const record = readWebRecord()
    return record?.mode === 'pin'
  },

  /**
   * 設定或變更 PIN 碼
   * @param currentPin 目前 PIN（若尚未設定則傳入空字串）
   * @param newPin     新的 6 位數 PIN
   */
  async setPin(currentPin: string | null, newPin: string): Promise<void> {
    // 先讀取現有憑證
    const credentials = await this.getCredentials(
      currentPin ? { pin: currentPin } : undefined,
    )
    if (!credentials) {
      throw new Error('無法讀取現有憑證以更換 PIN 碼')
    }
    // 以新 PIN 重新儲存
    await this.saveCredentials(credentials, { pin: newPin })
  },

  /**
   * 移除 PIN 碼保護（切換回裝置金鑰模式）
   * @param currentPin 目前的 PIN 碼（驗證身份）
   */
  async removePin(currentPin: string): Promise<void> {
    const credentials = await this.getCredentials({ pin: currentPin })
    if (!credentials) {
      throw new PinError()
    }
    await this.saveCredentials(credentials) // 不傳 pin → 裝置金鑰模式
  },

  /**
   * 清除所有憑證資料
   */
  async clearCredentials(): Promise<void> {
    if (isNative()) {
      try {
        await SecureStoragePlugin.remove({ key: CREDENTIALS_KEY })
      } catch (error) {
        console.warn('[CredStore] Native clear failed:', error)
      }
      return
    }
    localStorage.removeItem(CREDENTIALS_KEY)
    clearPinMeta()
    await deleteDeviceKey()
  },
}
