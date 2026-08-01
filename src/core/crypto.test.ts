import { describe, it, expect, beforeAll } from 'vitest'
import {
  generateAesKey,
  derivePinKey,
  encryptPayload,
  decryptPayload,
  bufferToBase64,
  base64ToBuffer,
  PinError,
} from './crypto'

// ---------------------------------------------------------------------------
// vitest 環境已內建 Web Crypto API（Node.js 19+）
// ---------------------------------------------------------------------------

describe('bufferToBase64 / base64ToBuffer', () => {
  it('round-trips correctly', () => {
    const original = new Uint8Array([1, 2, 3, 255, 0, 128])
    const b64 = bufferToBase64(original.buffer)
    const restored = new Uint8Array(base64ToBuffer(b64))
    expect(Array.from(restored)).toEqual([1, 2, 3, 255, 0, 128])
  })
})

describe('AES-GCM encrypt / decrypt', () => {
  let key: CryptoKey

  beforeAll(async () => {
    key = await generateAesKey()
  })

  it('decrypts back to original plaintext', async () => {
    const plaintext = 'Hello, 海大 AIS 🔐'
    const envelope = await encryptPayload(key, plaintext)
    const decrypted = await decryptPayload(key, envelope)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext for the same plaintext (random IV)', async () => {
    const plaintext = 'same input'
    const e1 = await encryptPayload(key, plaintext)
    const e2 = await encryptPayload(key, plaintext)
    expect(e1.iv).not.toBe(e2.iv)
    expect(e1.ct).not.toBe(e2.ct)
  })

  it('throws DOMException when decrypting with wrong key', async () => {
    const plaintext = 'secret data'
    const envelope = await encryptPayload(key, plaintext)
    const wrongKey = await generateAesKey()
    await expect(decryptPayload(wrongKey, envelope)).rejects.toThrow()
  })
})

describe('PBKDF2 PIN key derivation', () => {
  it('derives a usable AES key from PIN', async () => {
    const { key, salt } = await derivePinKey('123456')
    expect(typeof salt).toBe('string')
    expect(salt.length).toBeGreaterThan(0)

    const plaintext = '{"studentId":"B12345678","password":"mypassword"}'
    const envelope = await encryptPayload(key, plaintext)
    const decrypted = await decryptPayload(key, envelope)
    expect(decrypted).toBe(plaintext)
  })

  it('same PIN + same salt produces equivalent key (deterministic)', async () => {
    const { key: k1, salt } = await derivePinKey('654321')
    const saltBuffer = base64ToBuffer(salt)
    const { key: k2 } = await derivePinKey('654321', saltBuffer)

    const plaintext = 'determinism test'
    const envelope = await encryptPayload(k1, plaintext)

    // k2 should decrypt what k1 encrypted
    const decrypted = await decryptPayload(k2, envelope)
    expect(decrypted).toBe(plaintext)
  })

  it('different PIN produces a key that cannot decrypt', async () => {
    const { key: correctKey, salt } = await derivePinKey('111111')
    const saltBuffer = base64ToBuffer(salt)
    const { key: wrongKey } = await derivePinKey('999999', saltBuffer)

    const plaintext = 'very secret'
    const envelope = await encryptPayload(correctKey, plaintext)
    await expect(decryptPayload(wrongKey, envelope)).rejects.toThrow()
  })
})

describe('PinError', () => {
  it('is an Error instance with expected name', () => {
    const err = new PinError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('PinError')
    expect(err.message).toContain('PIN')
  })
})
