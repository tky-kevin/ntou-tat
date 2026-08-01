import React, { useState } from 'react'
import { KeyRound, Delete, CheckCircle2 } from 'lucide-react'
import { credentialsStore } from '../../storage/credentialsStorage'

type Props = {
  onSetupComplete: () => void
  onCancel: () => void
}

export const PinSetupScreen: React.FC<Props> = ({ onSetupComplete, onCancel }) => {
  const [step, setStep] = useState<'create' | 'confirm'>('create')
  const [firstPin, setFirstPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const currentPin = step === 'create' ? firstPin : confirmPin
  const setCurrentPin = step === 'create' ? setFirstPin : setConfirmPin

  const handleDigit = async (digit: string) => {
    if (isSaving || success || currentPin.length >= 6) return

    const newPin = currentPin + digit
    setCurrentPin(newPin)
    setError(null)

    if (newPin.length === 6) {
      if (step === 'create') {
        // 等待一下讓使用者看到最後一個圈圈填滿
        setTimeout(() => setStep('confirm'), 200)
      } else {
        if (newPin === firstPin) {
          setIsSaving(true)
          try {
            // 目前 PIN 為空字串，因為現在是剛建立
            await credentialsStore.setPin(null, newPin)
            setSuccess(true)
            setTimeout(onSetupComplete, 1500)
          } catch (err: any) {
            setError(err.message || '儲存失敗，請重試')
            setConfirmPin('')
            setStep('create')
            setFirstPin('')
          } finally {
            setIsSaving(false)
          }
        } else {
          setError('密碼不一致，請重新輸入')
          setConfirmPin('')
        }
      }
    }
  }

  const handleDelete = () => {
    if (isSaving || success || currentPin.length === 0) return
    setCurrentPin((prev) => prev.slice(0, -1))
    setError(null)
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="flex flex-col items-center animate-in zoom-in duration-300">
          <CheckCircle2 size={64} className="text-green-400 mb-4" />
          <h1 className="text-2xl font-bold">設定成功</h1>
          <p className="text-slate-400 mt-2">下次開啟 App 將需要輸入 PIN 碼</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-white">
      <div className="mb-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-slate-800 p-4 rounded-full mb-4">
          <KeyRound size={32} className="text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {step === 'create' ? '設定 6 位數 PIN 碼' : '再次輸入以確認'}
        </h1>
        <p className="text-slate-400 text-sm">保護您的帳號安全</p>
      </div>

      <div className="flex gap-4 mb-12">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-300 ${
              i < currentPin.length ? 'bg-blue-500 scale-110' : 'bg-slate-700'
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
            disabled={isSaving}
            className="h-16 rounded-2xl bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 active:scale-95 transition-all text-2xl font-medium"
          >
            {digit}
          </button>
        ))}
        <button
          onClick={() => {
            if (step === 'confirm') {
              setStep('create')
              setConfirmPin('')
              setFirstPin('')
            } else {
              onCancel()
            }
          }}
          disabled={isSaving}
          className="h-16 rounded-2xl text-slate-400 hover:text-slate-200 text-sm active:scale-95 transition-all"
        >
          {step === 'confirm' ? '重新設定' : '取消'}
        </button>
        <button
          onClick={() => handleDigit('0')}
          disabled={isSaving}
          className="h-16 rounded-2xl bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 active:scale-95 transition-all text-2xl font-medium"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          disabled={isSaving || currentPin.length === 0}
          className="h-16 flex items-center justify-center rounded-2xl bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 active:scale-95 transition-all"
        >
          <Delete size={24} />
        </button>
      </div>
    </div>
  )
}
