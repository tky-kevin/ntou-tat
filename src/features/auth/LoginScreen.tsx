import React, { useState } from 'react'
import { Loader2, RefreshCw, AlertCircle, KeyRound, ShieldCheck } from 'lucide-react'
import type { LoginChallenge } from '../../types'

type LoginScreenProps = {
  busy: boolean
  challengeBusy: boolean
  error: string | null
  challenge: LoginChallenge | null
  autoCaptchaFailed: boolean
  onRefreshChallenge: () => void
  onLogin: (studentId: string, password: string, providedCaptchaCode?: string, rememberMe?: boolean) => Promise<void>
}

export function LoginScreen({
  busy,
  challengeBusy,
  error,
  challenge,
  autoCaptchaFailed,
  onRefreshChallenge,
  onLogin,
}: LoginScreenProps) {
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  return (
    <div className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <div className="brand-icon">
            <img src="/app-icon.jpg" alt="" />
          </div>
          <div><h1>海大 TAT</h1><p>National Taiwan Ocean University</p></div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void onLogin(studentId, password, autoCaptchaFailed ? captchaCode : undefined, rememberMe)
          }}
        >
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
                  onClick={onRefreshChallenge}
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
