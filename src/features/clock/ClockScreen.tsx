import React, { useState, useRef, useEffect } from 'react'
import { Clock, Trash2 } from 'lucide-react'
import { useLocalDataStore } from '../../core/store/useLocalDataStore'

export function ClockScreen() {
  const alarms = useLocalDataStore(s => s.alarms)
  const setAlarms = useLocalDataStore(s => s.setAlarms)

  const [timeText, setTimeText] = useState('')
  const [secText, setSecText] = useState('')
  const [dateText, setDateText] = useState('')

  const [isSwRunning, setIsSwRunning] = useState(false)
  const [swMs, setSwMs] = useState(0)
  const swTimerRef = useRef<number | null>(null)

  const [alarmTime, setAlarmTime] = useState('08:00')
  const [alarmLabel, setAlarmLabel] = useState('')
  const [isRinging, setIsRinging] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')

      setTimeText(`${hours}:${minutes}`)
      setSecText(seconds)

      const weekdays = ['日', '一', '二', '三', '四', '五', '六']
      setDateText(`${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekdays[now.getDay()]}`)

      const hhmm = `${hours}:${minutes}`
      const matches = alarms.find((a) => a.active && a.time === hhmm && seconds === '00')
      if (matches) {
        setIsRinging(true)
        startAlarmSound()
      }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [alarms])

  const startAlarmSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      if (oscillatorRef.current) return

      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.connect(gain)
      gain.connect(ctx.destination)

      gain.gain.setValueAtTime(0.5, ctx.currentTime)

      osc.start()
      oscillatorRef.current = osc
    } catch (e) {
      console.error(e)
    }
  }

  const stopAlarmSound = () => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop()
        oscillatorRef.current.disconnect()
      } catch {}
      oscillatorRef.current = null
    }
    setIsRinging(false)
  }

  const toggleStopwatch = () => {
    if (isSwRunning) {
      if (swTimerRef.current) clearInterval(swTimerRef.current)
      setIsSwRunning(false)
    } else {
      const start = Date.now() - swMs
      swTimerRef.current = setInterval(() => {
        setSwMs(Date.now() - start)
      }, 37) as any
      setIsSwRunning(true)
    }
  }

  const resetStopwatch = () => {
    if (swTimerRef.current) clearInterval(swTimerRef.current)
    setSwMs(0)
    setIsSwRunning(false)
  }

  const formatStopwatch = (totalMs: number) => {
    const min = String(Math.floor(totalMs / 60000)).padStart(2, '0')
    const sec = String(Math.floor((totalMs % 60000) / 1000)).padStart(2, '0')
    const ms = String(Math.floor((totalMs % 1000) / 10)).padStart(2, '0')
    return `${min}:${sec}.${ms}`
  }

  const addAlarm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!alarmTime) return
    const newAlarm = {
      id: `alarm-${Date.now()}`,
      time: alarmTime,
      label: alarmLabel.trim() || '鬧鐘',
      active: true,
    }
    setAlarms(() => [...alarms, newAlarm])
    setAlarmLabel('')
  }

  const deleteAlarm = (id: string) => {
    setAlarms(() => alarms.filter((a) => a.id !== id))
  }

  const toggleAlarmActive = (id: string) => {
    setAlarms(() => alarms.map((a) => (a.id === id ? { ...a, active: !a.active } : a)))
  }

  return (
    <section className="clock-screen" style={{ padding: '16px', color: 'var(--ink)' }}>
      {isRinging ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(15, 23, 42, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          <Clock className="spin" size={68} style={{ color: 'var(--active)' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 900 }}>鬧鐘響起！</h2>
          <button
            type="button"
            style={{
              padding: '12px 28px',
              background: 'var(--danger)',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 800,
              border: 0,
              borderRadius: '8px',
              boxShadow: '0 4px 14px rgba(255, 0, 0, 0.4)',
            }}
            onClick={stopAlarmSound}
          >
            關閉鬧鐘
          </button>
        </div>
      ) : null}

      <div style={{ textAlign: 'center', margin: '14px 0 24px' }}>
        <div style={{ fontSize: '58px', fontWeight: 900, fontFamily: 'monospace', color: 'var(--active)', lineHeight: 1 }}>
          {timeText}
          <span style={{ fontSize: '24px', color: 'var(--muted)', marginLeft: '4px' }}>{secText}</span>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px', fontWeight: 700 }}>
          {dateText}
        </div>
      </div>

      <div style={{ background: '#111419', borderRadius: '10px', padding: '14px', marginBottom: '20px', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>
          我的鬧鐘
        </h3>

        <form onSubmit={addAlarm} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <input
            type="time"
            value={alarmTime}
            onChange={(e) => setAlarmTime(e.target.value)}
            style={{
              background: '#252a30',
              color: '#fff',
              border: '1px solid var(--line-strong)',
              borderRadius: '6px',
              padding: '6px',
              fontSize: '13px',
              fontWeight: 700,
            }}
          />
          <input
            type="text"
            placeholder="鬧鐘標籤 (例如：早八課表)"
            value={alarmLabel}
            onChange={(e) => setAlarmLabel(e.target.value)}
            style={{
              flex: 1,
              background: '#252a30',
              color: '#fff',
              border: '1px solid var(--line-strong)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '13px',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '6px 14px',
              background: 'var(--brand)',
              color: '#fff',
              fontWeight: 800,
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            新增
          </button>
        </form>

        {alarms.length ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {alarms.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#1d2126',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                }}
              >
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: a.active ? 'var(--ink)' : 'var(--muted)' }}>
                    {a.time}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    {a.label}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="checkbox"
                    checked={a.active}
                    onChange={() => toggleAlarmActive(a.id)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <button
                    type="button"
                    style={{ background: 'transparent', color: 'var(--danger)', display: 'grid', placeItems: 'center' }}
                    onClick={() => deleteAlarm(a.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: '12px', textAlign: 'center', padding: '10px 0' }}>
            尚無鬧鐘，設定一個來提醒上課吧！
          </div>
        )}
      </div>

      <div style={{ background: '#111419', borderRadius: '10px', padding: '14px', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>課程計時器</h3>
        <div style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'monospace', textAlign: 'center', margin: '14px 0', color: 'var(--ink)' }}>
          {formatStopwatch(swMs)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            type="button"
            style={{
              padding: '8px 20px',
              background: isSwRunning ? 'var(--danger)' : 'var(--success)',
              color: '#111',
              fontWeight: 800,
              borderRadius: '6px',
              fontSize: '13px',
              minWidth: '78px',
            }}
            onClick={toggleStopwatch}
          >
            {isSwRunning ? '暫停' : '開始'}
          </button>
          <button
            type="button"
            style={{
              padding: '8px 20px',
              background: '#252a30',
              color: '#fff',
              fontWeight: 800,
              border: '1px solid #373d45',
              borderRadius: '6px',
              fontSize: '13px',
              minWidth: '78px',
            }}
            onClick={resetStopwatch}
          >
            重設
          </button>
        </div>
      </div>
    </section>
  )
}
