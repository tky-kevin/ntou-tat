import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, AlertCircle, KeyRound, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { LoginChallenge } from '../../types'
import { useApi } from '../../core/api/hooks'
import { authStore } from '../../core/storage/authStorage'
import { credentialsStore } from '../../core/storage/credentialsStorage'

export function LoginScreen() {
  const api = useApi()
  const navigate = useNavigate()

  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  const [busy, setBusy] = useState(false)
  const [challengeBusy, setChallengeBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null)
  const [autoCaptchaFailed, setAutoCaptchaFailed] = useState(false)

  const loadChallenge = async () => {
    setChallengeBusy(true)
    setError(null)
    try {
      const ch = await api.getLoginChallenge?.()
      if (ch) setChallenge(ch)
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法取得驗證碼')
    } finally {
      setChallengeBusy(false)
    }
  }

  useEffect(() => {
    void loadChallenge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || challengeBusy || !studentId || !password) return

    setBusy(true)
    setError(null)

    try {
      let finalCaptcha = captchaCode
      if (!autoCaptchaFailed && challenge?.captchaDataUrl) {
        try {
          const { recognizeCaptcha } = await import('../../utils/ocr')
          finalCaptcha = await recognizeCaptcha(challenge.captchaDataUrl)
        } catch (ocrErr) {
          console.warn('[OCR] fallback to manual', ocrErr)
          setAutoCaptchaFailed(true)
          setBusy(false)
          return
        }
      }

      const session = await api.login({
        studentId,
        password,
        captchaCode: finalCaptcha || undefined,
        challenge: challenge ?? undefined,
      })

      await authStore.saveSession(session)

      if (rememberMe) {
        await credentialsStore.saveCredentials({ studentId, password })
      } else {
        await credentialsStore.clearCredentials()
      }

      navigate('/app/timetable', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登入失敗'
      setError(msg)
      if (msg.includes('驗證碼')) {
        setAutoCaptchaFailed(true)
      }
      setCaptchaCode('')
      void loadChallenge()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <div className="brand-icon">
            <img src="/app-icon.jpg" alt="" />
          </div>
          <div><h1>海大 TAT</h1><p>National Taiwan Ocean University</p></div>
        </div>
        <form onSubmit={handleLogin}>
          <label>
            <span>學號</span>
            <input
              autoComplete="username"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
            />
          </label>
          <label>
            <span>密碼</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {autoCaptchaFailed && challenge && (
            <label className="captcha-label">
              <span>驗證碼</span>
              <div className="captcha-row">
                <input
                  type="text"
                  maxLength={4}
                  autoComplete="off"
                  value={captchaCode}
                  onChange={(event) => setCaptchaCode(event.target.value.toUpperCase())}
                />
                <button
                  type="button"
                  className="refresh-captcha"
                  disabled={challengeBusy || busy}
                  onClick={loadChallenge}
                  title="重新產生驗證碼"
                >
                  {challengeBusy ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
                </button>
                {challenge.captchaUrl || challenge.captchaDataUrl ? (
                  <img src={challenge.captchaDataUrl || challenge.captchaUrl!} alt="Captcha" />
                ) : (
                  <div className="captcha-placeholder">無法載入</div>
                )}
              </div>
              <div className="captcha-hint">自動辨識失敗，請手動輸入圖中文字</div>
            </label>
          )}

          <label className="remember-me">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>記住帳號密碼並自動登入</span>
          </label>
          {error ? <div className="login-error"><AlertCircle size={18} /><span>{error}</span></div> : null}
          <button
            className="login-button"
            type="submit"
            disabled={busy || challengeBusy}
          >
            <KeyRound size={19} />
            {busy ? '登入中' : '登入'}
          </button>
        </form>
        <div className="privacy-note">
          <ShieldCheck size={17} />
          {rememberMe ? '帳密與 Cookie 將加密儲存於本機安全區' : '帳密不儲存，Cookie 於本機加密保存'}
        </div>
      </section>
    </div>
  )
}
