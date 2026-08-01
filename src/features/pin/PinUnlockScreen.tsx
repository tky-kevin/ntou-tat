import React, { useState } from 'react'
import { KeyRound, Delete } from 'lucide-react'
import { credentialsStore } from '../../core/storage/credentialsStorage'

type Props = {
  onUnlocked: (pin: string) => void
  onForgotPin: () => void
}

export const PinUnlockScreen: React.FC<Props> = ({ onUnlocked, onForgotPin }) => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const handleDigit = async (digit: string) => {
    if (isVerifying || pin.length >= 6) return

    const newPin = pin + digit
    setPin(newPin)
    setError(null)

    if (newPin.length === 6) {
      setIsVerifying(true)
      try {
        const creds = await credentialsStore.getCredentials({ pin: newPin })
        if (creds) {
          onUnlocked(newPin)
        } else {
          setError('解鎖失敗：未找到憑證，請重新登入')
          setPin('')
        }
      } catch (err: any) {
        if (err.name === 'PinError') {
          setError('PIN 碼錯誤，請重試')
        } else {
          setError('解密失敗：' + (err.message || '未知錯誤'))
        }
        setPin('')
      } finally {
        setIsVerifying(false)
      }
    }
  }

  const handleDelete = () => {
    if (isVerifying || pin.length === 0) return
    setPin((prev) => prev.slice(0, -1))
    setError(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-white">
      <div className="mb-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-slate-800 p-4 rounded-full mb-4">
          <KeyRound size={32} className="text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">輸入 PIN 碼</h1>
        <p className="text-slate-400 text-sm">請輸入 6 位數密碼以解鎖 App</p>
      </div>

      <div className="flex gap-4 mb-12">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-300 ${
              i < pin.length ? 'bg-blue-500 scale-110' : 'bg-slate-700'
            } ${error ? 'bg-red-500' : ''}`}
          />
        ))}
      </div>

      <div className="h-8 mb-4">
        {error && <p className="text-red-400 text-sm animate-pulse">{error}</p>}
      </div>

      <div className="grid grid-cols-3 gap-6 max-w-xs w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigit(digit.toString())}
            disabled={isVerifying}
            className="h-16 rounded-2xl bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 active:scale-95 transition-all text-2xl font-medium"
          >
            {digit}
          </button>
        ))}
        <button
          onClick={onForgotPin}
          className="h-16 rounded-2xl text-slate-400 hover:text-slate-200 text-sm active:scale-95 transition-all"
        >
          忘記密碼
        </button>
        <button
          onClick={() => handleDigit('0')}
          disabled={isVerifying}
          className="h-16 rounded-2xl bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 active:scale-95 transition-all text-2xl font-medium"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          disabled={isVerifying || pin.length === 0}
          className="h-16 flex items-center justify-center rounded-2xl bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 active:scale-95 transition-all"
        >
          <Delete size={24} />
        </button>
      </div>
    </div>
  )
}
